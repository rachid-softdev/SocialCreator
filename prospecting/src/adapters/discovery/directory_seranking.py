"""Annuaire SE Ranking France : agences SEO et web.

SE Ranking publie un catalogue d'agences localisées en France. La liste est
paginée (30 fiches par page) et chaque fiche de profil expose le site officiel
de l'agence. Les fiches sont mises en cache, puis `site_harvest` complète les
emails sur le site de l'agence.

Particularité : la page de liste ne contient pas le site officiel. Il faut donc
ouvrir chaque profil pour récupérer le domaine. Le cache conserve les métadonnées
de liste (score, ville, services) et les complète avec le site lors du profil.
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

BASE = "https://seranking.com/fr/agencies/location/france/"
CACHE = Path("data/output/seranking_agencies.json")
HTTP_TIMEOUT = 30
REQUEST_DELAY = 0.3
MAX_PAGES = 6
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com", "pinterest.",
                "linktr.ee", "linkin.bio", "beacons.ai")

_thread_local = threading.local()
_cache_lock = threading.Lock()
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
        log.warning(f"seranking injoignable {url}: {str(e)[:90]}")
        return None


def _clean_text(raw: str) -> str:
    return " ".join(html.unescape(str(raw or "")).split())


def _clean_website(raw: str, base_url: str) -> Optional[str]:
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
    if host == "seranking.com" or host.endswith(".seranking.com"):
        return None
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{host}{path}"


def _city_from_label(raw: str) -> Optional[str]:
    label = _clean_text(raw)
    if not label:
        return None
    city = label.split(",", 1)[0].strip()
    return city[:80] if city and city.lower() != "france" else None


def _item_value(card, label: str) -> Optional[str]:
    for item in card.select(".item-agency__item"):
        left = item.select_one(".item-agency__item-left-text")
        right = item.select_one(".item-agency__item-right-text")
        if left and right and _clean_text(left.get_text(" ", strip=True)).lower() == label.lower():
            return _clean_text(right.get_text(" ", strip=True)) or None
    return None


def _score(card) -> Optional[int]:
    el = card.select_one(".item-agency__top-score-number")
    if not el:
        return None
    try:
        return int(_clean_text(el.get_text(" ", strip=True)))
    except ValueError:
        return None


def _sector_from_services(services: Optional[str]) -> str:
    text = (services or "").lower()
    if "seo" in text or "référencement" in text or "referencement" in text:
        return "agence SEO"
    return "agence web"


def _company_from_card(card, page_url: str) -> Optional[Tuple[str, Dict]]:
    profile_a = card.select_one("a.item-agency__profile-link[href]")
    if profile_a is None or not profile_a.get("href"):
        return None
    profile_url = urljoin(BASE, profile_a["href"]).split("#", 1)[0]
    if urlparse(profile_url).path.rstrip("/") in ("/fr/agencies", ""):
        return None
    title = card.select_one(".item-agency__top-title")
    name = _clean_text(title.get_text(" ", strip=True) if title
                       else profile_a.get_text(" ", strip=True))
    if not name:
        return None

    description_el = card.select_one(".item-agency__text")
    services = _item_value(card, "Service")
    location = _item_value(card, "Emplacement")
    company = {
        "name": name[:80],
        "domain": None,
        "website": None,
        "email": None,
        "city": _city_from_label(location) if location else None,
        "country": "FR",
        "market": "fr",
        "sector": _sector_from_services(services),
        "description": (_clean_text(description_el.get_text(" ", strip=True))
                        if description_el else "")[:600],
        "employees": None,
        "linkedin_url": None,
        "source": "seranking",
        "score": _score(card),
        "services": services,
        "profile_url": profile_url,
    }
    return profile_url, company


def parse_listing(page_html: str, page_url: str = BASE) -> List[Tuple[str, Dict]]:
    """Parse une page de liste -> [(url_profil, entreprise), ...]."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    entries: List[Tuple[str, Dict]] = []
    seen_urls = set()
    for card in soup.select("article.item-agency"):
        parsed = _company_from_card(card, page_url)
        if parsed is None:
            continue
        profile_url, company = parsed
        if profile_url in seen_urls:
            continue
        seen_urls.add(profile_url)
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
            if isinstance(v, dict) and v.get("name")}


def _save_cache() -> None:
    with _cache_lock:
        try:
            CACHE.parent.mkdir(parents=True, exist_ok=True)
            CACHE.write_text(json.dumps(_cards, ensure_ascii=False, indent=2),
                             encoding="utf-8")
        except OSError as e:
            log.warning(f"seranking: cache non ecrit: {e}")


def fetch_profile_urls() -> List[str]:
    """Lit toutes les pages de liste et mémorise les profils à visiter."""
    previous = _load_cache()
    _cards.clear()
    _cards.update(previous)

    for page in range(1, MAX_PAGES + 1):
        page_url = BASE if page == 1 else f"{BASE}?page={page}"
        resp = _get(page_url)
        if resp is None:
            break
        try:
            entries = parse_listing(resp.text, page_url)
        except Exception as e:  # noqa: BLE001 - annuaire malformé
            log.warning(f"seranking: page illisible {page_url}: {e}")
            break
        if not entries:
            break
        new = 0
        for profile_url, company in entries:
            cached = _cards.get(profile_url)
            if cached is not None:
                for key in ("name", "city", "sector", "description", "score", "services"):
                    if company.get(key) is not None:
                        cached[key] = company[key]
                continue
            _cards[profile_url] = company
            new += 1
        log.info(f"seranking page {page}: {len(entries)} fiches, {new} nouvelles")
        time.sleep(REQUEST_DELAY)

    if _cards:
        _save_cache()
    log.info(f"seranking: {len(_cards)} agences uniques")
    return sorted(_cards)


def parse_profile(page_html: str, url: str = "") -> Optional[Dict]:
    """Parse une fiche agence et retourne l'entreprise complète."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    h1 = soup.select_one("h1.top-block__main-title") or soup.find("h1")
    if not h1:
        return None
    name = _clean_text(h1.get_text(" ", strip=True))
    if not name:
        return None

    website_a = soup.select_one("a.top-block__site-link[href]")
    if website_a is None:
        website_a = next(
            (a for a in soup.find_all("a", href=True)
             if (a.get("href") or "").startswith(("http://", "https://"))),
            None,
        )
    website = _clean_website(website_a["href"], url) if website_a else None
    if not website:
        return None
    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = (urlparse(website).netloc or "").lower()
    if not domain or "." not in domain:
        return None

    description_el = soup.select_one(".top-block__description")
    if description_el:
        description = _clean_text(description_el.get_text(" ", strip=True))
    else:
        meta = soup.find("meta", attrs={"name": "description"})
        description = _clean_text(meta["content"]) if meta and meta.get("content") else ""

    location = None
    for item in soup.select(".top-block__agency-item"):
        left = item.select_one(".top-block__agency-item-left")
        right = item.select_one(".top-block__agency-item-right")
        if left and right and "siège social" in _clean_text(
                left.get_text(" ", strip=True)).lower():
            location = _clean_text(right.get_text(" ", strip=True))
            break

    return {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": None,
        "city": _city_from_label(location) if location else None,
        "country": "FR",
        "market": "fr",
        "sector": "agence SEO",
        "description": description[:600],
        "employees": None,
        "linkedin_url": None,
        "source": "seranking",
        "profile_url": url,
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
    company = parse_profile(resp.text, url)
    if not company:
        return None
    if cached:
        for key in ("name", "description", "city", "sector", "score", "services"):
            if cached.get(key):
                company[key] = cached[key]
        company["profile_url"] = url
    _cards[url] = company
    _save_cache()
    return dict(company)
