"""
Découverte d'agences SEO depuis Sortlist.

Deux classements sont supportés :
  - `/fr/seo` : top francophone global (page 1 = 20, page 2 = 100 suivantes) ;
  - `/seo/france-fr` : top France (1 691 agences, pages de 20 puis 100).

Chaque fiche fournit nom, site officiel, description, ville et taille. On ne garde
que les marchés francophones ciblés (FR, BE, CH, LU). `site_harvest` complète
ensuite les emails sur le site de l'agence.

`directory_sortlist_fr.py` utilise le classement France avec quatre pages et son
propre cache. Le module reste paramétrable via `SortlistDirectory`.
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

BASE = "https://www.sortlist.com"
LISTING = BASE + "/fr/seo"
CACHE = Path("data/output/sortlist_agencies.json")
MAX_PAGES = 2
HTTP_TIMEOUT = 30
REQUEST_DELAY = 0.4
TARGET_COUNTRIES = ("FR", "BE", "CH", "LU")
COUNTRY_NAMES = {
    "FR": ("france",),
    "BE": ("belgique", "belgium"),
    "CH": ("suisse", "switzerland"),
    "LU": ("luxembourg",),
}
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com", "pinterest.")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Referer": LISTING,
}

_thread_local = threading.local()


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
        log.warning(f"sortlist injoignable {url}: {str(e)[:90]}")
        return None


def _is_social(host: str) -> bool:
    host = (host or "").lower()
    return any(host == h or host.endswith("." + h) for h in SOCIAL_HOSTS)


def _clean_website(raw: str) -> Optional[str]:
    raw = html.unescape(str(raw or "")).strip()
    if not raw or raw.lower().startswith(("mailto:", "tel:", "javascript:")):
        return None
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or _is_social(parsed.netloc):
        return None
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def _html_text(raw: str) -> str:
    text = BeautifulSoup(html.unescape(str(raw or "")), "html.parser")
    clean = " ".join(text.get_text(" ", strip=True).split())
    clean = re.sub(r"\s+([,.;:!?])", r"\1", clean)
    return clean[:800]


def _country_from_address(address: str) -> Optional[str]:
    text = (address or "").lower()
    for code, names in COUNTRY_NAMES.items():
        if any(name in text for name in names):
            return code
    return None


def _city_from_address(address: str) -> Optional[str]:
    parts = [p.strip() for p in (address or "").split(",") if p.strip()]
    return parts[0][:80] if parts else None


def _company_from_agency(attrs: Dict, profile_url: str) -> Optional[Tuple[str, Dict]]:
    website = _clean_website(attrs.get("website"))
    if not website:
        return None
    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = (urlparse(website).netloc or "").lower()
    if not domain or "." not in domain:
        return None

    address = (attrs.get("address") or {}).get("fr") or ""
    country = attrs.get("registration_number_iso31661")
    if country not in TARGET_COUNTRIES:
        country = _country_from_address(address)
    if country not in TARGET_COUNTRIES:
        return None

    name = " ".join(str(attrs.get("name") or "").split())
    if not name:
        return None
    description = _html_text(attrs.get("description")) or _html_text(attrs.get("tagline"))
    team_size = attrs.get("team_size")
    employees = str(team_size) if isinstance(team_size, (int, float)) and team_size > 0 else None

    company = {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": None,
        "city": _city_from_address(address),
        "country": country,
        "market": "fr",
        "sector": "agence SEO",
        "description": description,
        "employees": employees,
        "linkedin_url": None,
        "source": "sortlist",
    }
    return profile_url, company


def parse_listing(page_html: str, url: str = LISTING) -> List[Tuple[str, Dict]]:
    """Parse une page Sortlist -> [(url_fiche, entreprise), ...]."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    script = soup.find("script", id="__NEXT_DATA__")
    if not script or not script.string:
        return []
    try:
        data = json.loads(script.string)["props"]["pageProps"]["data"]
    except (KeyError, TypeError, ValueError):
        return []

    entries: List[Tuple[str, Dict]] = []
    seen = set()
    for section in ("organicAgencies", "paidAgencies"):
        block = data.get(section) or {}
        included = {item.get("id"): item for item in block.get("included", [])}
        for position in block.get("data", []):
            agency_id = (position.get("relationships", {})
                         .get("agency", {}).get("data", {}).get("id"))
            agency = included.get(agency_id)
            if not agency:
                continue
            attrs = agency.get("attributes") or {}
            slug = attrs.get("slug") or ""
            profile_url = urljoin(url, f"/agency/{slug}") if slug else url
            parsed = _company_from_agency(attrs, profile_url)
            if parsed is None or parsed[1]["domain"] in seen:
                continue
            seen.add(parsed[1]["domain"])
            entries.append(parsed)
    return entries


class SortlistDirectory:
    """Client paramétrable pour un classement Sortlist et son cache local."""

    def __init__(self, listing: str = LISTING, cache: Path = CACHE,
                 max_pages: int = MAX_PAGES, source: str = "sortlist"):
        self.listing = listing
        self.cache = Path(cache)
        self.max_pages = max_pages
        self.source = source
        self.cards: Dict[str, Dict] = {}

    def _load_cache(self) -> Dict[str, Dict]:
        if not self.cache.exists():
            return {}
        try:
            data = json.loads(self.cache.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        if not isinstance(data, dict):
            return {}
        return {str(k): v for k, v in data.items()
                if isinstance(v, dict) and v.get("domain") and v.get("website")}

    def _save_cache(self) -> None:
        try:
            self.cache.parent.mkdir(parents=True, exist_ok=True)
            self.cache.write_text(json.dumps(self.cards, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
        except OSError as e:
            log.warning(f"{self.source}: cache non ecrit: {e}")

    def fetch_profile_urls(self) -> List[str]:
        """Énumère le classement et met les fiches uniques en cache."""
        previous = self._load_cache()
        previous.update(self.cards)
        self.cards.clear()
        self.cards.update(previous)
        seen_domains = {c.get("domain") for c in self.cards.values() if c.get("domain")}

        for page in range(1, self.max_pages + 1):
            page_url = self.listing if page == 1 else f"{self.listing}?page={page}"
            resp = _get(page_url)
            if resp is None:
                break
            try:
                entries = parse_listing(resp.text, resp.url or page_url)
            except Exception as e:  # noqa: BLE001 - page malformée
                log.warning(f"{self.source}: listing illisible page {page}: {e}")
                break
            new = 0
            for profile_url, company in entries:
                company = dict(company)
                company["source"] = self.source
                if profile_url in self.cards or company["domain"] in seen_domains:
                    continue
                self.cards[profile_url] = company
                seen_domains.add(company["domain"])
                new += 1
            log.info(f"{self.source} page {page}: {len(entries)} fiches, {new} nouvelles")
            if not entries or (page > 1 and new == 0):
                break
            if page < self.max_pages:
                time.sleep(REQUEST_DELAY)

        if not self.cards and previous:
            self.cards.update(previous)
            log.warning(f"{self.source}: listing inaccessible, utilisation du cache")
        if self.cards:
            self._save_cache()
        log.info(f"{self.source}: {len(self.cards)} agences uniques")
        return sorted(self.cards)

    def fetch_profile(self, url: str) -> Optional[Dict]:
        """Retourne la fiche mémorisée par le listing (aucune requête profil)."""
        cached = self.cards.get(url)
        if cached and cached.get("domain") and cached.get("website"):
            return dict(cached)
        return None


_default = SortlistDirectory()


def fetch_profile_urls() -> List[str]:
    """Énumère le classement Sortlist par défaut et met les fiches en cache."""
    return _default.fetch_profile_urls()


def fetch_profile(url: str) -> Optional[Dict]:
    """Retourne la fiche mémorisée par le listing par défaut."""
    return _default.fetch_profile(url)
