"""CLI entry point for unified prospecting pipeline.

Usage:
    python run.py [--stage STAGE] [--dry-run] [--limit N] [--debug] [--stage-timeout N]
    python run.py --stage replies --domain example.fr
    python run.py --stage stats

Stages:
    all         pipeline complet (par défaut)
    discovery   recherche Google de nouvelles entreprises
    qualify     qualification IA (score 0-100)
    enrich      décideurs + emails vérifiés
    personalize génère les brouillons d'emails initiaux
    send        envoie les brouillons (quota + DRY_RUN)
    replies     marque une entreprise comme ayant répondu (--domain)
    stats       résumé du CRM
 """

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))

from src.config import load_config_from_env
from src.lock import RunnerLock
from src.utils import log
from src.crm import CRM
from src.llm import LLMManager
from src.pipeline.stages import (
    discover_stage, qualify_stage, enrich_stage,
    personalize_stage, send_stage, replies_stage, stats_stage
)
from src.notifications import send_discord_summary


def stage_discovery(crm: CRM, llm: LLMManager, limit: int, stage_timeout: int = None) -> dict:
    from src.pipeline.stages import discover_stage
    result = discover_stage(crm, llm, limit, stage_timeout=stage_timeout)
    return result.to_dict()


def stage_qualify(crm: CRM, llm: LLMManager, limit: int, stage_timeout: int = None) -> dict:
    from src.pipeline.stages import qualify_stage
    result = qualify_stage(crm, llm, limit)
    return result.to_dict()


def stage_enrich(crm: CRM, llm: LLMManager, limit: int, stage_timeout: int = None) -> dict:
    from src.pipeline.stages import enrich_stage
    result = enrich_stage(crm, llm, limit)
    return result.to_dict()


def stage_personalize(crm: CRM, llm: LLMManager, limit: int, stage_timeout: int = None) -> dict:
    from src.pipeline.stages import personalize_stage
    result = personalize_stage(crm, llm, limit)
    return result.to_dict()


def stage_send(crm: CRM, llm: LLMManager, dry_run: bool) -> dict:
    from src.pipeline.stages import send_stage
    result = send_stage(crm, llm, dry_run)
    return result.to_dict()


def stage_replies(crm: CRM, domain: str) -> dict:
    from src.pipeline.stages import replies_stage
    result = replies_stage(crm, domain)
    return result.to_dict()


def stage_stats(crm: CRM) -> dict:
    from src.pipeline.stages import stats_stage
    return stats_stage(crm)


def stage_directory(crm: CRM, llm: LLMManager, limit: int, source: str = "webstratege") -> dict:
    from src.adapters.discovery.directory_discovery import discover_from_directory
    result = discover_from_directory(crm, source=source, limit=limit)
    return {"stage": "directory", "success": True, **result}


def stage_followups(crm: CRM, llm: LLMManager, limit: int) -> dict:
    from src.adapters.personalization.followups import generate_followups
    result = generate_followups(crm, limit=limit, llm=llm)
    return {"stage": "followups", "success": True, **result}


def stage_approve(crm: CRM, ids: list = None, approve_all: bool = False) -> dict:
    from src.adapters.review.approval import approve
    result = approve(crm, ids=ids, approve_all=approve_all)
    return {"stage": "approve", "success": True, **result}


def stage_reject(crm: CRM, ids: list = None, reject_all: bool = False, note: str = "") -> dict:
    from src.adapters.review.approval import reject
    result = reject(crm, ids=ids, reject_all=reject_all, note=note)
    return {"stage": "reject", "success": True, **result}


def stage_review(crm: CRM) -> dict:
    from src.adapters.review.approval import review
    from src.adapters.review.review_report import export_review_markdown
    drafts = review(crm)
    report_path = export_review_markdown(crm)
    return {"stage": "review", "success": True, "drafts_to_review": len(drafts),
            "report_path": str(report_path)}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Agent de prospection autonome (unifié)"
    )
    parser.add_argument(
        "--stage",
        choices=["all", "discovery", "directory", "qualify", "enrich", "personalize",
                 "send", "replies", "followups", "approve", "reject", "review", "stats",
                 "import-signavia"],
        default="all",
        help="étape à exécuter (défaut: all)"
    )
    parser.add_argument(
        "--stage-timeout",
        type=int,
        default=300,
        help="délai maximal par étape en secondes (défaut: 300s)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="force le mode sec (aucun envoi)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="limite de prospects pour l'étape"
    )
    parser.add_argument(
        "--domain",
        type=str,
        default=None,
        help="domaine pour --stage replies"
    )
    parser.add_argument(
        "--source",
        type=str,
        default="webstratege",
        help="annuaire source pour --stage directory"
    )
    parser.add_argument(
        "--source-path",
        type=str,
        default=None,
        help="chemin source pour --stage import-signavia"
    )
    parser.add_argument(
        "--id",
        type=int,
        action="append",
        default=None,
        help="ID d'entreprise pour --stage approve/reject (répétable)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="approve_all",
        help="approuver/rejeter tous les brouillons"
    )
    parser.add_argument(
        "--note",
        type=str,
        default="",
        help="note pour --stage reject"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="logs verbeux"
    )
    args = parser.parse_args()

    if args.debug:
        log.debug_enabled = True

    # Load configuration
    config = load_config_from_env()
    runner_host = config.runner_host

    # CRM initialization
    crm = CRM(config.crm.__dict__)
    llm = LLMManager(config.llm.__dict__)

    if args.stage == "replies":
        if not args.domain:
            log.error("--stage replies nécessite --domain example.fr")
            return 1
        result = stage_replies(crm, args.domain)
        print(json.dumps(result, indent=2))
        crm.close()
        return 0

    if args.stage == "stats":
        result = stage_stats(crm)
        print(json.dumps(result, indent=2))
        crm.close()
        return 0

    if args.stage == "approve":
        result = stage_approve(crm, ids=args.id, approve_all=args.approve_all)
        print(json.dumps(result, indent=2))
        crm.close()
        return 0

    if args.stage == "reject":
        result = stage_reject(crm, ids=args.id, reject_all=args.approve_all, note=args.note)
        print(json.dumps(result, indent=2))
        crm.close()
        return 0

    if args.stage == "review":
        result = stage_review(crm)
        print(json.dumps(result, indent=2))
        crm.close()
        return 0

    if args.stage == "import-signavia":
        from src.import_signavia import import_signavia
        source_path = args.source_path or r"D:\git-projects\Signavia\signavia-prospecting"
        result = import_signavia(crm, source_path, args.limit, args.dry_run)
        print(json.dumps(result, indent=2))
        crm.close()
        return 0

    dry_run = args.dry_run or config.email.dry_run
    if dry_run:
        log.warning("🔒 DRY_RUN actif : découverte/qualification/enrichissement OK, "
                    "aucun email ne partira")

    # Runner lock
    if not RunnerLock.acquire_or_skip(config.lock_path, runner_host):
        log.warning("⏭️ Un autre runner est en cours d'exécution, on passe")
        crm.close()
        return 0

    summary = {}
    start = time.time()
    stage_timeout = args.stage_timeout
    try:
        stages = [
            "discovery", "qualify", "enrich",
            "personalize", "send"
        ] if args.stage == "all" else [args.stage]

        for stage in stages:
            t_stage = time.time()
            log.info(f"━━━ Étape: {stage} ━━━ (timeout: {stage_timeout}s)")
            if stage == "discovery":
                limit = args.limit if args.limit is not None else 5
                summary[stage] = stage_discovery(crm, llm, limit, stage_timeout=stage_timeout)
            elif stage == "directory":
                summary[stage] = stage_directory(crm, llm, args.limit or 15, args.source)
            elif stage == "qualify":
                limit = args.limit if args.limit is not None else 10
                summary[stage] = stage_qualify(crm, llm, limit)
            elif stage == "enrich":
                summary[stage] = stage_enrich(crm, llm, args.limit or 5, stage_timeout=stage_timeout)
            elif stage == "personalize":
                summary[stage] = stage_personalize(crm, llm, args.limit or 5, stage_timeout=stage_timeout)
            elif stage == "followups":
                summary[stage] = stage_followups(crm, llm, args.limit or 20)
            elif stage == "send":
                summary[stage] = stage_send(crm, llm, dry_run)
            else:
                summary[stage] = {"stage": stage, "success": True, "processed": 0, "errors": 0}
            t_elapsed = time.time() - t_stage
            log.info(f"━━━ Étape: {stage} terminée en {t_elapsed:.1f}s ━━━")
    finally:
        RunnerLock.release(config.lock_path)

    elapsed = time.time() - start
    summary["_elapsed_seconds"] = round(elapsed, 1)

    send_discord_summary(summary)

    log.success(f"✅ Run terminé en {elapsed:.1f}s")
    crm.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
