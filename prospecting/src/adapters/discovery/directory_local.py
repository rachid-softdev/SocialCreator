"""
Découverte de prospects depuis annuaire-des-entreprises-locales.fr.

Principe :
  1. le sitemap expose ~8 800 fiches `/entreprises-locales/<dept>/<ville>/<cat>/<slug>` ;
  2. on ne garde que les catégories pertinentes (agence web, marketing,
     communication, création de site, webmaster, développement informatique,
     mais aussi conseil, formation, coaching, commerce, artisanat, photo) et
     les fiches génériques `entreprise-locale` (PME locales) ;
  3. chaque fiche contient un JSON-LD `LocalBusiness` avec nom, site officiel,
     ville et parfois l'email dans la description ;
  4. l'entreprise est injectée dans le CRM (idempotent par domaine), puis
     site_harvest complète les emails sur son propre site.

Aucune API payante, HTTP seul (requests + BeautifulSoup), timeouts courts,
toute erreur réseau est non-fatale.
"""
import html
import json
import re
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from src.adapters.discovery.directory_discovery import _tag_values
from src.utils import log, normalize_domain

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
}
HTTP_TIMEOUT = 15
SITEMAP_URL = "https://www.annuaire-des-entreprises-locales.fr/sitemap.xml"
DIRECTORY_HOST = "annuaire-des-entreprises-locales.fr"
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com", "pinterest.", "google.com",
                "google.fr", "maps.google", "crunchbase.com", "glassdoor.",
                "trustpilot.com", "wa.me", "whatsapp.com")

ENTITY_TYPES = {"LocalBusiness", "Organization", "ProfessionalService",
                "Store", "AdvertisingAgency"}
RELEVANT_CATEGORIES = {
    "agence-web", "creation-de-site-internet", "creation-de-site-web",
    "agence-de-communication", "agence-marketing", "agence-digitale",
    "marketing-digital", "communication-digitale", "webmaster",
    "developpement-informatique", "informatique", "seo", "consultant",
    # PME / services locaux à fort enjeu de visibilité
    "coaching", "commerce", "formation", "entreprises-de-nettoyage",
    "photographe", "artisan", "centre-de-formation", "architecture-d-interieur",
    "nettoyage", "photographe-professionnel", "agence-de-publicite",
    "communication-visuelle", "depannage-informatique", "architecte", "web",
    # fiches génériques : PME locales, le descriptif métier est dans le JSON-LD
    "entreprise-locale",
}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def fetch_profile_urls(limit: Optional[int] = None) -> List[str]:
    """Fiches des catégories web/marketing/SEO listées dans le sitemap."""
    try:
        resp = requests.get(SITEMAP_URL, headers=HEADERS, timeout=60)
        if resp.status_code >= 400:
            log.warning(f"sitemap HTTP {resp.status_code}: {SITEMAP_URL}")
            return []
    except Exception as e:  # noqa: BLE001
        log.warning(f"sitemap injoignable {SITEMAP_URL}: {e}")
        return []

    urls: List[str] = []
    seen = set()
    for loc in _tag_values(resp.text, "loc"):
        parts = [p for p in urlparse(loc).path.split("/") if p]
        if len(parts) < 5 or parts[0] != "entreprises-locales":
            continue
        if parts[3] not in RELEVANT_CATEGORIES:
            continue
        if loc not in seen:
            seen.add(loc)
            urls.append(loc)
    if limit:
        urls = urls[:limit]
    return urls


def _clean_website(url: str) -> Optional[str]:
    url = html.unescape(str(url or "")).strip()
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        host = (urlparse(url).netloc or "").lower()
    except ValueError:
        return None
    if not host or DIRECTORY_HOST in host:
        return None
    if any(s in host for s in SOCIAL_HOSTS):
        return None
    return url


def _entities_from_ld(data):
    """Génère toutes les entités métier candidates (listes et @graph)."""
    if isinstance(data, list):
        for item in data:
            yield from _entities_from_ld(item)
        return
    if not isinstance(data, dict):
        return
    nodes = data.get("@graph") if isinstance(data.get("@graph"), list) else [data]
    for node in nodes:
        if not isinstance(node, dict):
            continue
        raw_type = node.get("@type")
        if isinstance(raw_type, str):
            types = {raw_type}
        elif isinstance(raw_type, (list, tuple, set)):
            types = {t for t in raw_type if isinstance(t, str)}
        else:
            types = set()
        if types & ENTITY_TYPES and (node.get("url") or node.get("address")):
            yield node


def _entity_priority(entity: Dict) -> int:
    """Préfère une entité localisée (LocalBusiness) à une Organization générique."""
    raw_type = entity.get("@type")
    if isinstance(raw_type, str):
        types = {raw_type}
    elif isinstance(raw_type, (list, tuple, set)):
        types = {t for t in raw_type if isinstance(t, str)}
    else:
        types = set()
    priority = 3 if types & {"LocalBusiness", "ProfessionalService",
                             "Store", "AdvertisingAgency"} else 2
    return priority + (1 if entity.get("address") else 0)


def _clean_email(raw) -> Optional[str]:
    email = html.unescape(str(raw or "")).strip().lower()
    if email.startswith("mailto:"):
        email = email[7:]
    match = EMAIL_RE.search(email)
    return match.group(0) if match else None


def _guess_sector(text: str) -> str:
    low = text.lower()
    if "seo" in low or "référencement" in low:
        return "agence SEO"
    if "marketing" in low:
        return "agence marketing"
    if "communication" in low:
        return "agence de communication"
    if "web" in low or "digital" in low:
        return "agence web"
    return "entreprise du numérique"


def _company_from_entity(entity: Dict) -> Optional[Dict]:
    """Transforme une entité JSON-LD en entreprise exploitable (ou None)."""
    name = html.unescape(str(entity.get("name") or "")).strip()
    if not name:
        return None

    website = _clean_website(entity.get("url"))
    if not website:
        for cand in entity.get("sameAs") or []:
            if isinstance(cand, str):
                website = _clean_website(cand)
                if website:
                    break
    if not website:
        return None

    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        return None
    if not domain or "." not in domain:
        return None

    addr = entity.get("address") or {}
    if not isinstance(addr, dict):
        addr = {}
    city = html.unescape(str(addr.get("addressLocality") or "")).strip() or None
    country = html.unescape(str(addr.get("addressCountry") or "")).strip().upper() or "FR"
    phone = str(entity.get("telephone") or "").strip()

    description = html.unescape(str(entity.get("description") or "")).strip()
    email = _clean_email(entity.get("email")) or _clean_email(description)
    if phone:
        description = f"{description} | Tel: {phone}".strip(" |")

    return {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": email,
        "city": city,
        "country": country if len(country) == 2 else "FR",
        "market": "fr",
        "sector": _guess_sector(f"{name} {description}"),
        "description": description[:600],
        "employees": None,
        "linkedin_url": None,
        "source": "annuaire_local",
    }


def parse_profile(page_html: str) -> Optional[Dict]:
    """Parse une fiche -> dict entreprise (ou None si non exploitable)."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    entities: List[Dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or script.get_text())
        except Exception:  # noqa: BLE001
            continue
        entities.extend(_entities_from_ld(data))

    # LocalBusiness d'abord, puis Organization ; ordre du document à égalité.
    entities.sort(key=_entity_priority, reverse=True)
    for entity in entities:
        company = _company_from_entity(entity)
        if company:
            return company
    return None


def fetch_profile(url: str) -> Optional[Dict]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=HTTP_TIMEOUT)
    except Exception:  # noqa: BLE001
        return None
    if resp.status_code >= 400:
        return None
    return parse_profile(resp.text)
