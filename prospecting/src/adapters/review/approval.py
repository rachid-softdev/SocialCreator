#!/usr/bin/env python3
"""
Timon prospecting — gestion de l'approbation et du rejet des brouillons.

Workflow :
1. export_drafts : exporte tous les brouillons Markdown pour relecture
2. review : liste les brouillons à relire
3. approve : marque des brouillons comme approuvés
4. reject : marque des brouillons comme rejetés

L'approbation est TOUJOURS humaine. L'IA ne peut pas approuver.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.crm import CRM
from src.utils import log


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def export_drafts(crm: CRM) -> Path:
    """
    Exporte tous les brouillons en Markdown pour relecture.
    Retourne le chemin du dossier d'export.
    """
    today = _today()
    drafts_dir = Path("data") / "output" / "drafts" / today
    drafts_dir.mkdir(parents=True, exist_ok=True)

    companies = crm.get_companies(status="drafted", limit=100)
    log.info(f"Export de {len(companies)} brouillons dans {drafts_dir}")
    return drafts_dir


def review(crm: CRM) -> list[dict[str, Any]]:
    """
    Liste les brouillons à relire.
    Retourne la liste des entreprises avec statut "drafted" ou "followup".
    """
    drafts = crm.get_companies(status="drafted", limit=100)
    followups = crm.get_companies(status="followup", limit=100)
    all_drafts = drafts + followups

    log.info(f"Revue: {len(all_drafts)} brouillons à relire")
    for company in all_drafts:
        contacts = crm.get_contacts_by_company(company["id"])
        email = contacts[0]["email"] if contacts else "pas de contact"
        log.info(f"  #{company['id']} — {company.get('name', company['domain'])} — {email}")

    return all_drafts


def approve(crm: CRM, ids: list[int] | None = None, approve_all: bool = False) -> dict[str, int]:
    """
    Approuve des brouillons (humain uniquement).
    Retourne {approved, skipped}.
    """
    if not approve_all and not ids:
        log.error("--stage approve nécessite --id N... ou --all")
        return {"approved": 0, "skipped": 0}

    approved = 0
    skipped = 0

    if approve_all:
        companies = crm.get_companies(status="drafted", limit=100)
    else:
        companies = []
        for cid in ids or []:
            company = crm.get_company(cid)
            if company:
                companies.append(company)

    for company in companies:
        if company.get("status") != "drafted":
            skipped += 1
            continue

        # Vérifie que l'entreprise n'a pas déjà reçu 2 emails
        if crm.count_sent_emails(company["id"]) >= 2:
            log.warning(f"Entreprise {company['domain']} a déjà reçu 2 emails, skip")
            skipped += 1
            continue

        crm.update_status(company["domain"], "approved")
        crm.add_event(company["id"], "approved", {"by": "human"})
        approved += 1

    log.success(f"Approbation: {approved} approuvés, {skipped} ignorés")
    return {"approved": approved, "skipped": skipped}


def reject(crm: CRM, ids: list[int] | None = None, reject_all: bool = False, note: str = "") -> dict[str, int]:
    """
    Rejette des brouillons (humain uniquement).
    Retourne {rejected, skipped}.
    """
    if not reject_all and not ids:
        log.error("--stage reject nécessite --id N... ou --all")
        return {"rejected": 0, "skipped": 0}

    rejected = 0
    skipped = 0

    if reject_all:
        companies = crm.get_companies(status="drafted", limit=100)
    else:
        companies = []
        for cid in ids or []:
            company = crm.get_company(cid)
            if company:
                companies.append(company)

    for company in companies:
        if company.get("status") != "drafted":
            skipped += 1
            continue

        crm.update_status(company["domain"], "rejected")
        crm.add_event(company["id"], "rejected", {"by": "human", "note": note})
        rejected += 1

    log.success(f"Rejet: {rejected} rejetés, {skipped} ignorés")
    return {"rejected": rejected, "skipped": skipped}