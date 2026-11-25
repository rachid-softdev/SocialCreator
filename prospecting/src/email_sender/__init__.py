"""Email sending module for prospecting package."""

from .sender import (
    is_configured, send_email, send_email_raw, mark_unsubscribe,
    _make_unsubscribe_token, _make_unsubscribe_token_with_secret, _verify_unsubscribe_token, _build_unsubscribe_headers,
)
from typing import Any
from dataclasses import dataclass


@dataclass
class EmailConfig:
    """Email sending configuration."""
    provider: str = "resend"
    api_key: str = None
    from_email: str = "outreach@example.com"
    from_name: str = "Outreach Team"
    dry_run: bool = True
    daily_limit: int = 20
    min_delay_seconds: int = 30
    max_delay_seconds: int = 90
    unsubscribe_domain: str = None
    hmac_secret: str = None


@dataclass
class EmailResult:
    """Result of sending an email."""
    success: bool
    message_id: str = None
    error: str = None
    email: str = None


class EmailSender:
    """Email sender with DRY_RUN, unsubscribe management, Resend backend."""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.dry_run = self.config.get("dry_run", True)
        self.api_key = self.config.get("api_key") or None
        self.unsubscribe_domain = self.config.get("unsubscribe_domain") or None
        self.hmac_secret = self.config.get("hmac_secret") or None

    def generate_unsubscribe_token(self, email: str) -> str:
        """Generate an HMAC-SHA256 unsubscribe token."""
        secret = self.hmac_secret or "change-me-in-production"
        return _make_unsubscribe_token_with_secret(email, self.unsubscribe_domain or "test.com", secret)

    def generate_unsubscribe_url(self, email: str) -> str:
        """Generate the unsubscribe URL."""
        token = self.generate_unsubscribe_token(email)
        base_url = self.unsubscribe_domain or "https://test.com/unsubscribe"
        return f"{base_url}?token={token}"

    def generate_list_unsubscribe_header(self, email: str) -> str:
        """Generate the List-Unsubscribe header (RFC 8058)."""
        base_url = self.unsubscribe_domain or "https://test.com/unsubscribe"
        token = self.generate_unsubscribe_token(email)
        return f"<{base_url}?token={token}>"

    def send(self, to_email: str, subject: str, body_html: str = None,
             from_email: str = None) -> Any:
        """Send an email (DRY_RUN by default)."""
        if self.dry_run or not is_configured():
            return type("SendResult", (), {
                "success": True,
                "message_id": "dry_run",
                "error": None,
            })()

        # Real send via Resend
        from .sender import send_email
        result = send_email(to=to_email, subject=subject, html=body_html or "")
        return type("SendResult", (), {
            "success": result.get("success", False),
            "message_id": result.get("id") or "sent",
            "error": result.get("error"),
        })()


__all__ = [
    "EmailSender",
    "EmailConfig",
    "EmailResult",
    "is_configured",
    "send_email",
    "send_email_raw",
    "mark_unsubscribe",
    "_make_unsubscribe_token",
    "_make_unsubscribe_token_with_secret",
    "_verify_unsubscribe_token",
    "_build_unsubscribe_headers",
]
