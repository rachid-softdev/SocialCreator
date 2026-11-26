#!/usr/bin/env python3
"""
Timon prospecting — export du rapport de revue Markdown.

Génère un rapport lisible listant tous les brouillons à relire.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.crm import CRM
from src.utils import log


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def export_review_markdown(crm: CRM) -> Path:
    """
    Exporte un rapport de revue Markdown dans data/output/review/.
    Retourne le chemin du rapport.
    """
    review_dir = Path("data") / "output" / "review"
    review_dir.mkdir(parents=True, exist_ok=True)

    today = _today()
    report_path = review_dir / f"rapport-{today}.md"

    drafts = crm.get_companies(status="drafted", limit=100)
    followups = crm.get_companies(status="followup", limit=100)
    approved = crm.get_companies(status="approved", limit=100)
    rejected = crm.get_companies(status="rejected", limit=100)

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# Revue du {today}\n\n")
        f.write(f"## Résumé\n\n")
        f.write(f"- Brouillons à relire : {len(drafts)}\n")
        f.write(f"- Relances à relire : {len(followups)}\n")
        f.write(f"- Approuvés : {len(approved)}\n")
        f.write(f"- Rejetés : {len(rejected)}\n\n")

        if drafts:
            f.write(f"## À approuver\n\n")
            for company in drafts:
                contacts = crm.get_contacts_by_company(company["id"])
                email = contacts[0]["email"] if contacts else "pas de contact"
                f.write(f"- #{company['id']} — {company.get('name', company['domain'])} — {email}\n")
            f.write("\n")

        if followups:
            f.write(f"## Relances à relire\n\n")
            for company in followups:
                contacts = crm.get_contacts_by_company(company["id"])
                email = contacts[0]["email"] if contacts else "pas de contact"
                f.write(f"- #{company['id']} — {company.get('name', company['domain'])} — {email}\n")
            f.write("\n")

        if approved:
            f.write(f"## Approuvés (prêts à envoyer)\n\n")
            for company in approved:
                contacts = crm.get_contacts_by_company(company["id"])
                email = contacts[0]["email"] if contacts else "pas de contact"
                f.write(f"- #{company['id']} — {company.get('name', company['domain'])} — {email}\n")
            f.write("\n")

    log.success(f"Rapport de revue: {report_path}")
    return report_path