"""
Site enrichment adapter: email extraction, contact discovery, decision-maker detection.

Handles:
- Crawling /contact, /mentions-legales, /impressum, /about, /team paths
- Extracting mailto: links and raw email addresses from HTML
- Pattern-based email generation (prenom.nom@domain.fr, p.nom@domain.fr, ...)
- Decision-maker name extraction from site HTML
"""

import os
import re
import smtplib
import socket
from collections import defaultdict
from dataclasses import dataclass, field
from html import unescape
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from src.utils import log
from .contact_extractor import scan_html, looks_like_noise


# ============================================================
# CONFIG
# ============================================================

HTTP_TIMEOUT = 10
# Max pages crawled per site per enrich run (configurable via MAX_PAGES env var)
MAX_PAGES = int(os.environ.get("MAX_PAGES", "6"))
MAX_HOME_TEXT = 4000
MAX_HTML_BYTES = 2 * 1024 * 1024

# Optional JS-rendered page fallback. Set SITE_HARVEST_JS=1 to enable when
# requests-html is installed (renders pages before extracting emails).
SITE_HARVEST_JS = os.environ.get("SITE_HARVEST_JS", "0").lower() in ("1", "true", "yes")

# Email regex for text-based extraction (scan_html handles structured sources)
EMAIL_REGEX = re.compile(
    r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}",
    re.IGNORECASE,
)
STRICT_EMAIL_REGEX = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.IGNORECASE,
)

# Priority paths for contact/email extraction.
# Order matters: most likely to contain emails first.
EMAIL_PRIORITY_PATHS = [
    "/contact", "/contact/", "/contact-us", "/contact-us/",
    "/about", "/about/", "/team", "/team/", "/team/leadership",
    "/leadership", "/management", "/management/", "/about-us",
    "/about-us/", "/about/team", "/team/members",
    "/nous-contacter", "/contactez-nous", "/equipe",
    "/impressum", "/imprint", "/legal", "/mentions-legales", "/legal-notice",
    "/datenschutz", "/privacy", "/privacy-policy",
    "/mentions-legales/", "/datenschutz/",
    "/cookies", "/rgpd",
]

# Generic email prefixes to exclude (too generic to be a real contact)
GENERIC_EMAIL_PREFIXES = {
    "contact", "info", "hello", "support", "admin", "sales",
    "marketing", "team", "office", "hr", "careers", "jobs",
    "recruiting", "press", "media", "legal", "privacy",
    "security", "abuse", "noreply", "no-reply", "donotreply",
    "postmaster", "webmaster", "hostmaster",
}

# Title → priority for decision-maker detection
TITLE_PRIORITY = {
    "ceo": 100, "chief executive officer": 100, "founder": 95,
    "co-founder": 95, "cofounder": 95, "president": 90,
    "managing director": 85, "directeur general": 85,
    "directeur général": 85, "vp sales": 80, "head of sales": 80,
    "director of sales": 80, "sales director": 80,
    "vp marketing": 75, "head of marketing": 75, "cmo": 75,
    "chief marketing officer": 75, "vp growth": 75,
    "head of growth": 75, "growth lead": 70,
    "cto": 70, "chief technology officer": 70,
    "vp engineering": 65, "head of engineering": 65,
    "coo": 60, "chief operating officer": 60,
    "vp operations": 60, "head of operations": 60,
}

# Valid TLDs (anti-false-positives)
VALID_TLDS = {
    "com", "fr", "net", "org", "io", "co", "ai", "tech", "app",
    "dev", "eu", "be", "ch", "ca", "uk", "de", "es", "it", "nl",
    "us", "me", "tv", "gg", "so", "to", "ly", "md", "pro", "xyz",
}


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class PageResult:
    url: str
    html: str
    emails: List[str]
    links: List[str]


@dataclass
class HarvestResult:
    """Result of harvesting a company site for contacts."""
    domain: str
    emails: List[str] = field(default_factory=list)
    pattern_emails: List[str] = field(default_factory=list)
    decision_makers: List[Dict[str, Any]] = field(default_factory=list)
    home_text: str = ""
    pages_crawled: int = 0
    signals: Dict[str, float] = field(default_factory=dict)


# ============================================================
# EMAIL EXTRACTION
# ============================================================

def _sanitize_email(email: str) -> str:
    """Clean an extracted email string."""
    email = unescape(email).strip()
    email = email.strip(".'\"<>[](){}")
    return email.lower()


def _is_valid_email(email: str) -> bool:
    """Validate syntax + TLD."""
    if not email or len(email) > 254:
        return False
    if not EMAIL_REGEX.fullmatch(email):
        return False
    tld = email.split("@")[-1].split(".")[-1].lower()
    if tld not in VALID_TLDS:
        return False
    return True


def _extract_emails_from_html(html: str, base_url: str) -> List[str]:
    """Extract email addresses from HTML using contact_extractor.scan_html.
    
    This handles:
    - mailto: links
    - Plain text emails
    - Cloudflare data-cfemail obfuscation
    - JSON-LD email fields
    - data-email, data-contact, data-mail attributes
    - looks_like_noise filtering
    """
    # Use the shared scan_html from contact_extractor
    found = scan_html(html)
    # Extract just the email strings, deduped
    emails: Set[str] = set()
    for email, _src in found:
        email = email.strip().lower()
        if not email or "@" not in email:
            continue
        if not looks_like_noise(email):
            emails.add(email)
    return sorted(emails)


# ============================================================
# PAGE FETCHING
# ============================================================

def _fetch_page(url: str, timeout: int = HTTP_TIMEOUT) -> Optional[PageResult]:
    """Fetch a page, extract emails and links. Returns PageResult or None."""
    try:
        html = None
        resp = None

        # Optional JS rendering fallback (env var: SITE_HARVEST_JS=1)
        if SITE_HARVEST_JS:
            html = _fetch_with_requests_html(url, timeout)
            if html is None:
                html = _fetch_with_requests_html(url, timeout, retry=True)
        if html is None:
            resp = requests.get(
                url,
                timeout=timeout,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                },
                allow_redirects=True,
            )
            resp.raise_for_status()

            if len(resp.content) > MAX_HTML_BYTES:
                resp = requests.get(url, timeout=timeout, stream=True)
                content = b""
                for chunk in resp.iter_content(8192):
                    content += chunk
                    if len(content) > MAX_HTML_BYTES:
                        break
            else:
                content = resp.content

            html = content.decode("utf-8", errors="ignore")

        soup = BeautifulSoup(html, "html.parser")

        # Emails
        emails = _extract_emails_from_html(html, url)

        # Internal links
        base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        links: List[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            full = urljoin(base, href)
            if urlparse(full).netloc == urlparse(base).netloc:
                links.append(full)

        return PageResult(url=url, html=html, emails=emails, links=links)

    except Exception as e:
        log.debug(f"Fetch failed {url}: {e}")
        return None


def _fetch_with_requests_html(url: str, timeout: int = HTTP_TIMEOUT, retry: bool = False) -> Optional[str]:
    """Fetch page via requests-html (JS rendering) when available.
    
    Only called when SITE_HARVEST_JS env var is enabled.
    Returns raw HTML string or None on failure.
    """
    try:
        import requests_html  # noqa: F401
        from requests_html import HTMLSession
        session = HTMLSession()
        r = session.get(url, timeout=timeout)
        if not r.ok:
            return None
        return r.html.html
    except Exception as e:
        log.debug(f"requests-html fetch failed for {url}: {e}")
        if retry:
            # Retry once with fresh session
            try:
                from requests_html import HTMLSession
                session = HTMLSession()
                r = session.get(url, timeout=timeout)
                if r.ok:
                    return r.html.html
            except Exception as e2:
                log.debug(f"requests-html retry failed for {url}: {e2}")
                return None
        return None


# ============================================================
# DECISION MAKER EXTRACTION
# ============================================================

DECISION_MAKER_PATTERNS = [
    # "Name - Title" or "Name, Title"
    re.compile(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*[-–—|,]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)"),
    # Team grid patterns
    re.compile(r"class=[\"']team-member[\"'][^>]*>([^<]+)<", re.IGNORECASE),
    re.compile(r"class=[\"']member-name[\"'][^>]*>([^<]+)<", re.IGNORECASE),
]


def _extract_decision_makers(html: str, base_url: str) -> List[Dict[str, Any]]:
    """Extract decision-maker names from HTML content."""
    makers: List[Dict[str, Any]] = []
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)

    # Name - Title patterns
    for pattern in DECISION_MAKER_PATTERNS:
        for match in pattern.finditer(text):
            name = match.group(1).strip()
            title = match.group(2).strip()
            if len(name.split()) >= 2 and len(title) > 2:
                priority = 0
                for kw, pts in TITLE_PRIORITY.items():
                    if kw in title.lower():
                        priority = pts
                        break
                if priority > 0:
                    makers.append({
                        "full_name": name,
                        "function": title,
                        "priority": priority,
                        "source": "site_harvest",
                    })

    # LinkedIn links
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "linkedin.com/in/" in href:
            name = a.get_text(strip=True)
            if name and len(name.split()) >= 2:
                makers.append({
                    "full_name": name,
                    "function": "LinkedIn profile",
                    "linkedin_url": href,
                    "priority": 50,
                    "source": "linkedin_link",
                })

    # Dedup by normalized name
    seen: Set[str] = set()
    unique: List[Dict[str, Any]] = []
    for m in sorted(makers, key=lambda x: -x.get("priority", 0)):
        key = _normalize_name(m["full_name"])
        if key not in seen:
            seen.add(key)
            unique.append(m)

    return unique[:5]


def _normalize_name(name: str) -> str:
    """Normalize a name for dedup comparison."""
    return re.sub(r"[^a-z]+", "", name.lower())


# ============================================================
# EMAIL PATTERN GENERATION
# ============================================================

def _generate_email_patterns(decision_makers: List[Dict], domain: str) -> List[str]:
    """
    Generate plausible email addresses from decision-maker names.

    Patterns: prenom.nom@domaine, p.nom@domaine, prenom@domaine.
    Returns a list of unique email addresses.
    """
    emails: Set[str] = set()
    if not domain:
        return []

    for maker in decision_makers:
        full_name = (maker.get("full_name") or "").strip()
        if not full_name:
            continue
        parts = full_name.split()
        if len(parts) < 2:
            continue

        firstname = parts[0].lower()
        lastname = parts[-1].lower()
        # Remove accents
        firstname = _strip_accents(firstname)
        lastname = _strip_accents(lastname)

        # prenom.nom@domain
        emails.add(f"{firstname}.{lastname}@{domain}")
        # p.nom@domain (initial)
        emails.add(f"{firstname[0]}.{lastname}@{domain}")
        # prenom@domain
        emails.add(f"{firstname}@{domain}")
        # prenomnom@domain (no separator)
        emails.add(f"{firstname}{lastname}@{domain}")

    return sorted(emails)


def _strip_accents(text: str) -> str:
    """Remove diacritics for email generation (é -> e)."""
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# ============================================================
# MAIN HARVEST FUNCTION
# ============================================================

def harvest_site(domain: str) -> HarvestResult:
    """
    Crawl a company site and extract emails, decision makers, and signals.

    Returns a HarvestResult with:
    - emails: raw emails extracted from site (excluding generic prefixes)
    - pattern_emails: generated emails from decision makers
    - decision_makers: list of {full_name, function, priority}
    - signals: business signals (cold email, outbound, etc.)
    """
    if not domain:
        return HarvestResult(domain="")

    # Try HTTPS then HTTP
    base_url = f"https://{domain}"
    for proto in ("https://", "http://"):
        test_url = proto + domain
        try:
            resp = requests.head(test_url, timeout=5, allow_redirects=True)
            if resp.status_code < 400:
                base_url = test_url
                break
        except Exception:
            continue

    visited: Set[str] = set()
    # (url, depth): home=0, priority pages=1, discovered links=2
    to_visit: List[Tuple[str, int]] = [(base_url, 0)]
    MAX_LINK_DEPTH = 2
    all_emails: Set[str] = set()
    home_text = ""
    pages_crawled = 0
    signals: Dict[str, float] = defaultdict(float)
    decision_makers: List[Dict[str, Any]] = []

    while to_visit and pages_crawled < MAX_PAGES:
        url, depth = to_visit.pop(0)
        if url in visited:
            continue
        visited.add(url)

        result = _fetch_page(url)
        if not result:
            continue

        pages_crawled += 1
        all_emails.update(result.emails)

        # Home page: extract text + signals + decision makers
        if url == base_url or url == base_url + "/":
            soup = BeautifulSoup(result.html, "html.parser")
            home_text = soup.get_text(" ", strip=True)[:MAX_HOME_TEXT]

            # Business signals from text
            text_lower = home_text.lower()
            for kw, pts in {
                "cold email": 30, "cold outreach": 30, "outbound": 25,
                "lead generation": 25, "lead gen": 25, "prospection": 20,
                "email marketing": 25, "e-mailing": 25, "klaviyo": 25,
                "hubspot": 20, "mailchimp": 20, "revops": 25,
                "demand generation": 25, "sdr": 15, "b2b": 10,
                "saas": 10, "e-commerce": 10, "ecommerce": 10,
            }.items():
                if kw in text_lower:
                    signals[kw] += pts

            # Decision makers on home page
            decision_makers.extend(_extract_decision_makers(result.html, base_url))

        # Add priority pages (always add regardless of depth)
        for path in EMAIL_PRIORITY_PATHS:
            full = urljoin(base_url, path)
            if full not in visited and full not in [u for u, _ in to_visit]:
                to_visit.append((full, 1))

        # Add discovered internal links (up to depth 2)
        if depth < MAX_LINK_DEPTH:
            for link in result.links:
                if link not in visited and link not in [u for u, _ in to_visit]:
                    to_visit.append((link, depth + 1))

    # Dedup decision makers
    seen_dm: Set[str] = set()
    unique_dm: List[Dict[str, Any]] = []
    for m in sorted(decision_makers, key=lambda x: -x.get("priority", 0)):
        key = _normalize_name(m.get("full_name", ""))
        if key not in seen_dm:
            seen_dm.add(key)
            unique_dm.append(m)

    # Generate pattern emails from decision makers
    pattern_emails = _generate_email_patterns(unique_dm, base_url.split("://")[-1].split("/")[0])

    # Filter out generic email prefixes
    filtered = [e for e in all_emails
                if e.split("@")[0] not in GENERIC_EMAIL_PREFIXES]

    return HarvestResult(
        domain=domain,
        emails=sorted(filtered),
        pattern_emails=pattern_emails,
        decision_makers=unique_dm,
        home_text=home_text,
        pages_crawled=pages_crawled,
        signals=dict(signals),
    )