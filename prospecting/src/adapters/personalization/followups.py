#!/usr/bin/env python3
"""
Timon prospecting — génération de relances (follow-ups).

Pour chaque prospect qui a reçu un email initial il y a 3+ jours sans réponse :
1. Construit un prompt de relance
2. Appelle le LLM (ou fallback template)
3. Génère un brouillon de relance
4. Met à jour le statut CRM en "followup"
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from src.crm import CRM
from src.llm import LLMManager
from src.utils import log


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _days_since_sent(sent_at: str) -> int:
    """Calcule le nombre de jours depuis un timestamp ISO."""
    try:
        sent_date = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return (now - sent_date).days
    except Exception:
        return 0


def _build_followup_prompt(company: dict[str, Any], contact: dict[str, Any], lang: str,
                           llm: LLMManager) -> str:
    """Construit le prompt de relance."""
    # Utiliser le gestionnaire LLM pour appeler l'API
    segment = company.get("segment", "")
    campaigns = llm.config.get("campaigns_config") if hasattr(llm, 'config') else None
    if campaigns is None:
        # Tentative de chargement via heuristique si pas de config
        campaigns = {"segments": {}}

    segments = campaigns.get("segments", {})
    segment_config = segments.get(segment, {})

    context = f"""## Prospect

- Nom : {company.get('name', 'inconnu')}
- Domaine : {company.get('domain', 'inconnu')}
- Segment : {segment}

## Contact

- Prénom : {contact.get('first_name', '')}

## Contexte

Le prospect a reçu un email initial il y a 3 jours, sans réponse.
Langue de l'email : {lang}

## Angle du segment

{segment_config.get('angle', 'Découvrir leur activité et proposer une démo.')}

## Preuve

{segment_config.get('proof', '')}

## Instructions

Rédige la relance selon les règles du prompt ci-dessus.
"""
    return context


def _fallback_followup(company: dict[str, Any], contact: dict[str, Any], lang: str) -> dict[str, str]:
    """Génère une relance de fallback."""
    first_name = contact.get("first_name", "")
    company_name = company.get("name", company.get("domain", ""))

    if lang == "en":
        subject = f"Re: {company_name} — operational cockpit"
        body = (
            f"Hi {first_name},\n\n"
            f"Just following up on my previous message.\n\n"
            f"I thought a quick example might help: teams similar to {company_name} "
            f"often save 2-3 hours per week by centralizing their pipeline and tasks "
            f"in Timon.\n\n"
            f"Would a 15-minute demo be relevant for you?\n\n"
            f"Best regards,\n"
        )
    else:
        subject = f"Re: {company_name} — cockpit opérationnel"
        body = (
            f"Bonjour {first_name},\n\n"
            f"Je me permets de revenir vers vous suite à mon précédent message.\n\n"
            f"Un exemple concret : des équipes similaires à {company_name} "
            f"gagnent souvent 2 à 3 heures par semaine en centralisant leur pipeline "
            f"et leurs tâches dans Timon.\n\n"
            f"Une démo de 15 minutes serait-elle pertinente pour vous ?\n\n"
            f"Bonne journée,\n"
        )

    return {"subject": subject[:50], "body": body}


def _call_llm_json(prompt: str, llm: LLMManager) -> dict:
    """Call LLM and parse JSON response."""
    result = llm.call(prompt)
    text = result.get("text", "")
    try:
        # Try to extract JSON from the response
        import re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except (json.JSONDecodeError, Exception):
        pass
    # Return fallback if JSON parsing fails
    return {}


def generate_followups(crm: CRM, limit: int = 20, llm: LLMManager = None) -> dict[str, int]:
    """
    Génère des relances pour les prospects sans réponse après 3+ jours.
    Retourne {followups, errors}.
    """
    if llm is None:
        llm = LLMManager()

    # Trouve les entreprises "sent" sans réponse
    companies = crm.get_companies(status="sent", limit=100)
    stats = {"followups": 0, "errors": 0}

    for company in companies:
        company_id = company["id"]
        domain = company.get("domain", "")

        # Vérifie le nombre d'emails envoyés
        sent_count = crm.count_sent_emails(company_id)
        if sent_count >= 2:
            continue

        # Vérifie si le dernier envoi date de 3+ jours
        events = crm.get_events(company_id)
        # Filtre les événements de type email_sent_initial
        sent_events = [e for e in events if e.get("event_type") == "email_sent_initial"]
        last_sent = None
        for event in sent_events:
            last_sent = event["created_at"]
            break

        if not last_sent:
            continue

        days = _days_since_sent(last_sent)
        if days < 3:
            continue

        # Vérifie la suppression
        if crm.is_suppressed(domain=domain):
            continue

        # Récupère les contacts
        contacts = crm.get_contacts_by_company(company_id)
        if not contacts:
            continue

        contact = contacts[0]
        market = company.get("market", "fr")
        lang = "en" if market == "intl" else "fr"

        log.info(f"Relance: {domain} (J+{days})")

        try:
            prompt = _build_followup_prompt(company, contact, lang, llm)
            system = "Tu es un expert en rédaction de relances B2B courtes. Réponds uniquement avec un JSON valide."
            result = _call_llm_json(prompt, llm)
        except Exception as exc:
            log.warning(f"LLM échec pour {domain}, fallback template: {exc}")
            result = _fallback_followup(company, contact, lang)
            stats["errors"] += 1

        subject = result.get("subject", "")
        body = result.get("body", "")

        # Crée le brouillon de relance
        today = _today()
        from pathlib import Path
        draft_dir = Path("data") / "output" / "drafts" / today
        draft_dir.mkdir(parents=True, exist_ok=True)
        draft_path = draft_dir / f"{domain.replace('.', '_')}_followup.md"

        # Footer from LLM config if available
        campaigns = llm.config.get("campaigns_config") if hasattr(llm, 'config') else None
        footer = campaigns.get("email_footer_fr", "") if campaigns and lang == "fr" else \
            (campaigns.get("email_footer_en", "") if campaigns else "")
        full_body = f"{body}\n\n---\n{footer}"

        with open(draft_path, "w", encoding="utf-8") as f:
            f.write(f"# Relance — {company.get('name', domain)}\n\n")
            f.write(f"**To:** {contact.get('email', '')}\n")
            f.write(f"**Subject:** {subject}\n\n")
            f.write(f"---\n\n{full_body}\n")

        crm.update_status(domain, "followup")
        crm.add_event(company_id, "followup_drafted", {
            "subject": subject,
            "days_since": days,
            "draft_path": str(draft_path),
        })
        stats["followups"] += 1

    log.success(f"Relances: {stats['followups']} générées")
    return stats