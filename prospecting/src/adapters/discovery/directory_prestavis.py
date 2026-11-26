"""Annuaire Prestavis : agences SEO, web et développement d'applications.

Prestavis publie des fiches classées par Score Prestavis, avec le site officiel
de chaque prestataire. Les pages de catégorie sont statiques : un seul GET par
catégorie suffit, sans pagination ni API. Les cartes sont mises en cache, puis
`site_harvest` complète les emails sur le site de l'agence.

Catégories couvertes (fiches uniques, dédoublonnées par domaine) :
  - /annuaire/agence-seo/ (64 fiches) ;
  - /annuaire/agence-web/ (64 fiches) ;
  - /annuaire/agence-developpement-application/ (28 fiches).
"""
import html
import json
import re
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.utils import log, normalize_domain

BASE = "https://www.prestavis.com"
CATEGORIES = (
    ("/annuaire/agence-seo/", "agence SEO"),
    ("/annuaire/agence-web/", "agence web"),
    ("/annuaire/agence-developpement-application/",
     "agence de développement d'applications"),
)
CACHE = Path("data/output/prestavis_agencies.json")
HTTP_TIMEOUT = 30
REQUEST_DELAY = 0.3
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com", "pinterest.")

_thread_local = threading.local()
_cards: Dict[str, Dict] = {}


def _get_session() -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(HEADERS)
        retry = Retry(total=2, connect=2, read=2, backoff_factor=1.0,
                      status_forcelist=(429, 500, 502, 503, 504),
                      allowed_methods=frozenset(["GET"]))
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        _thread_local.session = session
    return session


def _get(url: str):
    try:
        resp = _get_session().get(url, timeout=HTTP_TIMEOUT)
        if resp.status_code >= 400:
            return None
        if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
            resp.encoding = resp.apparent_encoding or "utf-8"
        return resp
    except Exception as e:  # noqa: BLE001 - erreur réseau non fatale
        log.warning(f"prestavis injoignable {url}: {str(e)[:90]}")
        return None


def _clean_text(raw: str) -> str:
    return " ".join(html.unescape(str(raw or "")).split())


def _clean_website(raw: str, base_url: str) -> Optional[str]:
    """Nettoie un lien externe et retire les paramètres de tracking Prestavis."""
    raw = html.unescape(str(raw or "")).strip()
    if not raw or raw.lower().startswith(("mailto:", "tel:", "javascript:")):
        return None
    url = urljoin(base_url, raw)
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if parsed.scheme not in ("http", "https") or not host:
        return None
    if any(host == h or host.endswith("." + h) for h in SOCIAL_HOSTS):
        return None
    if host == "prestavis.com" or host.endswith(".prestavis.com"):
        return None
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{host}{path}"


def _city_from_label(raw: str) -> Optional[str]:
    label = _clean_text(raw)
    match = re.match(r"^(.*?)\s*\([^)]*\)\s*$", label)
    city = match.group(1).strip() if match else label
    return city[:80] if city else None


def _employees_from_facts(card) -> Optional[str]:
    for li in card.select("ul.pv-card__facts li"):
        text = _clean_text(li.get_text(" ", strip=True))
        if "salari" in text.lower():
            return text[:40]
    return None


def _company_from_card(card, page_url: str, sector: str) -> Optional[Tuple[str, Dict]]:
    profile_a = card.select_one("h2 a[href]") or card.select_one(
        'a[href^="/entreprise/"]')
    if profile_a is None or not profile_a.get("href"):
        return None
    profile_url = urljoin(BASE, profile_a["href"]).split("#", 1)[0]
    name = _clean_text(profile_a.get_text(" ", strip=True))
    if not name:
        return None

    website_a = card.select_one("a[data-sortie][href]")
    if website_a is None:
        website_a = next(
            (a for a in card.find_all("a", href=True)
             if a["href"].startswith(("http://", "https://"))),
            None)
    website = _clean_website(website_a["href"], page_url) if website_a else None
    if not website:
        return None
    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = (urlparse(website).netloc or "").lower()
    if not domain or "." not in domain:
        return None

    city_el = card.select_one(".pv-card__id p")
    services_el = card.select_one(".pv-card__services")
    description = _clean_text(services_el.get_text(" ", strip=True)) if services_el else ""
    company = {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": None,
        "city": _city_from_label(city_el.get_text(" ", strip=True)) if city_el else None,
        "country": "FR",
        "market": "fr",
        "sector": sector,
        "description": description[:600],
        "employees": _employees_from_facts(card),
        "linkedin_url": None,
        "source": "prestavis",
    }
    return profile_url, company


def parse_listing(page_html: str, sector: str = "agence SEO") -> List[Tuple[str, Dict]]:
    """Parse une page de catégorie -> [(url_fiche, entreprise), ...]."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    entries: List[Tuple[str, Dict]] = []
    seen_urls = set()
    seen_domains = set()
    for card in soup.select("article.pv-card"):
        parsed = _company_from_card(card, BASE, sector)
        if parsed is None:
            continue
        profile_url, company = parsed
        if profile_url in seen_urls or company["domain"] in seen_domains:
            continue
        seen_urls.add(profile_url)
        seen_domains.add(company["domain"])
        entries.append(parsed)
    return entries


def _load_cache() -> Dict[str, Dict]:
    if not CACHE.exists():
        return {}
    try:
        data = json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(k): v for k, v in data.items()
            if isinstance(v, dict) and v.get("domain") and v.get("website")}


def _save_cache() -> None:
    try:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(_cards, ensure_ascii=False, indent=2),
                         encoding="utf-8")
    except OSError as e:
        log.warning(f"prestavis: cache non ecrit: {e}")


def fetch_profile_urls() -> List[str]:
    """Lit les catégories, dédoublonne par domaine et met les fiches en cache."""
    previous = _load_cache()
    _cards.clear()
    _cards.update(previous)
    known_domains = {c.get("domain") for c in _cards.values() if c.get("domain")}

    for path, sector in CATEGORIES:
        page_url = BASE + path
        resp = _get(page_url)
        if resp is None:
            continue
        try:
            entries = parse_listing(resp.text, sector)
        except Exception as e:  # noqa: BLE001 - annuaire malformé
            log.warning(f"prestavis: page illisible {page_url}: {e}")
            continue
        new = 0
        for profile_url, company in entries:
            if company["domain"] in known_domains:
                continue
            _cards[profile_url] = company
            known_domains.add(company["domain"])
            new += 1
        log.info(f"prestavis {sector}: {len(entries)} fiches, {new} nouvelles")
        time.sleep(REQUEST_DELAY)

    if _cards:
        _save_cache()
    log.info(f"prestavis: {len(_cards)} agences uniques")
    return sorted(_cards)


def parse_profile(page_html: str, url: str = "") -> Optional[Dict]:
    """Parse une fiche individuelle (repli si le cache est absent)."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None
    name = _clean_text(h1.get_text(" ", strip=True))
    if not name:
        return None
    website_a = soup.select_one("a[data-sortie][href]")
    website = _clean_website(website_a["href"], url) if website_a else None
    if not website:
        return None
    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = (urlparse(website).netloc or "").lower()
    if not domain or "." not in domain:
        return None
    meta = soup.find("meta", attrs={"name": "description"})
    description = _clean_text(meta["content"])[:600] if meta and meta.get("content") else ""
    return {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": None,
        "city": None,
        "country": "FR",
        "market": "fr",
        "sector": "agence SEO",
        "description": description,
        "employees": None,
        "linkedin_url": None,
        "source": "prestavis",
    }


def fetch_profile(url: str) -> Optional[Dict]:
    """Retourne la fiche mémorisée, ou parse la page de profil en repli."""
    cached = _cards.get(url)
    if cached and cached.get("domain") and cached.get("website"):
        return dict(cached)
    time.sleep(REQUEST_DELAY)
    resp = _get(url)
    if resp is None:
        return None
    return parse_profile(resp.text, url)
