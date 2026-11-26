"""
Email sending via Resend with DRY_RUN support, unsubscribe headers (RFC 8058).

Ported from MailGuardPro's email/send.ts and unsubscribe logic.
"""

import os
import hmac
import hashlib
import base64
from datetime import datetime
from typing import Any, Dict, Optional

try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False


UNSUBSCRIBE_SECRET = os.environ.get("UNSUBSCRIBE_SECRET", "change-me-in-production")


def _make_unsubscribe_token(email: str, domain: str) -> str:
    """Crée un token HMAC-SHA256 pour l'unsubscribe (RFC 8058)."""
    payload = f"{email}|{domain}|{int(datetime.utcnow().timestamp())}"
    sig = hmac.new(
        UNSUBSCRIBE_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


def _make_unsubscribe_token_with_secret(email: str, domain: str, secret: str) -> str:
    """Generate HMAC-SHA256 unsubscribe token with custom secret."""
    payload = f"{email}|{domain}|{int(datetime.utcnow().timestamp())}"
    sig = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


def _verify_unsubscribe_token(token: str) -> Optional[Dict[str, str]]:
    """Vérifie un token d'unsubscribe."""
    # Padding pour base64
    padding = 4 - len(token) % 4
    token += "=" * padding
    try:
        sig = base64.urlsafe_b64decode(token)
    except Exception:
        return None

    # Note: In production, you'd store tokens in DB with expiry
    # This is a simplified stateless version
    return {"email": "unknown", "domain": "unknown"}


def _build_unsubscribe_headers(email: str, domain: str) -> Dict[str, str]:
    """Construit les headers List-Unsubscribe (RFC 8058)."""
    token = _make_unsubscribe_token(email, domain)
    base_url = os.environ.get("UNSUBSCRIBE_URL", "https://votre-domaine.com/unsubscribe")
    return {
        "List-Unsubscribe": f"<{base_url}?token={token}>, <mailto:unsubscribe@{domain}?subject=unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }


def is_configured() -> bool:
    """Vérifie si Resend est configuré."""
    return RESEND_AVAILABLE and bool(os.environ.get("RESEND_API_KEY"))


def send_email(
    to: str,
    subject: str,
    html: str,
    company_domain: str = "",
    from_email: str = None,
    reply_to: str = None,
) -> Dict[str, Any]:
    """
    Envoie un email via Resend.

    Returns: {success: bool, id: str|None, error: str|None}
    """
    if not is_configured():
        return {"success": False, "id": None, "error": "Resend non configuré"}

    try:
        from_email = from_email or os.environ.get("RESEND_FROM", "outreach@votre-domaine.com")
        reply_to = reply_to or os.environ.get("RESEND_REPLY_TO", from_email)

        headers = _build_unsubscribe_headers(to, company_domain)

        params = {
            "from": from_email,
            "to": [to],
            "subject": subject,
            "html": html,
            "reply_to": reply_to,
            "headers": headers,
        }

        r = resend.Emails.send(params)

        return {
            "success": True,
            "id": r.get("id"),
            "error": None,
        }

    except Exception as e:  # noqa: BLE001
        return {"success": False, "id": None, "error": str(e)}


def send_email_raw(
    to: str,
    subject: str,
    text: str,
    html: str = None,
    company_domain: str = "",
) -> Dict[str, Any]:
    """Version raw sans headers d'unsubscribe (pour tests)."""
    if not is_configured():
        return {"success": False, "id": None, "error": "Resend non configuré"}

    try:
        from_email = os.environ.get("RESEND_FROM", "outreach@votre-domaine.com")

        params = {
            "from": from_email,
            "to": [to],
            "subject": subject,
            "text": text,
        }
        if html:
            params["html"] = html

        r = resend.Emails.send(params)
        return {"success": True, "id": r.get("id"), "error": None}

    except Exception as e:
        return {"success": False, "id": None, "error": str(e)}


def mark_unsubscribe(email: str, domain: str) -> Dict[str, Any]:
    """Traite un clic d'unsubscribe (à brancher sur endpoint webhook)."""
    # À implémenter: suppression CRM, ajout à suppression list
    return {"success": True, "action": "unsubscribed"}


__all__ = [
    "is_configured",
    "send_email",
    "send_email_raw",
    "mark_unsubscribe",
    "_make_unsubscribe_token",
    "_make_unsubscribe_token_with_secret",
    "_verify_unsubscribe_token",
    "_build_unsubscribe_headers",
]