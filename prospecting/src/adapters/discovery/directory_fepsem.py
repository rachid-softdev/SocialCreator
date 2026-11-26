"""
Découverte d'agences et de consultants SEO depuis fepsem.org.

Principe :
  1. les pages `/annuaire/agences/` et `/annuaire/consultant-e-s/` listent
     les profils et les pages ville ;
  2. chaque fiche est une URL `/auteur/<slug>/entreprise/` (agence) ou
     `/auteur/<slug>/` (consultant) ;
  3. `fetch_profile` lit le nom, le site officiel (« Site web »), la
     description et l'email éventuel ;
  4. site_harvest complète ensuite les emails sur le site de l'agence.

Le site est un WordPress mis en cache : les requêtes sont séquentielles,
avec un petit délai et des retries. Les profils sans site officiel sont
ignorés (ils ne peuvent pas être enrichis ni contactés par email).
"""
import html
import re
import threading
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.utils import log, normalize_domain

BASE = "https://fepsem.org"
AGENCY_INDEX = f"{BASE}/annuaire/agences/"
CONSULTANT_INDEX = f"{BASE}/annuaire/consultant-e-s/"
HTTP_TIMEOUT = 25
REQUEST_DELAY = 0.15
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
CONSULTANT_RE = re.compile(r"^/auteur/[^/]+/$")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "linkedin.com", "twitter.com",
                "x.com", "youtube.com", "tiktok.com", "pinterest.")

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
    except Exception as e:  # noqa: BLE001
        log.warning(f"fepsem injoignable {url}: {str(e)[:90]}")
        return None


def _city_urls(index_url: str, soup: BeautifulSoup) -> List[str]:
    prefix = index_url.rstrip("/") + "/"
    urls = []
    for a in soup.select("a[href]"):
        href = urljoin(index_url, a["href"]).split("#", 1)[0].split("?", 1)[0]
        if not href.startswith(prefix):
            continue
        if href.rstrip("/") == index_url.rstrip("/"):
            continue
        if href not in urls:
            urls.append(href)
    return urls


def _collect_profile_urls(index_url: str, agency: bool) -> List[str]:
    resp = _get(index_url)
    if resp is None:
        return []
    soup = BeautifulSoup(resp.text, "html.parser")
    pages = [soup]
    for city_url in _city_urls(index_url, soup):
        time.sleep(REQUEST_DELAY)
        city_resp = _get(city_url)
        if city_resp is not None:
            pages.append(BeautifulSoup(city_resp.text, "html.parser"))

    found = set()
    for page in pages:
        if agency:
            links = page.select('a[href*="/auteur/"][href$="/entreprise/"]')
        else:
            links = [
                a for a in page.select("a[href]")
                if CONSULTANT_RE.match(urlparse(urljoin(index_url, a["href"])).path)
            ]
        for a in links:
            href = urljoin(index_url, a["href"]).split("#", 1)[0]
            if href.startswith(BASE + "/auteur/"):
                found.add(href)
    return sorted(found)


def fetch_profile_urls() -> List[str]:
    """Profils agences + consultants, dédupliqués."""
    urls = set(_collect_profile_urls(AGENCY_INDEX, agency=True))
    urls.update(_collect_profile_urls(CONSULTANT_INDEX, agency=False))
    result = sorted(urls)
    log.info(f"fepsem: {len(result)} profils uniques")
    return result


def _clean_email(raw) -> Optional[str]:
    email = html.unescape(str(raw or "")).strip().lower()
    if email.startswith("mailto:"):
        email = email[7:]
    match = EMAIL_RE.search(email)
    return match.group(0) if match else None


def _clean_website(raw: str, base_url: str) -> Optional[str]:
    url = html.unescape(str(raw or "")).strip()
    if not url:
        return None
    url = urljoin(base_url, url)
    if not url.startswith(("http://", "https://")):
        return None
    host = (urlparse(url).netloc or "").lower()
    if not host or "fepsem.org" in host or any(s in host for s in SOCIAL_HOSTS):
        return None
    return url


def parse_profile(page_html: str, url: str = "") -> Optional[Dict]:
    """Parse une fiche agence/consultant -> dict entreprise (ou None)."""
    soup = BeautifulSoup(page_html or "", "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None
    name = re.sub(r"\s+", " ", h1.get_text(" ", strip=True)).strip()
    name = re.sub(r"\s*:\s*membre de la FePSeM.*$", "", name, flags=re.IGNORECASE)
    if not name:
        return None

    is_agency = url.rstrip("/").endswith("/entreprise")
    website = None
    for a in soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", a.get_text(" ", strip=True)).lower()
        if "site web" not in text:
            continue
        candidate = _clean_website(a["href"], url)
        if candidate:
            website = candidate
            break
    if not website:
        return None

    try:
        domain = normalize_domain(website)
    except Exception:  # noqa: BLE001
        domain = (urlparse(website).netloc or "").lower()
    if not domain or "." not in domain:
        return None

    description = ""
    for heading in soup.find_all(["h2", "h3"]):
        if "propos" not in heading.get_text(" ", strip=True).lower():
            continue
        section = heading.find_parent(["section", "div"])
        if section:
            description = " ".join(section.get_text(" ", strip=True).split())
            description = re.sub(
                r"^À propos(?:\s+(?:de l'agence|du consultant|de la consultante))?\s*",
                "", description, flags=re.IGNORECASE,
            ).strip()
        break
    if not description:
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            description = html.unescape(meta["content"]).strip()
    if not description:
        meta = soup.find("meta", attrs={"property": "og:description"})
        if meta and meta.get("content"):
            description = html.unescape(meta["content"]).strip()

    email = None
    mailto = soup.find("a", href=re.compile(r"^mailto:", re.IGNORECASE))
    if mailto:
        email = _clean_email(mailto.get("href"))
    if not email:
        email = _clean_email(description)

    return {
        "name": name[:80],
        "domain": domain,
        "website": website,
        "email": email,
        "city": None,
        "country": "FR",
        "market": "fr",
        "sector": "agence SEO" if is_agency else "consultant SEO",
        "description": description[:600],
        "employees": None,
        "linkedin_url": None,
        "source": "fepsem",
    }


def fetch_profile(url: str) -> Optional[Dict]:
    time.sleep(REQUEST_DELAY)
    resp = _get(url)
    if resp is None:
        return None
    return parse_profile(resp.text, url)
