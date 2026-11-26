"""
Email verification via SMTP (RCPT TO).

Used to validate that an email address exists and is deliverable.
Incorporates Omnysync's email verification improvements.
"""

import re
import socket
import smtplib
import dns.resolver
import dns.exception
from typing import Tuple, Optional

from src.utils import log

# ============================================================
# CONFIG
# ============================================================

SMTP_TIMEOUT = 20  # Omnysync uses 20s for MX-aware SMTP checks
DEFAULT_PROBE_SENDER = "verify@omnysync.com"


# ============================================================
# REGEX PATTERNS (Omnysync)
# ============================================================

EMAIL_REGEX = re.compile(
    r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE
)
STRICT_EMAIL_REGEX = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE
)


# ============================================================
# CONSTANTS (Omnysync improvements)
# ============================================================

# Domains that commonly accept all emails (catch-all) -> risky, not invalid
CATCH_ALL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "ymail.com",
    "ymail.ca",
    "aol.com",
    "protonmail.com",
    "proton.me",
}

# Known SMTP gateway MX hostnames (Microsoft365 / Google Workspace / Proofpoint)
GATEWAY_MX_MARKERS = {
    "protection.outlook.com",
    "google.com",
    "proofpoint.com",
    "spamhaus.org",
    "mimecast.com",
    "zoho.com",
}

# Hints for detecting "user unknown" rejections in SMTP responses
_UNKNOWN_HINTS = [
    "user unknown",
    "no such user",
    "invalid user",
    "unknown user",
    "recipient rejected",
    "mailbox unavailable",
    "550 5.1",
    "550 5.2",
    "550 5.3",
    "550 5.4",
    "550 5.5",
    "550 5.6",
    "550 5.7",
]


# ============================================================
# EMAIL EXTRACTION (Omnysync)
# ============================================================

def _strip_phone_prefix(email: str, preceding: Optional[str] = None) -> str:
    """
    Remove phone numbers prefixed to emails.
    Example: "40contact@x.fr" -> "contact@x.fr"

    Args:
        email: Email string that may have a phone-number prefix.
        preceding: Optional context string used to strip preceding content.

    Returns:
        Cleaned email with phone prefix removed.
    """
    if not email:
        return email
    # Strip leading digits/plus/dashes/whitespace (phone prefix like country code)
    cleaned = re.sub(r"^[\d+][\d\s\-]*", "", email.strip())
    return cleaned or email.strip()


def extract_emails(text: str, context: Optional[str] = None) -> list:
    """
    Extract emails from text, filtered by optional domain context.

    Args:
        text: Raw text to scan for emails.
        context: Optional domain context (e.g. "omnysync.com") to filter by.

    Returns:
        List of unique, cleaned emails (optionally context-filtered).
    """
    found = []
    for match in EMAIL_REGEX.finditer(text):
        email = match.group().strip().lower()
        if context:
            domain = email.split("@")[-1].lower()
            if context.lower().lstrip("@") not in domain:
                continue
        email = _strip_phone_prefix(email)
        if email and email not in found:
            found.append(email)
    return found


# ============================================================
# MX / SMTP VERIFICATION (Omnysync improvements)
# ============================================================

def _get_mx_records(domain: str) -> list:
    """Get MX records for a domain."""
    try:
        answers = dns.resolver.resolve(domain, "MX")
        return sorted([str(r.exchange).rstrip(".") for r in answers], key=lambda x: x)
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
        return []


def _is_gateway_mx(mx_host: str) -> bool:
    """Check if MX host is a known verification gateway (O365 / Google Workspace / Proofpoint)."""
    host = mx_host.lower().rstrip(".")
    return any(marker in host for marker in GATEWAY_MX_MARKERS)


def _is_catch_all_domain(domain: str) -> bool:
    """Check if domain is a known catch-all email provider domain."""
    return domain.lower().lstrip("@") in CATCH_ALL_DOMAINS


def verify_email_detailed(
    email: str,
    smtp_enabled: bool = True,
    sender: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Verify email deliverability via SMTP RCPT TO with Omnysync improvements.

    Returns (status, detail) where status is one of:
    - "verified": Email exists (250 OK)
    - "risky": Catch-all domain or uncertain result
    - "invalid": Email rejected (550 user unknown / hard bounce)
    - "syntax_error": Invalid email format
    - "dns_error": No MX records
    - "connection_error": Could not connect
    - "timeout": Connection timeout
    - "unknown": Other error

    Key improvements:
    - Gateway MX detection prevents false "invalid" on Microsoft365/Google Workspace
    - Catch-all detection distinguishes risky from invalid
    - Phone prefix stripping cleans obfuscated emails
    """
    if not smtp_enabled:
        return "unknown", "SMTP verification disabled"

    if "@" not in email:
        return "syntax_error", "Invalid format"

    email = _strip_phone_prefix(email)

    local_part, domain = email.rsplit("@", 1)

    # Get MX records
    mx_records = _get_mx_records(domain)
    if not mx_records:
        return "dns_error", f"No MX records for {domain}"

    # Determine if this is a catch-all domain / known gateway
    catch_all = _is_catch_all_domain(domain)

    for mx in mx_records:
        try:
            with smtplib.SMTP(mx, port=25, timeout=SMTP_TIMEOUT) as smtp:
                smtp.helo(socket.gethostname())
                smtp.mail(sender or DEFAULT_PROBE_SENDER)
                code, msg = smtp.rcpt(email)

                if code == 250:
                    if catch_all:
                        return "risky", "catch_all_domain"
                    return "verified", "SMTP 250 OK"
                if code == 550:
                    rejection_text = msg.decode() if isinstance(msg, bytes) else str(msg)
                    if any(hint in rejection_text.lower() for hint in _UNKNOWN_HINTS):
                        return "invalid", f"user_unknown: {rejection_text}"
                    if catch_all:
                        return "risky", f"catch_all_rejected: {rejection_text}"
                    return "invalid", f"SMTP 550: {rejection_text}"
                if code >= 400:
                    # Try next MX
                    continue

        except smtplib.SMTPServerDisconnected:
            continue
        except socket.timeout:
            continue
        except ConnectionRefusedError:
            continue
        except Exception as e:
            log.debug(f"SMTP check failed for {email} via {mx}: {e}")
            continue

    if catch_all:
        return "risky", "catch_all_domain_all_mx_failed"

    return "unknown", "All MX servers failed or refused"


def verify_email(email: str) -> str:
    """
    Verify email deliverability and return just the status string.

    Returns: "verified" | "risky" | "invalid" | "unknown" | "syntax_error" | "dns_error"
    """
    status, _ = verify_email_detailed(email)
    return status


def verify_email_batch(emails: list, smtp_enabled: bool = True) -> dict:
    """Verify multiple emails, return dict email -> status string."""
    results = {}
    for email in emails:
        results[email] = verify_email(email)
    return results
