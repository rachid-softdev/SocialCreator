"""Core types for the prospecting package."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ProspectStatus(str, Enum):
    """Status of a prospect in the CRM."""
    DISCOVERED = "discovered"
    QUALIFIED = "qualified"
    REJECTED = "rejected"
    DRAFTED = "drafted"
    APPROVED = "approved"
    DECLINED = "declined"
    SENT = "sent"
    REPLIED = "replied"
    UNSUBSCRIBED = "unsubscribed"


class EmailVerificationStatus(str, Enum):
    """Email verification status."""
    VERIFIED = "verified"
    PLAUSIBLE = "plausible"
    INVALID = "invalid"
    UNKNOWN = "unknown"


class LLMProvider(str, Enum):
    """Available LLM providers."""
    HEURISTIC = "heuristic"
    OPENCODE = "opencode"
    OPENROUTER = "openrouter"
    OPENAI = "openai"


@dataclass
class SearchResult:
    """A single search result."""
    title: str
    url: str
    snippet: str = ""
    position: int = 0

    def to_dict(self) -> dict:
        return {"title": self.title, "url": self.url, "snippet": self.snippet, "position": self.position}


@dataclass
class Company:
    """A discovered company."""
    domain: str
    name: str
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    description: str = ""
    sector: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    employees: Optional[int] = None
    market: Optional[str] = None
    source: str = "unknown"
    postal_code: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}


@dataclass
class Contact:
    """A contact person at a company."""
    name: str
    email: str
    firstname: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    job: Optional[str] = None
    verification_status: EmailVerificationStatus = EmailVerificationStatus.UNKNOWN
    domain: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "name": self.name, "email": self.email, "firstname": self.firstname,
            "phone": self.phone, "city": self.city, "job": self.job,
            "verification_status": self.verification_status.value,
            "domain": self.domain,
        }


@dataclass
class Draft:
    """A personalized email draft."""
    company_id: int
    contact_email: str
    subject: str
    body: str
    language: str = "fr"
    followup_number: int = 0
    scheduled_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id, "contact_email": self.contact_email,
            "subject": self.subject, "body": self.body, "language": self.language,
            "followup_number": self.followup_number,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
        }


@dataclass
class CRMEvent:
    """An event in the CRM."""
    company_id: int
    event_type: str
    details: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id, "event_type": self.event_type,
            "details": self.details,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class QualificationResult:
    """Result of qualifying a company."""
    score: int
    qualified: bool
    reason: str = ""
    sector_guess: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "score": self.score, "qualified": self.qualified,
            "reason": self.reason, "sector_guess": self.sector_guess,
        }


@dataclass
class PipelineResult:
    """Result of a pipeline stage."""
    stage: str
    success: bool
    processed: int = 0
    errors: int = 0
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "stage": self.stage, "success": self.success,
            "processed": self.processed, "errors": self.errors,
            "details": self.details,
        }


# Re-export for convenience
__all__ = [
    "ProspectStatus", "EmailVerificationStatus", "LLMProvider",
    "SearchResult", "Company", "Contact", "Draft", "CRMEvent",
    "QualificationResult", "PipelineResult",
]
