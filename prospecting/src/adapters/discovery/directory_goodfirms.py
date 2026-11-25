"""
Découverte d'agences SEO en France depuis GoodFirms.

Principe :
  1. l'annuaire public `/seo-agencies/france` est paginé (48 fiches par page) ;
  2. chaque carte `li.firm-wrapper` contient le nom, le site officiel
     (« Visit Website »), la description et la localisation ;
  3. on mémorise les données de la carte : `fetch_profile` n'a donc pas besoin
     de télécharger une fiche individuelle pour chaque agence ;
  4. site_harvest complète ensuite les emails sur le site de l'agence.

Le site est un annuaire public sans API : les listings sont lus
séquentiellement, avec un petit délai et des retries. Les fiches sans site
officiel sont ignorées (elles ne peuvent pas être enrichies par email).
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

BASE = "https://www.goodfirms.co"
LISTING = BASE + "/seo-agencies/france"
CACHE = Path("data/output/goodfirms_agencies.json")
MAX_PAGES = 10
HTTP_TIMEOUT = 25
REQUEST_DELAY = 0.3
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Referer": LISTING,
}
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com", "pinterest.")
EXCLUDE_HOSTS = ("goodfirms.co", "google.com", "google.fr", "clutch.co",
                 "sortlist.com", "trustpilot.com")

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
        log.warning(f"goodfirms injoignable {url}: {str(e)[:90]}")
        return None


def _is_excluded_host(host: str) -> bool:
    host = (host or "").lower()
    return (not host
            or any(host == h or host.endswith("." + h)
                   for h in SOCIAL_HOSTS + EXCLUDE_HOSTS))


def _clean_website(raw: str, base_url: str) -> Optional[str]:
    """Nettoie un lien « Visit Website » et retire les paramètres de tracking."""
    raw = html.unescape(str(raw or "")).strip()
    if not raw or raw.lower().startswith(("mailto:", "tel:", "javascript:")):
        return None
    url = urljoin(base_url, raw)
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or _is_excluded_host(parsed.netloc):
        return None
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def _clean_description(raw: str) -> str:
    text = " ".join(html.unescape(str(raw or "")).split())
    text = re.sub(r"\s*\.\.\.\s*read\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*read\b.*?reviews?\s*&\s*insights\s*$", "",
                  text, flags=re.IGNORECASE)
    return text.strip()[:600]


def _city_from_location(location: str) -> Optional[str]:
    parts = [part.strip() for part in (location or "").split(",") if part.strip()]
    if not parts:
        return None
    city = parts[0]
    return None if city.lower() == "france" else city[:80]


def _company_from_card(li, base_url: str) -> Optional[Tuple[str, Dict]]:
    profile_a = li.select_one(".firm-name a") or li.select_one('a[href^="/company/"]')
    if profile_a is None or not profile_a.get("href"):
        return None
    raw_profile_url = urljoin(base_url, profile_a["href"]).split("#", 1)[0]
    if raw_profile_url.startswith(BASE + "/company/"):
        profile_url = raw_profile_url
    else:
        # Les cartes « featured » pointent directement vers le site officiel.
        profile_url = _clean_website(raw_profile_url, base_url)
        if not profile_url:
            return None

    name = html.unescape(li.get("entity-name") or
                        profile_a.get_text(" ", strip=True))
    name = " ".join(str(name).split())
    if not name:
        return None

    website_a = li.select_one("a.visit-website") or li.select_one(".firm-urls a[href]")
    website = _clean_website(website_a["href"], base_url) if website_a else None
    if not website:
        return None
    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = (urlparse(website).netloc or "").lower()
    if not domain or "." not in domain:
        return None

    description_el = li.select_one(".firm-short-description")
    description = _clean_description(
        description_el.get_text(" ", strip=True) if description_el else "")
    location_el = li.select_one(".firm-location span")
    location = " ".join(location_el.get_text(" ", strip=True).split()) if location_el else ""

    company = {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": None,
        "city": _city_from_location(location),
        "country": "FR",
        "market": "fr",
        "sector": "agence SEO",
        "description": description,
        "employees": None,
        "linkedin_url": None,
        "source": "goodfirms",
    }
    return profile_url, company


def parse_listing(page_html: str, url: str = LISTING) -> List[Tuple[str, Dict]]:
    """Parse une page de listing -> [(url_fiche, entreprise), ...]."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    entries: List[Tuple[str, Dict]] = []
    seen = set()
    for li in soup.select("li.firm-wrapper"):
        parsed = _company_from_card(li, url)
        if parsed is None or parsed[0] in seen:
            continue
        seen.add(parsed[0])
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
        log.warning(f"goodfirms: cache non ecrit: {e}")


def fetch_profile_urls() -> List[str]:
    """Énumère les pages du listing et met les fiches en cache."""
    previous = _load_cache()
    previous.update(_cards)
    _cards.clear()
    _cards.update(previous)
    for page in range(1, MAX_PAGES + 1):
        page_url = LISTING if page == 1 else f"{LISTING}?page={page}"
        resp = _get(page_url)
        if resp is None:
            break
        try:
            entries = parse_listing(resp.text, resp.url or page_url)
        except Exception as e:  # noqa: BLE001 - annuaire malformé
            log.warning(f"goodfirms: listing illisible page {page}: {e}")
            break
        new = 0
        for profile_url, company in entries:
            if profile_url not in _cards:
                _cards[profile_url] = company
                new += 1
        if entries:
            log.info(f"goodfirms page {page}: {len(entries)} fiches, {new} nouvelles")
        if not entries or (page > 1 and new == 0):
            break
        if page < MAX_PAGES:
            time.sleep(REQUEST_DELAY)

    if not _cards and previous:
        _cards.update(previous)
        log.warning("goodfirms: listing inaccessible, utilisation du cache")
    if _cards:
        _save_cache()
    log.info(f"goodfirms: {len(_cards)} agences uniques")
    return sorted(_cards)


def parse_profile(page_html: str, url: str = "") -> Optional[Dict]:
    """Parse une fiche individuelle (repli si le listing n'a pas été chargé)."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None
    name = " ".join(h1.get_text(" ", strip=True).split())
    if not name:
        return None

    website_a = (soup.select_one("a.visit-website")
                 or next((a for a in soup.find_all("a", href=True)
                          if "visit website" in a.get_text(" ", strip=True).lower()), None))
    website = _clean_website(website_a["href"], url) if website_a else None
    if not website:
        return None
    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = (urlparse(website).netloc or "").lower()
    if not domain or "." not in domain:
        return None

    description = ""
    for attrs in ({"name": "description"}, {"property": "og:description"}):
        meta = soup.find("meta", attrs=attrs)
        if meta and meta.get("content"):
            description = _clean_description(meta["content"])
            if description:
                break

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
        "source": "goodfirms",
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
