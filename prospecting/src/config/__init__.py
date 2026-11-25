"""Configuration management for prospecting package."""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class MarketConfig:
    """Configuration for a target market."""
    code: str
    name: str
    target_countries: List[str]
    search_places: List[str]
    search_queries: List[str]
    exclude_keywords: List[str] = field(default_factory=list)


@dataclass
class CampaignConfig:
    """Email campaign configuration."""
    offer: str
    cta: str
    templates: Dict[str, str] = field(default_factory=dict)
    max_followups: int = 1
    followup_delay_days: int = 3


@dataclass
class ICPConfig:
    """Ideal Customer Profile configuration."""
    markets: List[MarketConfig]
    exclude_domains: List[str] = field(default_factory=list)
    qualification_threshold: int = 70
    decision_maker_roles: List[str] = field(default_factory=lambda: [
        "CEO", "CTO", "CMO", "VP Marketing", "VP Sales", "Head of Growth",
        "Head of Marketing", "Head of Sales", "Founder", "Co-founder",
        "Director Marketing", "Director Sales", "Growth Lead"
    ])
    campaigns: Dict[str, CampaignConfig] = field(default_factory=dict)


@dataclass
class LLMConfig:
    """LLM backend configuration."""
    provider: str = "heuristic"  # heuristic, opencode, openrouter, openai
    model: str = "default"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    fallback_heuristic: bool = True


@dataclass
class EmailConfig:
    """Email sending configuration."""
    provider: str = "resend"  # resend, gmail
    api_key: Optional[str] = None
    from_email: str = "outbound@example.com"
    from_name: str = "Outbound Team"
    dry_run: bool = True
    daily_limit: int = 20
    min_delay_seconds: int = 30
    max_delay_seconds: int = 90
    unsubscribe_domain: Optional[str] = None
    hmac_secret: Optional[str] = None


@dataclass
class CRMConfig:
    """CRM storage configuration."""
    backend: str = "sqlite"  # sqlite, postgresql
    database_url: Optional[str] = None
    sqlite_path: str = "data/crm.db"


@dataclass
class DiscoveryConfig:
    """Discovery/search configuration."""
    google_headless: bool = True
    google_timeout: int = 20
    max_load_failures: int = 2
    results_per_query: int = 10
    duckduckgo_timeout: int = 20
    use_directories: bool = True
    directory_sources: List[str] = field(default_factory=lambda: [
        "agences-web-france.fr",
        "mon-expert-digital.com"
    ])


@dataclass
class NotificationConfig:
    """Notifications configuration."""
    discord_webhook: Optional[str] = None
    enabled: bool = True


@dataclass
class AppConfig:
    """Main application configuration."""
    icp: ICPConfig
    llm: LLMConfig
    email: EmailConfig
    crm: CRMConfig
    discovery: DiscoveryConfig
    notifications: NotificationConfig
    runner_host: str = "local"
    lock_path: str = "data/runner.lock"


def load_icp(path: str) -> ICPConfig:
    """Load ICP configuration from JSON file."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    markets = [MarketConfig(**m) for m in data.get("markets", [])]
    campaigns = {}
    for k, v in data.get("campaigns", {}).items():
        campaigns[k] = CampaignConfig(**v)

    return ICPConfig(
        markets=markets,
        exclude_domains=data.get("exclude_domains", []),
        qualification_threshold=data.get("qualification_threshold", 70),
        decision_maker_roles=data.get("decision_maker_roles", []),
        campaigns=campaigns,
    )


def load_icp_raw(path: str = "config/icp.json") -> Dict[str, Any]:
    """Load raw ICP configuration dict from JSON file."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_campaigns(path: str = None) -> List[CampaignConfig]:
    """Load campaign configurations from JSON file."""
    if path is None:
        path = os.getenv("CAMPAIGNS_CONFIG_PATH", "config/campaigns.json")
    if Path(path).exists():
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        campaigns = {}
        for k, v in data.items():
            campaigns[k] = CampaignConfig(**v)
        return list(campaigns.values())
    return []


def is_dry_run() -> bool:
    return os.getenv("DRY_RUN", "true").lower() == "true"


def is_heuristic_mode() -> bool:
    return os.getenv("USE_HEURISTIC", "true").lower() == "true"


def is_configured() -> bool:
    return bool(os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))


# Paths
from pathlib import Path as _Path
CONFIG_DIR = _Path(__file__).resolve().parent.parent / "config"
DATA_DIR = _Path(__file__).resolve().parent.parent / "data"
PROJECT_ROOT = _Path(__file__).resolve().parent.parent
CRM_DB_PATH = DATA_DIR / "prospecting.db"


def load_config_from_env() -> AppConfig:
    """Load configuration from environment variables."""
    icp_path = os.getenv("ICP_CONFIG_PATH", "config/icp.json")
    icp = load_icp(icp_path) if Path(icp_path).exists() else ICPConfig(markets=[])

    return AppConfig(
        icp=icp,
        llm=LLMConfig(
            provider=os.getenv("LLM_PROVIDER", "heuristic"),
            model=os.getenv("LLM_MODEL", "default"),
            api_key=os.getenv("LLM_API_KEY"),
            base_url=os.getenv("LLM_BASE_URL"),
            fallback_heuristic=os.getenv("LLM_FALLBACK_HEURISTIC", "true").lower() == "true",
        ),
        email=EmailConfig(
            provider=os.getenv("EMAIL_PROVIDER", "resend"),
            api_key=os.getenv("EMAIL_API_KEY"),
            from_email=os.getenv("EMAIL_FROM", "outbound@example.com"),
            from_name=os.getenv("EMAIL_FROM_NAME", "Outbound Team"),
            dry_run=os.getenv("DRY_RUN", "true").lower() == "true",
            daily_limit=int(os.getenv("DAILY_SEND_LIMIT", "20")),
            min_delay_seconds=int(os.getenv("MIN_DELAY_SECONDS", "30")),
            max_delay_seconds=int(os.getenv("MAX_DELAY_SECONDS", "90")),
            unsubscribe_domain=os.getenv("UNSUBSCRIBE_DOMAIN"),
            hmac_secret=os.getenv("HMAC_SECRET"),
        ),
        crm=CRMConfig(
            backend=os.getenv("CRM_BACKEND", "sqlite"),
            database_url=os.getenv("DATABASE_URL"),
            sqlite_path=os.getenv("SQLITE_PATH", "data/crm.db"),
        ),
        discovery=DiscoveryConfig(
            google_headless=os.getenv("GOOGLE_HEADLESS", "true").lower() == "true",
            google_timeout=int(os.getenv("GOOGLE_TIMEOUT", "20")),
            max_load_failures=int(os.getenv("MAX_LOAD_FAILURES", "2")),
            results_per_query=int(os.getenv("RESULTS_PER_QUERY", "10")),
            duckduckgo_timeout=int(os.getenv("DUCKDUCKGO_TIMEOUT", "20")),
            use_directories=os.getenv("USE_DIRECTORIES", "true").lower() == "true",
        ),
        notifications=NotificationConfig(
            discord_webhook=os.getenv("DISCORD_WEBHOOK"),
            enabled=os.getenv("NOTIFICATIONS_ENABLED", "true").lower() == "true",
        ),
        runner_host=os.getenv("RUNNER_HOST", "local"),
        lock_path=os.getenv("LOCK_PATH", "data/runner.lock"),
    )
