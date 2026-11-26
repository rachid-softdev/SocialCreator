"""
Site enrichment + email verification + decision-maker detection.

Ported from MailGuardPro's enrichment.py and site_harvest.py.
Battle-tested patterns for crawling company sites, finding emails,
verifying deliverability, and extracting decision makers.
"""

import os
import re
import smtplib
import socket
import dns.resolver
import dns.exception
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Set
from urllib.parse import urljoin, urlparse
from email.utils import parseaddr
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FutureTimeoutError

import requests
from bs4 import BeautifulSoup

from .crm import CRM
from .utils import log

# Import from the new enrichment adapter
from .adapters.enrichment import (
    harvest_site,
    HarvestResult,
    verify_email,
    _generate_email_patterns,
    _extract_decision_makers,
    _normalize_name,
    inspect_site,
    detect_cms,
    freshness_days,
    inspection_score_bonus,
)


# ============================================================
# CONFIG
# ============================================================

HTTP_TIMEOUT = 10
MAX_PAGES = 5
MAX_FETCH_WORKERS = 12
MAX_HOME_TEXT = 4000
MAX_HTML_BYTES = 2 * 1024 * 1024

# Per-company enrichment timeout in seconds (configurable)
ENRICH_PER_COMPANY_TIMEOUT = int(os.environ.get("ENRICH_PER_COMPANY_TIMEOUT", "30"))

EMAIL_REGEX = re.compile(
    r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE
)
STRICT_EMAIL_REGEX = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE
)

# Pages prioritaires pour emails
EMAIL_PRIORITY_PATHS = [
    "/contact", "/contact/", "/contact-us", "/contact-us/",
    "/about", "/about/", "/team", "/team/", "/team/leadership",
    "/leadership", "/management", "/management/", "/about-us",
    "/about-us/", "/about/team", "/team/members",
    "/nous-contacter", "/contactez-nous", "/equipe",
    "/impressum", "/legal", "/mentions-legales", "/legal-notice",
]

# Titre -> priorité pour decision makers
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

# TLDs autorisés (anti-faux-positifs)
VALID_TLDS = {
    "com", "fr", "net", "org", "io", "co", "ai", "tech", "app",
    "dev", "eu", "be", "ch", "ca", "uk", "de", "es", "it", "nl",
    "us", "me", "tv", "gg", "so", "to", "ly", "md", "pro", "xyz",
}

# Exclusions email génériques
GENERIC_EMAIL_PREFIXES = {
    "contact", "info", "hello", "support", "admin", "sales",
    "marketing", "team", "office", "hr", "careers", "jobs",
    "recruiting", "press", "media", "legal", "privacy",
    "security", "abuse", "noreply", "no-reply", "donotreply",
    "postmaster", "webmaster", "hostmaster",
}


# ============================================================
# EMAIL VALIDATION
# ============================================================

def _sanitize_email(email: str) -> str:
    """Nettoie un email extrait du HTML (unescape, strip)."""
    from html import unescape
    email = unescape(email).strip()
    email = email.strip(".'\"<>[](){}")
    return email.lower()


def _is_valid_email(email: str) -> bool:
    """Validation syntaxe + TLD."""
    if not email or len(email) > 254:
        return False
    if not STRICT_EMAIL_REGEX.match(email):
        return False
    local, _, domain = email.partition("@")
    if not local or not domain:
        return False
    if local in GENERIC_EMAIL_PREFIXES:
        return False
    if ".." in local or ".." in domain:
        return False
    tld = domain.split(".")[-1].lower()
    return tld in VALID_TLDS


def _extract_emails_from_text(text: str) -> Set[str]:
    """Extrait emails valides depuis un texte brut."""
    found = set()
    for match in EMAIL_REGEX.finditer(text):
        email = _sanitize_email(match.group())
        if _is_valid_email(email):
            found.add(email)
    return found


def _extract_emails_from_html(html: str, base_url: str) -> Set[str]:
    """Extrait emails du HTML (texte + mailto: + meta)."""
    emails = set()
    soup = BeautifulSoup(html, "html.parser")

    # mailto:
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("mailto:"):
            email = href[7:].split("?")[0].split("#")[0]
            email = _sanitize_email(email)
            if _is_valid_email(email):
                emails.add(email)

    # Texte visible
    text = soup.get_text(" ", strip=True)
    emails.update(_extract_emails_from_text(text))

    # Meta tags
    for meta in soup.find_all("meta", attrs={"content": True}):
        content = meta["content"]
        emails.update(_extract_emails_from_text(content))

    return emails


# ============================================================
# DNS / SMTP VERIFICATION
# ============================================================

def _get_mx_records(domain: str) -> List[str]:
    """Retourne MX records triés par priorité."""
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return sorted([str(r.exchange).rstrip(".") for r in answers],
                      key=lambda x: x)
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer,
            dns.exception.DNSException, socket.timeout):
        return []


def _smtp_check(mx_host: str, email: str, timeout: int = 8) -> Tuple[bool, str]:
    """Vérification SMTP RCPT TO sans envoyer d'email."""
    try:
        with smtplib.SMTP(mx_host, 25, timeout=timeout) as smtp:
            smtp.ehlo(socket.gethostname())
            code, _ = smtp.mail("verify@" + socket.gethostname())
            if code != 250:
                return False, f"MAIL FROM failed: {code}"
            code, msg = smtp.rcpt(email)
            if code == 250:
                return True, "deliverable"
            elif code == 550:
                return False, "invalid"
            elif code in (450, 451, 452):
                return None, "temporary"
            else:
                return None, f"unknown:{code}"
    except (socket.timeout, ConnectionRefusedError, smtplib.SMTPException) as e:
        return None, f"error:{type(e).__name__}"


# ============================================================
# SITE HARVESTING
# ============================================================

@dataclass
class PageResult:
    url: str
    html: str
    emails: Set[str]
    links: List[str]


def _fetch_page(url: str) -> Optional[PageResult]:
    """Récupère une page avec timeout et limite de taille."""
    try:
        headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/120.0.0.0 Safari/537.36"),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
        }
        resp = requests.get(url, headers=headers, timeout=HTTP_TIMEOUT,
                            allow_redirects=True, stream=True)

        if resp.status_code != 200:
            return None

        content_type = resp.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            return None

        # Limite taille
        content = b""
        for chunk in resp.iter_content(8192):
            content += chunk
            if len(content) > MAX_HTML_BYTES:
                break

        html = content.decode("utf-8", errors="ignore")
        soup = BeautifulSoup(html, "html.parser")

        # Emails
        emails = _extract_emails_from_html(html, url)

        # Liens internes
        base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            full = urljoin(base, href)
            if urlparse(full).netloc == urlparse(base).netloc:
                links.append(full)

        return PageResult(url=url, html=html, emails=emails, links=links)

    except Exception as e:
        log.debug(f"Fetch failed {url}: {e}")
        return None


def harvest_company_site(domain: str) -> Dict[str, Any]:
    """
    Crawl le site d'une entreprise, trouve emails et signaux métier.

    Returns: {emails: [...], home_text: str, pages_crawled: int, signals: {...}}
    """
    if not domain:
        return {"emails": [], "pattern_emails": [], "decision_makers": [], "home_text": "", "pages_crawled": 0, "signals": {}}

    # Use the new enrichment adapter
    result = harvest_site(domain)
    return {
        "emails": result.emails,
        "pattern_emails": result.pattern_emails,
        "decision_makers": result.decision_makers,
        "home_text": result.home_text,
        "pages_crawled": result.pages_crawled,
        "signals": result.signals,
    }


# ============================================================
# DECISION MAKERS (LinkedIn-style extraction from site)
# ============================================================

DECISION_MAKER_PATTERNS = [
    # "Name - Title" ou "Name, Title"
    re.compile(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*[-–—|,]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)"),
    # Team grid patterns
    re.compile(r"class=[\"']team-member[\"'][^>]*>([^<]+)<", re.IGNORECASE),
    re.compile(r"class=[\"']member-name[\"'][^>]*>([^<]+)<", re.IGNORECASE),
]

def _extract_decision_makers(html: str, base_url: str) -> List[Dict[str, Any]]:
    """Tente d'extraire des decision makers depuis le HTML."""
    makers = []
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)

    # Patterns nom - titre
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

    # Dédupliquer par nom
    seen = set()
    unique = []
    for m in sorted(makers, key=lambda x: -x["priority"]):
        key = _normalize_name(m["full_name"])
        if key not in seen:
            seen.add(key)
            unique.append(m)

    return unique[:5]


def _normalize_name(name: str) -> str:
    return re.sub(r"[^a-z]+", "", name.lower())


# ============================================================
# EMAIL PATTERN GENERATION (prenom.nom@domaine.fr)
# ============================================================

def _generate_email_patterns(decision_makers: List[Dict], domain: str) -> List[str]:
    """
    Génère des emails probables à partir des noms de decision makers.
    Patterns: prenom.nom, prenomnom, prenom, pnom.
    Retourne liste d'emails uniques (domaine normalisé).
    """
    if not decision_makers or not domain:
        return []
    domain = domain.lower().strip()
    emails = set()
    for dm in decision_makers:
        name = dm.get("full_name", "").strip()
        if not name:
            continue
        parts = name.lower().split()
        if len(parts) < 2:
            continue
        first = parts[0]
        last = parts[-1]
        # Pattern 1: prenom.nom
        emails.add(f"{first}.{last}@{domain}")
        # Pattern 2: prenomnom
        emails.add(f"{first}{last}@{domain}")
        # Pattern 3: pnom (première lettre + nom)
        if len(first) > 0 and len(last) > 1:
            emails.add(f"{first[0]}{last}@{domain}")
        # Pattern 4: prenom seul (si pas de nom de famille clair)
        if len(parts) == 1:
            emails.add(f"{first}@{domain}")
    return sorted(emails)


# ============================================================
# MAIN ENRICHMENT ORCHESTRATOR
# ============================================================

def enrich_companies(crm: CRM, limit: int = 20,
                     verify_emails: bool = True,
                     max_workers: int = 6) -> Dict[str, int]:
    """
    Enrichit les entreprises qualifiées (status=qualified) sans contacts email.

    Network-bound steps (site inspection + harvest) run concurrently via
    ThreadPoolExecutor to speed up the pipeline. SQLite writes stay sequential
    in the main thread to respect the single-connection constraint on Windows.
    Each company is subject to a per-company timeout; slow companies are
    skipped rather than blocking the whole pipeline.

    Returns: {enriched, contacts_added, emails_verified, errors}
    """
    companies = crm.get_companies(status="qualified", limit=limit)
    if not companies:
        log.info("Aucune entreprise à enrichir")
        return {"enriched": 0, "contacts_added": 0, "emails_verified": 0, "errors": 0}

    # Filter out companies that already have emails
    companies_to_enrich = [
        c for c in companies if not crm.company_has_email(c["id"])
    ]
    if not companies_to_enrich:
        log.info("Toutes les entreprises ont déjà un contact email")
        return {"enriched": 0, "contacts_added": 0, "emails_verified": 0, "errors": 0}

    log.info(f"Enrichissement de {len(companies_to_enrich)} entreprises "
             f"(timeout {ENRICH_PER_COMPANY_TIMEOUT}s/entreprise, "
             f"{max_workers} workers)")

    enriched = contacts_added = emails_verified = errors = 0
    processed = 0

    def _enrich_one_network(company: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Network-only enrichment: inspect + harvest, no DB writes."""
        domain = company.get("domain")
        if not domain:
            return None

        log.info(f"Enrichissement: {company['name']} ({domain})")

        # Website URL for inspection
        website = company.get("website")
        inspect_url = website if website else f"https://{domain}"

        # Inspect site (CMS, source tools, blog freshness)
        inspection = inspect_site(inspect_url, domain)

        # Harvest site
        harvest = harvest_company_site(domain)

        return {
            "company": company,
            "inspection": inspection,
            "harvest": harvest,
        }

    # Run network-bound steps concurrently, then write to SQLite sequentially
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_company = {
            executor.submit(_enrich_one_network, company): company
            for company in companies_to_enrich
        }

        for future in as_completed(future_to_company):
            company = future_to_company[future]
            processed += 1
            domain = company.get("domain", "unknown")

            try:
                data = future.result(timeout=ENRICH_PER_COMPANY_TIMEOUT)
                if data is None:
                    errors += 1
                    log.error(f"Enrichissement échoué (pas de données): {domain}")
                    continue
            except FutureTimeoutError:
                errors += 1
                log.warning(f"⏱️ Timeout enrichissement ({ENRICH_PER_COMPANY_TIMEOUT}s): {domain} — ignoré")
                continue
            except Exception as e:
                errors += 1
                log.error(f"Erreur enrichissement {domain}: {e}")
                continue

            # Write results to SQLite sequentially (main thread)
            try:
                result = _enrich_one_write(crm, company, data, verify_emails)
                if result:
                    enriched += 1
                    contacts_added += result.get("contacts_added", 0)
                    emails_verified += result.get("emails_verified", 0)
                log.info(f"  ✓ {company['name']} ({domain}): "
                         f"{result.get('contacts_added', 0)} contacts, "
                         f"{result.get('emails_verified', 0)} emails vérifiés")
            except Exception as e:
                errors += 1
                log.error(f"Erreur écriture enrichissement {domain}: {e}")

    log.success(f"Enrichissement: {enriched}/{processed} entreprises, "
                f"{contacts_added} contacts, {emails_verified} emails vérifiés, "
                f"{errors} erreurs")
    return {"enriched": enriched, "contacts_added": contacts_added,
            "emails_verified": emails_verified, "errors": errors}


def _enrich_one_write(crm: CRM, company: Dict[str, Any],
                      data: Dict[str, Any],
                      verify_emails: bool = True) -> Optional[Dict[str, int]]:
    """Écrit les résultats d'enrichissement dans SQLite (appelé séquentiellement)."""
    domain = company.get("domain")
    if not domain:
        return None

    inspection = data["inspection"]
    harvest = data["harvest"]

    # Mettre à jour l'entreprise avec signaux
    if harvest.get("signals"):
        crm.add_signals(company["id"], harvest["signals"])
    if harvest.get("home_text"):
        crm.add_description(company["id"], harvest["home_text"])

    # Add inspection signals (cms, freshness_bonus)
    inspection_signals: Dict[str, Any] = {}
    if inspection.get("cms"):
        inspection_signals["cms"] = inspection["cms"]
    if inspection.get("source_tools"):
        inspection_signals["source_tools"] = inspection["source_tools"]
    if inspection.get("blog_url"):
        inspection_signals["blog_url"] = inspection["blog_url"]
    if inspection.get("post_count"):
        inspection_signals["post_count"] = inspection["post_count"]
    inspection_signals["freshness_days"] = inspection.get("freshness_days", 999)
    inspection_signals["freshness_bonus"] = inspection.get("qualifier_bonus", 0)
    inspection_signals["inspection_score_bonus"] = inspection.get("qualifier_bonus", 0)

    if inspection_signals:
        crm.add_signals(company["id"], inspection_signals)

    # Use inspection_score_bonus to enhance qualification if needed
    score_bonus = inspection_score_bonus(inspection)

    contacts_added = 0
    emails_verified = 0

    # Ajouter emails trouvés (extrait + patterns générés depuis decision makers)
    candidate_emails = set()
    for e in (harvest.get("emails") or []):
        candidate_emails.add(e.strip().lower())
    for e in (harvest.get("pattern_emails") or []):
        candidate_emails.add(e.strip().lower())

    for email in sorted(candidate_emails):
        email = email.strip().lower()
        if not email or email.split("@")[0] in GENERIC_EMAIL_PREFIXES:
            continue
        # Vérifier si contact existe déjà
        existing = crm.get_contact_by_email(email)
        if existing:
            if verify_emails and existing.get("email_status") == "found":
                status = verify_email(email)
                crm.upsert_contact({
                    "company_id": company["id"],
                    "email": email,
                    "email_status": status,
                    "email_source": "smtp",
                    "full_name": None,
                })
                if status == "verified":
                    emails_verified += 1
            continue

        # Nouveau contact
        crm.upsert_contact({
            "company_id": company["id"],
            "email": email,
            "email_status": "found",
            "email_source": "site_harvest",
            "full_name": None,
        })
        contacts_added += 1

        if verify_emails:
            status = verify_email(email)
            crm.upsert_contact({
                "company_id": company["id"],
                "email": email,
                "email_status": status,
                "email_source": "smtp",
                "full_name": None,
            })
            if status == "verified":
                emails_verified += 1

    # Mettre à jour statut (toujours marquer comme enrichi si le crawl a eu lieu)
    crm.update_status(domain, "enriched", None)
    if contacts_added > 0:
        crm.add_event(company["id"], "enriched",
                      {"emails_found": harvest.get("emails", []),
                       "signals": harvest.get("signals", {}),
                       "pages_crawled": harvest.get("pages_crawled", 0),
                       "cms": inspection.get("cms"),
                       "inspection_score_bonus": score_bonus})
    else:
        crm.add_event(company["id"], "enrichment_no_email",
                      {"pages_crawled": harvest.get("pages_crawled", 0),
                       "emails_found": harvest.get("emails", []),
                       "signals": harvest.get("signals", {}),
                       "cms": inspection.get("cms"),
                       "inspection_score_bonus": score_bonus})

    return {"contacts_added": contacts_added, "emails_verified": emails_verified}


# Patch CRM methods needed
def _patch_crm(crm: CRM):
    """Ajoute méthodes manquantes au CRM (monkey-patch pour compatibilité)."""
    if not hasattr(crm, "add_signals"):
        def add_signals(company_id: int, signals: Dict[str, int]):
            import json
            crm._conn.execute(
                "UPDATE companies SET description = COALESCE(description, '') || ? WHERE id = ?",
                (f"\n[Signals: {json.dumps(signals)}]", company_id)
            )
            crm._conn.commit()
        crm.add_signals = add_signals

    if not hasattr(crm, "add_description"):
        def add_description(company_id: int, text: str):
            crm._conn.execute(
                "UPDATE companies SET description = COALESCE(description, '') || ? WHERE id = ?",
                (f"\n[Site: {text[:500]}]", company_id)
            )
            crm._conn.commit()
        crm.add_description = add_description

    if not hasattr(crm, "get_contact_by_email"):
        def get_contact_by_email(company_id: int, email: str):
            row = crm._fetch_one(
                "SELECT * FROM contacts WHERE company_id = ? AND email = ?",
                (company_id, email)
            )
            return row
        crm.get_contact_by_email = get_contact_by_email

    if not hasattr(crm, "update_contact_email"):
        def update_contact_email(contact_id: int, email: str, status: str, source: str):
            crm._conn.execute(
                "UPDATE contacts SET email = ?, email_status = ?, email_source = ? WHERE id = ?",
                (email, status, source, contact_id)
            )
            crm._conn.commit()
        crm.update_contact_email = update_contact_email

_patch_crm = _patch_crm  # Ensure it's defined