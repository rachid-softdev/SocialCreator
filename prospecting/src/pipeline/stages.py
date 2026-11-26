"""Pipeline stages for unified prospecting - MailGuardPro enriched."""

import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.prospecting_types import (
    Company, Contact, ProspectStatus, EmailVerificationStatus,
    PipelineResult, QualificationResult, Draft
)
from src.config import (
    load_icp, load_icp_raw, load_campaigns, is_dry_run, is_heuristic_mode,
    is_configured, CRM_DB_PATH, AppConfig, ICPConfig, LLMConfig,
    EmailConfig, CRMConfig, DiscoveryConfig, NotificationConfig
)
from src.crm import CRM
from src.qualifier import qualify as qualify_heuristic
from src.enricher import enrich_companies
from src.personalizer import personalize_message, TEMPLATES


def _make_crm(config: Optional[dict] = None) -> CRM:
    return CRM(config.get("db_path") if config else None)


def _log_info(msg: str) -> None:
    from src.utils import log
    log.info(msg)


def _log_error(msg: str) -> None:
    from src.utils import log
    log.error(msg)


def discover_stage(
    crm: CRM,
    llm: Any,  # not used in this stage
    limit: int = 15,
    config: Optional[dict] = None,
    stage_timeout: Optional[int] = None,
) -> PipelineResult:
    """Discovery stage: find new companies from Google/SERP/directories."""
    from src.adapters.search import get_searcher
    from src.adapters.discovery.llm_search import LLMSearcher
    from src.utils import normalize_domain
    from urllib.parse import urlparse

    config = config or {}
    start = time.time()

    _log_info("Étape discovery: recherche de nouvelles entreprises")

    # Multi-engine searcher (DuckDuckGo → Ecosia → Google → Bing, configurable
    # via SEARCH_PROVIDER / SEARCH_FALLBACK). Falls back to DuckDuckGo.
    searcher = get_searcher()
    llm_searcher = LLMSearcher(
        provider=config.get("llm_provider", "opencode"),
        model=config.get("llm_model"),
        api_key=config.get("llm_api_key"),
        base_url=config.get("llm_base_url"),
        fallback_provider=config.get("llm_fallback_provider", "kilo"),
        fallback_model=config.get("llm_fallback_model"),
    )
    use_llm_fallback = config.get("use_llm_fallback", True)
    total_found = 0
    total_new = 0
    total_skipped = 0

    icp = load_icp_raw("config/icp.json")
    markets = icp.get("markets", [])
    per_market_target = max(1, (limit // max(1, len(markets)))) if markets else limit

    _log_info(f"  {len(markets)} marché(x), limite totale={limit}, "
              f"cible par marché={per_market_target}")

    try:
        for market_idx, market in enumerate(markets, 1):
            if total_new >= limit:
                break

            if stage_timeout and (time.time() - start) > stage_timeout:
                _log_info(f"  Timeout étape discovery atteint ({stage_timeout}s), arrêt")
                break

            market_code = market.get("code", "fr")
            queries = market.get("search_queries", []) or ["default query"]

            for query_idx, query in enumerate(queries, 1):
                if total_new >= limit:
                    break

                if stage_timeout and (time.time() - start) > stage_timeout:
                    _log_info(f"  Timeout étape discovery atteint ({stage_timeout}s), arrêt")
                    break

                _log_info(f"  [{market_idx}/{len(markets)}] {market_code} / "
                          f"[{query_idx}/{len(queries)}] '{query}'")
                t_query = time.time()
                results = searcher.search(query)
                q_elapsed = time.time() - t_query

                # Fallback : si Google/DuckDuckGo ne retourne rien, utiliser le LLM
                if not results and use_llm_fallback and hasattr(llm_searcher, "search"):
                    _log_info(f"  LLM fallback pour query: '{query}'")
                    try:
                        results = llm_searcher.search(query, num_results=config.get("llm_search_results", 5))
                    except Exception as e:  # noqa: BLE001
                        _log_error(f"LLM search fallback failed for '{query}': {e}")
                        results = []

                _log_info(f"    {len(results)} résultats en {q_elapsed:.1f}s")

                for result in results:
                    if total_new >= limit:
                        break

                    url = result.url
                    parsed = urlparse(url)
                    domain = normalize_domain(parsed.netloc or url)

                    if not domain or "." not in domain:
                        continue

                    # Skip noise domains
                    noise_domains = {
                        "facebook.com", "instagram.com", "twitter.com", "x.com",
                        "youtube.com", "linkedin.com", "tiktok.com",
                        "pinterest.com", "github.com", "gitlab.com"
                    }
                    if domain in noise_domains:
                        continue

                    company_data = {
                        "domain": domain,
                        "name": result.title or domain.split(".")[0].capitalize(),
                        "website": result.url,
                        "description": result.snippet,
                        "source": "google",
                        "status": ProspectStatus.DISCOVERED,
                    }

                    existing = crm.get_company_by_domain(domain)
                    if existing:
                        total_skipped += 1
                        continue

                    cid = crm.upsert_company(company_data)
                    crm.add_event(cid, "discovered", {"query": query, "market": market_code})
                    total_found += 1
                    total_new += 1

    finally:
        searcher.close()

    elapsed = time.time() - start
    _log_info(f"Discovery terminée: {total_new} nouveaux, {total_skipped} ignorés, "
              f"{elapsed:.1f}s")

    return PipelineResult(
        stage="discovery",
        success=True,
        processed=total_new,
        errors=total_skipped,
        details={"found": total_found, "new": total_new, "skipped": total_skipped}
    )


def qualify_stage(
    crm: CRM,
    llm: Any,  # not used, heuristic only
    limit: int = 15,
    config: Optional[dict] = None
) -> PipelineResult:
    """Qualification stage: score companies using MailGuardPro heuristics."""
    _log_info("Étape qualification: scoring des entreprises (heuristique MailGuardPro)")

    config = config or {}

    icp = load_icp_raw("config/icp.json")
    min_score = config.get("min_score", icp.get("min_score_to_qualify", 60))

    summary = qualify_heuristic(
        crm=crm,
        limit=limit,
        icp=icp,
        min_score=min_score,
        is_heuristic_mode=is_heuristic_mode(),
        fallback_heuristic=True,
    )

    return PipelineResult(
        stage="qualify",
        success=True,
        processed=summary.get("scored", 0),
        errors=summary.get("errors", 0),
        details={
            "qualified": summary.get("qualified", 0),
            "dropped": summary.get("dropped", 0),
            "scored": summary.get("scored", 0),
        }
    )


def enrich_stage(
    crm: CRM,
    llm: Any,  # not used in this stage
    limit: int = 20,
    config: Optional[dict] = None
) -> PipelineResult:
    """Enrichment stage: site harvesting + email verification + decision makers."""
    _log_info("Étape enrichissement: site harvest + email verification (MailGuardPro)")

    config = config or {}

    verify_emails = config.get("verify_emails", True)
    max_workers = config.get("max_workers", 6)

    summary = enrich_companies(
        crm=crm,
        limit=limit,
        verify_emails=verify_emails,
        max_workers=max_workers,
    )

    return PipelineResult(
        stage="enrich",
        success=True,
        processed=summary.get("enriched", 0),
        errors=summary.get("errors", 0),
        details={
            "enriched": summary.get("enriched", 0),
            "contacts_added": summary.get("contacts_added", 0),
            "emails_verified": summary.get("emails_verified", 0),
        }
    )


def personalize_stage(
    crm: CRM,
    llm: Any,  # not used, templates + optional LLM
    limit: int = 20,
    config: Optional[dict] = None
) -> PipelineResult:
    """Personalization stage: generate email drafts from templates + LLM."""
    _log_info("Étape personnalisation: génération de brouillons (templates + LLM)")

    config = config or {}

    icp = load_icp_raw("config/icp.json")
    use_llm = config.get("use_llm", is_configured()) and not is_heuristic_mode()
    template_pref = config.get("template", "direct_cold_email")

    drafted = 0
    reviewed = 0
    errors = 0

    companies = crm.get_companies(status="enriched", limit=limit)

    for company in companies:
        try:
            result = personalize_message(
                crm=crm,
                company=company,
                icp=icp,
                preference=template_pref,
                use_llm=use_llm,
                templates=TEMPLATES,
            )

            # Store draft
            crm.add_draft({
                "company_id": company["id"],
                "subject": result["subject"],
                "body": result["body"],
                "template_id": result["template_id"],
                "llm_used": result.get("llm_used", False),
                "needs_review": result.get("needs_review", True),
                "completeness": result.get("completeness_score", 0.0),
            })

            drafted += 1
            if result.get("needs_review"):
                reviewed += 1

        except Exception as e:  # noqa: BLE001
            _log_error(f"Erreur personnalisation {company.get('domain', 'unknown')}: {e}")
            errors += 1

    return PipelineResult(
        stage="personalize",
        success=True,
        processed=len(companies),
        errors=errors,
        details={
            "drafted": drafted,
            "needs_review": reviewed,
        }
    )


def send_stage(
    crm: CRM,
    llm: Any,
    dry_run: bool = None,
    config: Optional[dict] = None
) -> PipelineResult:
    """Send stage: send pending emails (respects DRY_RUN)."""
    config = config or {}
    from src.email_sender.sender import send_email, is_configured as email_configured

    dry = is_dry_run() if dry_run is None else dry_run
    _log_info(f"Étape envoi: {'DRY_RUN' if dry else 'LIVE'} envoi emails")

    if not dry and not email_configured():
        _log_error("Email non configuré (RESEND_API_KEY manquant) - forcé DRY_RUN")
        dry = True

    sent = 0
    failed = 0
    skipped = 0

    drafts = crm.get_pending_drafts(limit=config.get("send_limit", 50))

    for draft in drafts:
        try:
            company = crm.get_company(draft["company_id"])
            if not company:
                _log_error(f"Company {draft['company_id']} not found")
                failed += 1
                continue

            contact = crm.get_best_contact(company["id"])
            if not contact or not contact.get("email"):
                _log_error(f"No valid contact for {company.get('domain')}")
                failed += 1
                continue

            if dry:
                # Mark as sent in CRM
                crm.mark_draft_sent(draft["id"], resend_id=f"dry_run_{datetime.utcnow().timestamp()}")
                crm.update_status(company["domain"], ProspectStatus.SENT.value, None)
                crm.add_event(company["id"], "email_sent", {
                    "draft_id": draft["id"],
                    "contact_email": contact["email"],
                    "dry_run": True,
                })
                sent += 1
                _log_info(f"  DRY_RUN sent: {company['name']} -> {contact['email']}")
            else:
                # Actual send via Resend
                res = send_email(
                    to=contact["email"],
                    subject=draft["subject"],
                    html=draft["body"],
                    company_domain=company["domain"],
                )
                if res.get("success"):
                    crm.mark_draft_sent(draft["id"], resend_id=res.get("id"))
                    crm.update_status(company["domain"], ProspectStatus.SENT.value, None)
                    crm.add_event(company["id"], "email_sent", {
                        "draft_id": draft["id"],
                        "contact_email": contact["email"],
                        "resend_id": res.get("id"),
                    })
                    sent += 1
                    _log_info(f"  SENT: {company['name']} -> {contact['email']} (id: {res.get('id')})")
                else:
                    crm.add_event(company["id"], "email_failed", {
                        "draft_id": draft["id"],
                        "error": res.get("error"),
                    })
                    failed += 1

        except Exception as e:  # noqa: BLE001
            _log_error(f"Erreur envoi draft {draft.get('id', 'unknown')}: {e}")
            failed += 1

    return PipelineResult(
        stage="send",
        success=True,
        processed=len(drafts),
        errors=failed,
        details={"sent": sent, "failed": failed, "dry_run": dry}
    )


def replies_stage(
    crm: CRM,
    domain: str,
    config: Optional[dict] = None
) -> PipelineResult:
    """Mark a company as having replied."""
    _log_info(f"Étape réponses: marquer {domain} comme répondu")

    try:
        company = crm.get_company_by_domain(domain)
        if not company:
            return PipelineResult(
                stage="replies",
                success=False,
                errors=1,
                details={"error": "unknown_domain"}
            )

        crm.update_status(domain, ProspectStatus.REPLIED.value, None)
        crm.add_event(company["id"], "reply_marked", {"by": "manual"})

        return PipelineResult(
            stage="replies",
            success=True,
            processed=1,
            errors=0,
            details={"replied": domain}
        )

    except Exception as e:  # noqa: BLE001
        _log_error(f"Erreur marquage réponse {domain}: {e}")
        return PipelineResult(
            stage="replies",
            success=False,
            errors=1,
            details={"error": str(e)}
        )


def stats_stage(crm: CRM) -> dict:
    """Stats stage: return CRM statistics."""
    return crm.stats()