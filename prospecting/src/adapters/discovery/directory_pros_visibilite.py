"""
Découverte des agences SEO depuis pros-de-la-visibilite.fr.

Principe :
  1. la page `/annuaire/agence-seo` liste 30 agences ; les pages ville,
     spécialité, secteur et CMS sont accessibles depuis la navigation ;
  2. chaque fiche a l'URL `/annuaire/agence-seo/<domaine>` : le domaine est
     directement le site officiel de l'agence ;
  3. on énumère les pages de listing, on déduplique les domaines et on met le
     résultat en cache local pour éviter de re-solliciter le site ;
  4. `fetch_profile` lit le nom (h1), le site (« Visiter le site »), la
     description et la ville, puis site_harvest complète les emails.

Le site limite le débit : requêtes séquentielles pour les listings, petit
délai entre les fiches, retries et cache de secours en cas de blocage.
"""
import html
import re
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.utils import log, normalize_domain

BASE = "https://www.pros-de-la-visibilite.fr"
LISTING = BASE + "/annuaire/agence-seo"
CACHE = Path("data/output/pros_visibilite_domains.txt")
HTTP_TIMEOUT = 20
REQUEST_DELAY = 0.25
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer": LISTING,
}
PROFILE_RE = re.compile(r"/annuaire/agence-seo/([a-z0-9.-]+\.[a-z]{2,})/?$")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com")

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


def _get(session: requests.Session, url: str):
    try:
        return session.get(url, timeout=HTTP_TIMEOUT)
    except Exception as e:  # noqa: BLE001
        log.warning(f"pros-visibilite injoignable {url}: {str(e)[:90]}")
        return None


def _load_cache() -> List[str]:
    if not CACHE.exists():
        return []
    try:
        return [line.strip() for line in
                CACHE.read_text(encoding="utf-8").splitlines() if line.strip()]
    except OSError:
        return []


def _save_cache(domains) -> None:
    try:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text("\n".join(sorted(domains)) + "\n", encoding="utf-8")
    except OSError as e:
        log.warning(f"cache pros-visibilite non ecrit: {e}")


def _listing_urls(page_html: str) -> List[str]:
    """Pages ville/spécialité/secteur listées dans la navigation."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    urls = {LISTING}
    for a in soup.find_all("a", href=True):
        url = urljoin(BASE, a["href"]).split("#", 1)[0].split("?", 1)[0].rstrip("/")
        if not url.startswith(LISTING):
            continue
        last = urlparse(url).path.rstrip("/").split("/")[-1]
        if last == "agence-seo" or not last or "." in last:
            continue
        urls.add(url)
    return sorted(urls)


def _profile_domains(page_html: str) -> List[str]:
    soup = BeautifulSoup(page_html or "", "html.parser")
    domains: List[str] = []
    for a in soup.find_all("a", href=True):
        match = PROFILE_RE.search(a["href"])
        if match:
            domains.append(match.group(1).lower())
    return domains


def _urls_from_domains(domains, limit: Optional[int] = None) -> List[str]:
    urls = [f"{LISTING}/{domain}" for domain in sorted(set(domains))]
    return urls[:limit] if limit else urls


def fetch_profile_urls(limit: Optional[int] = None) -> List[str]:
    """Énumère les listings, déduplique les domaines, met en cache."""
    cached = _load_cache()
    session = _get_session()
    home = _get(session, BASE + "/")
    if home is None or home.status_code >= 400:
        return _urls_from_domains(cached, limit)

    domains = set(_profile_domains(home.text))
    listings = _listing_urls(home.text)
    for url in listings:
        time.sleep(REQUEST_DELAY)
        resp = _get(session, url)
        if resp is None or resp.status_code >= 400:
            continue
        domains.update(_profile_domains(resp.text))

    if domains:
        _save_cache(domains)
        log.info(f"pros-visibilite: {len(domains)} agences uniques")
        return _urls_from_domains(domains, limit)

    log.warning("pros-visibilite: aucun domaine trouve, utilisation du cache")
    return _urls_from_domains(cached, limit)


def _clean_email(raw) -> Optional[str]:
    email = html.unescape(str(raw or "")).strip().lower()
    if email.startswith("mailto:"):
        email = email[7:]
    match = EMAIL_RE.search(email)
    return match.group(0) if match else None


def _clean_website(url: str, fallback_domain: str) -> str:
    url = html.unescape(str(url or "")).strip()
    if not url:
        return f"https://{fallback_domain}"
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    host = (urlparse(url).netloc or "").lower()
    if (not host or "pros-de-la-visibilite" in host
            or any(s in host for s in SOCIAL_HOSTS)):
        return f"https://{fallback_domain}"
    return url


def parse_profile(page_html: str, url: str = "") -> Optional[Dict]:
    """Parse une fiche agence -> dict entreprise (ou None)."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None
    name = h1.get_text(" ", strip=True)
    name = re.sub(r",?\s*agence\s+seo.*$", "", name, flags=re.IGNORECASE).strip()
    if not name:
        return None

    match = PROFILE_RE.search(url or "")
    slug_domain = match.group(1).lower() if match else ""
    website = None
    for a in soup.find_all("a", href=True):
        if "visiter le site" in a.get_text(" ", strip=True).lower():
            website = a["href"]
            break
    website = _clean_website(website, slug_domain or "example.com")
    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = slug_domain
    if not domain or "." not in domain:
        domain = slug_domain
    if not domain or "." not in domain:
        return None

    description = ""
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        description = html.unescape(meta["content"]).strip()
    if not description:
        meta = soup.find("meta", attrs={"property": "og:description"})
        if meta and meta.get("content"):
            description = html.unescape(meta["content"]).strip()
    if not description:
        main = soup.find("main") or soup.find("article")
        paragraph = main.find("p") if main else None
        if paragraph:
            description = paragraph.get_text(" ", strip=True)

    city = None
    for text in soup.stripped_strings:
        city_match = re.search(r"([A-ZÀ-Ÿ][\w'’ -]{1,40})\s*\((\d{5})\)", text)
        if city_match:
            city = city_match.group(1).strip()
            break

    email = None
    mailto = soup.find("a", href=re.compile(r"^mailto:", re.I))
    if mailto:
        email = _clean_email(mailto.get("href"))
    if not email:
        email = _clean_email(description)

    return {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": email,
        "city": city,
        "country": "FR",
        "market": "fr",
        "sector": "agence SEO",
        "description": description[:600],
        "employees": None,
        "linkedin_url": None,
        "source": "pros_visibilite",
    }


def fetch_profile(url: str) -> Optional[Dict]:
    time.sleep(REQUEST_DELAY)
    resp = _get(_get_session(), url)
    if resp is None or resp.status_code >= 400:
        return None
    return parse_profile(resp.text, url)
