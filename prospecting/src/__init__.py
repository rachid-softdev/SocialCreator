"""prospecting package.

A unified, reusable prospecting package that works across multiple projects.
Supports discovery (Google SERP, directories), qualification (LLM/heuristic),
enrichment, personalization, email sending, and CRM storage.
"""

from src.config import AppConfig, ICPConfig, MarketConfig, CampaignConfig
from src.config import LLMConfig, EmailConfig, CRMConfig, DiscoveryConfig
from src.config import load_icp, load_config_from_env
from src.prospecting_types import (
    Company, Contact, ProspectStatus, EmailVerificationStatus,
    QualificationResult, PipelineResult, SearchResult, Draft, CRMEvent
)
from src.crm import CRM
from src.llm import LLMManager, HeuristicEngine
from src.email_sender import EmailSender, EmailResult, EmailConfig as EmailSenderConfig

__all__ = [
    "AppConfig", "ICPConfig", "MarketConfig", "CampaignConfig",
    "LLMConfig", "EmailConfig", "CRMConfig", "DiscoveryConfig",
    "load_icp", "load_config_from_env",
    "Company", "Contact", "ProspectStatus", "EmailVerificationStatus",
    "QualificationResult", "PipelineResult", "SearchResult", "Draft",
    "CRMEvent", "CRM", "LLMManager", "HeuristicEngine",
    "EmailSender", "EmailResult", "EmailSenderConfig",
]
