"""Consolidated contact extraction from HTML pages.

Adapted from SiteAudit/shared/contacts.py and find_emails.py.
Provides email scanning from HTML (mailto, plaintext, Cloudflare, data-*, JSON-LD),
email scoring, domain filtering, and generation of plausible emails.
"""

import re
from html import unescape as html_unescape
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlsplit, urlunsplit, urlparse

from src.utils import log


# ============================================================================
# REGEX & CONSTANTS
# ============================================================================

RE_MAILTO = re.compile(r'mailto:([^"\'?>\s\\]+)', re.I)
RE_PLAIN = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
RE_CF_ATTR = re.compile(r'data-cfemail="([0-9a-fA-F]+)"')
RE_CF_HREF = re.compile(r'/cdn-cgi/l/email-protection#([0-9a-fA-F]+)', re.I)
RE_DATA_EMAIL = re.compile(
    r'(?:data-email|data-contact|data-mail)\s*=\s*["\']([^"\']{3,160})["\']',
    re.I)
RE_JSONLD = re.compile(
    r"<script[^>]*application/ld\+json[^>]*>(.*?)</script>", re.S | re.I)
RE_HTML_LANG = re.compile(r'<html[^>]*\blang\s*=\s*["\']([a-z]{2})["\']', re.I)
RE_SEC_CONTACT = re.compile(r"^\s*Contact:\s*(?:mailto:\s*)?(.+?)\s*$",
                            re.M | re.I)

CANDIDATE_SLUGS = (
    "mentions-legales", "mentions_legales", "mentions", "legal",
    "legal-notices", "legal-notice", "impressum", "contact",
    "contactez-nous", "nous-contacter", "contact-us", "a-propos",
    "apropos", "about", "about-us", "qui-sommes-nous", "privacy",
    "privacy-policy", "politique-de-confidentialite", "confidentialite",
    "cgu", "cgv", "conditions-generales", "terms", "tos", "rgpd",
)
MAX_EXTRA_PAGES = 30
MAX_HEADLESS_PAGES = 3

TLD_LANG = {"fr": "fr", "de": "de", "es": "es", "it": "it",
            "pt": "pt", "nl": "nl"}

SCORE_PATTERNS = (
    (100, re.compile(r"^(contact|info|bonjour|hello|salut|secretariat)", re.I)),
    (90, re.compile(r"^(direction|admin|accueil|reception)", re.I)),
    (70, re.compile(r"^(commercial|sales|ventes|devis)", re.I)),
    (50, re.compile(r"^(support|aide|help)", re.I)),
    (30, re.compile(r"^(webmaster|postmaster|hostmaster)", re.I)),
    (10, re.compile(r"(no-?reply|dontreply|booking|automation)", re.I)),
    (0, re.compile(r"^(abuse|security)([.\-_].*)?$", re.I)),
)
DEFAULT_SCORE = 60

NOISE_DOMAIN = re.compile(
    r"sentry\.io|sentry\.next|wixpress\.com|example\.(com|org|net)"
    r"|domain\.(com|fr)|yourdomain|email\.tst|@2x", re.I)
NOISE_SUFFIX = re.compile(
    r"\.(png|jpe?g|gif|webp|svg|css|js|ico)$", re.I)

RE_JSON_PREFIX = re.compile(r"^u[0-9a-f]{4}")


# ============================================================================
# HELPERS
# ============================================================================

def site_domain(url: str) -> str:
    """Extract normalized domain from URL (strip www)."""
    host = urlparse(url).netloc.lower()
    if "@" in host:
        host = host.rsplit("@", 1)[-1]
    if host.startswith("["):
        return host[1:host.index("]")] if "]" in host else host
    return (host.split(":", 1)[0]).removeprefix("www.")


def cf_decode(hexstr: str) -> Optional[str]:
    """Decode Cloudflare email encoding (first byte = key XOR)."""
    try:
        data = bytes.fromhex(hexstr)
    except ValueError:
        return None
    if len(data) < 2:
        return None
    key = data[0]
    try:
        return "".join(chr(b ^ key) for b in data[1:])
    except ValueError:
        return None


def looks_like_noise(email: str) -> bool:
    """Check if email is a noise/malformed candidate."""
    if NOISE_SUFFIX.search(email) or NOISE_DOMAIN.search(email):
        return True
    local = email.split("@", 1)[0]
    if len(local) > 40:
        return True
    if len(local) >= 20 and re.fullmatch(r"[0-9a-f]+", local, re.I):
        return True
    return False


def is_same_domain(email: str, domain: str) -> bool:
    """Check if email domain matches target domain."""
    dom = email.rsplit("@", 1)[-1].lower()
    return dom == domain or dom.endswith("." + domain)


def score_email(email: str) -> int:
    """Score email relevance (contact/info=100 down to abuse=0)."""
    local = email.split("@", 1)[0]
    for score, rx in SCORE_PATTERNS:
        if rx.search(local):
            return score
    return DEFAULT_SCORE


# ============================================================================
# HTML SCAN
# ============================================================================

def _add(results: Dict[str, dict], seen: Set[str], email: str, source: str, url: str) -> None:
    """Add email to results if valid, deduped, and not noise."""
    email = email.strip().strip("<>().,;:\"'").lower()
    if not email or "@" not in email or email in seen:
        return
    if not looks_like_noise(email):
        seen.add(email)
        results[email] = {"email": email, "source": source, "url": url}


def _walk_jsonld(node, out: List[Tuple[str, str]]) -> None:
    """Walk JSON-LD node extracting (email, source) pairs."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str) and k.lower() == "email":
                out.extend((m.group(0), "json-ld") for m in RE_PLAIN.finditer(v))
            else:
                _walk_jsonld(v, out)
    elif isinstance(node, list):
        for item in node:
            _walk_jsonld(item, out)


def scan_html(raw: str) -> List[Tuple[str, str]]:
    """Scan raw HTML -> list of (email, source) in order of appearance."""
    found = []
    text = html_unescape(raw)

    for m in RE_CF_ATTR.finditer(raw):
        addr = cf_decode(m.group(1))
        if addr and "@" in addr:
            found.append((addr.lower(), "cloudflare"))
    for m in RE_CF_HREF.finditer(text):
        addr = cf_decode(m.group(1))
        if addr and "@" in addr:
            found.append((addr.lower(), "cloudflare"))
    for m in RE_DATA_EMAIL.finditer(raw):
        val = html_unescape(m.group(1))
        if "@" in val:
            found.extend((x.lower(), "attr") for x in RE_PLAIN.findall(val))
    for m in RE_JSONLD.finditer(raw):
        try:
            import json
            data = json.loads(m.group(1).strip())
        except ValueError:
            continue
        ld = []
        _walk_jsonld(data, ld)
        found.extend(ld)
    for m in RE_MAILTO.finditer(text):
        found.append((m.group(1).strip().strip(".").lower(), "mailto"))
    for m in RE_PLAIN.finditer(text):
        found.append((m.group(0).lower(), "plain"))

    out, seen = [], set()
    for email, src in found:
        email = email.strip("<>().,;:\"'").lower()
        if not email or email in seen or "@" not in email:
            continue
        # Fix JSON unicode artifact: "u003econtact@..." -> "contact@..."
        if src == "plain" and RE_JSON_PREFIX.match(email.split("@", 1)[0]):
            local, dom = email.split("@", 1)
            local = local[5:]
            if not local:
                continue
            email = local + "@" + dom
            if email in seen:
                continue
        seen.add(email)
        if not looks_like_noise(email):
            out.append((email, src))
    return out


# ============================================================================
# EMAIL GENERATION (from find_emails.py)
# ============================================================================

def slugifier(text: str) -> str:
    """Lowercase without accents or special chars (for email patterns)."""
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_text = nfkd.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", ascii_text.lower())


def generate_email_patterns(
    first_names: List[str],
    last_names: List[str],
    domain: str,
    motifs: Optional[List[str]] = None
) -> List[str]:
    """Generate plausible email addresses from first/last names.

    Patterns: prenom.nom@domaine, p.nom@domaine, prenom@domaine, prenomnom@domaine.
    """
    if not domain:
        return []
    emails: Set[str] = set()
    domain_clean = domain.lower().lstrip("www.")
    motifs = motifs or ["prenom.nom", "prenomnom", "p.nom", "prenom", "nom.prenom"]

    for first in first_names:
        for last in last_names:
            p, n = slugifier(first), slugifier(last)
            if not p or not n:
                continue
            local_variants = {
                f"{p}.{n}": f"{p}.{n}@{domain_clean}",
                f"{p[0]}.{n}": f"{p[0]}.{n}@{domain_clean}",
                f"{p}": f"{p}@{domain_clean}",
                f"{p}{n}": f"{p}{n}@{domain_clean}",
            }
            for local in local_variants:
                email = local_variants[local]
                if email not in emails:
                    emails.add(email)
    return sorted(emails)


# ============================================================================
# MAIN EXTRACTION FUNCTION
# ============================================================================

def extract_contacts_from_html(
    html: str,
    source: str = "html",
) -> List[Dict[str, str]]:
    """Extract contacts from raw HTML content.

    Returns list of dicts {email, source} sorted by appearance order.
    """
    found = scan_html(html)
    return [
        {"email": email, "source": src, "url": source}
        for email, src in found
    ]


__all__ = [
    # Scan
    "scan_html",
    "extract_contacts_from_html",
    # Scoring / filtering
    "site_domain",
    "cf_decode",
    "looks_like_noise",
    "is_same_domain",
    "score_email",
    # Generation
    "slugifier",
    "generate_email_patterns",
    # Constants
    "RE_MAILTO",
    "RE_PLAIN",
    "RE_CF_ATTR",
    "RE_CF_HREF",
    "RE_DATA_EMAIL",
    "RE_JSONLD",
    "RE_HTML_LANG",
    "RE_SEC_CONTACT",
    "CANDIDATE_SLUGS",
    "MAX_EXTRA_PAGES",
    "MAX_HEADLESS_PAGES",
    "SCORE_PATTERNS",
    "DEFAULT_SCORE",
    "NOISE_DOMAIN",
    "NOISE_SUFFIX",
    "TLD_LANG",
]