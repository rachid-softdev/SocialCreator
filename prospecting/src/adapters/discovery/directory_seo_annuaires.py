"""
Découverte de prospects depuis deux annuaires WordPress SEO/web :
  - annuairedesreferenceurs.com (140 fiches) ;
  - annuaires-seo.com (122 fiches).

Principe :
  1. chaque site expose un sitemap WordPress `wp-sitemap-posts-post-1.xml` ;
  2. chaque fiche a un <h1> (nom) et un lien externe vers le site officiel ;
  3. on en déduit le domaine -> entreprise injectée dans le CRM (idempotent
     par domaine), puis site_harvest récolte les emails sur son propre site.

Les deux annuaires mélangent agences et articles : le parseur ne garde que les
fiches avec un nom ET un site externe ; la qualification IA filtre ensuite.

Aucune API payante, HTTP seul (requests + BeautifulSoup), timeouts courts,
toute erreur réseau est non-fatale.
"""
import html
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
SITEMAPS = (
    "https://www.annuairedesreferenceurs.com/wp-sitemap-posts-post-1.xml",
    "https://www.annuaires-seo.com/wp-sitemap-posts-post-1.xml",
)
DIRECTORY_HOSTS = ("annuairedesreferenceurs.com", "annuaires-seo.com")
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com", "pinterest.", "google.com",
                "google.fr", "maps.google", "crunchbase.com", "glassdoor.",
                "trustpilot.com", "wa.me", "whatsapp.com", "wordpress.org",
                "w3.org", "schema.org", "gravatar.com", "wp.com",
                "creativecommons.org")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
NAME_SPLIT_RE = re.compile(r"\s+[|\u2013\u2014]\s+")


def fetch_profile_urls(limit: Optional[int] = None) -> List[str]:
    """Toutes les fiches des deux sitemaps WordPress (dédoublonnées)."""
    urls: List[str] = []
    seen = set()
    for sitemap in SITEMAPS:
        try:
            resp = requests.get(sitemap, headers=HEADERS, timeout=60)
            if resp.status_code >= 400:
                log.warning(f"sitemap HTTP {resp.status_code}: {sitemap}")
                continue
        except Exception as e:  # noqa: BLE001
            log.warning(f"sitemap injoignable {sitemap}: {e}")
            continue
        for loc in _tag_values(resp.text, "loc"):
            if loc not in seen:
                seen.add(loc)
                urls.append(loc)
    if limit:
        urls = urls[:limit]
    return urls


def _clean_name(raw: str) -> str:
    name = html.unescape(str(raw or ""))
    name = name.replace("\xad", "").replace("\u200b", "")
    name = NAME_SPLIT_RE.split(name, maxsplit=1)[0]
    return re.sub(r"\s+", " ", name).strip()[:80]


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
    if not host or any(d in host for d in DIRECTORY_HOSTS):
        return None
    if any(s in host for s in SOCIAL_HOSTS):
        return None
    return url


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


def _description(soup: BeautifulSoup) -> str:
    meta = soup.find("meta", attrs={"name": "description"})
    text = html.unescape(meta.get("content", "")) if meta else ""
    if not text:
        first_p = soup.find("p")
        text = first_p.get_text(" ", strip=True) if first_p else ""
    return re.sub(r"\s+", " ", text).strip()[:600]


def parse_profile(page_html: str) -> Optional[Dict]:
    """Parse une fiche -> dict entreprise (ou None si non exploitable)."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None

    name = _clean_name(h1.get_text(" ", strip=True))
    if not name:
        return None

    website = None
    email = None
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.lower().startswith("mailto:") and not email:
            email = _clean_email(href)
            continue
        if not website:
            website = _clean_website(href)
    if not website:
        return None

    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        return None
    if not domain or "." not in domain:
        return None

    description = _description(soup)
    return {
        "name": name,
        "domain": domain,
        "website": website,
        "email": email,
        "city": None,
        "country": "FR",
        "market": "fr",
        "sector": _guess_sector(f"{name} {description}"),
        "description": description,
        "employees": None,
        "linkedin_url": None,
        "source": "annuaires_seo",
    }


def fetch_profile(url: str) -> Optional[Dict]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=HTTP_TIMEOUT)
    except Exception:  # noqa: BLE001
        return None
    if resp.status_code >= 400:
        return None
    return parse_profile(resp.text)
