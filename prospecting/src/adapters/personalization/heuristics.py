#!/usr/bin/env python3
"""
Heuristics for email personalization and template filling.

Ported from MailGuardPro's personalization heuristics with battle-tested
sector-specific insights for B2B cold email/outbound/lead generation.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from src.utils import log
from src.crm import CRM


# ============================================================
# SECTOR KEYWORDS (from MailGuardPro qualifier.py signals)
# ============================================================

SECTOR_KEYWORDS = {
    "cold_email": [
        "cold email", "cold outreach", "outbound", "lead generation",
        "lead gen", "prospection", "email marketing", "e-mailing",
        "newsletter", "marketing automation", "klaviyo", "hubspot",
        "mailchimp", "revops", "demand generation", "sales enablement",
        "sdr", "b2b", "saas", "e-commerce", "ecommerce", "shopify",
    ],
    "email_marketing": [
        "email marketing", "e-mailing", "newsletter", "marketing automation",
        "klaviyo", "hubspot", "mailchimp", "deliverability", "délivrabilité",
    ],
    "saas": [
        "saas", "software", "b2b saas", "platform", "cloud", "api",
        "integration", "web app", "mobile app",
    ],
    "ecommerce": [
        "e-commerce", "ecommerce", "shopify", "woocommerce", "magento",
        "prestashop", "marketplace", "dropshipping", "retail",
    ],
    "agency": [
        "agence", "agency", "marketing", "digital", "web", "seo",
        "growth", "acquisition", "consulting", "conseil",
    ],
}

# French/English insights per sector
INSIGHTS_FR = {
    "cold_email": {
        "accroche": "Vos campagnes d'outbound atteignent-elles vraiment la boîte de réception ?",
        "pertinence": "En tant qu'acteur de la prospection, vous savez que la délivrabilité fait la différence entre un pipeline vide et un agenda plein.",
    },
    "email_marketing": {
        "accroche": "Vos newsletters arrivent-elles en principal ou en spam ?",
        "pertinence": "Avec les nouvelles règles Gmail/Yahoo, même les meilleurs contenus peuvent être filtrés sans une infrastructure adaptée.",
    },
    "saas": {
        "accroche": "Combien de leads qualifiés perdez-vous par mauvaise délivrabilité ?",
        "pertinence": "Pour une SaaS B2B, chaque email transactionnel ou marketing qui n'arrive pas = du MRR laissé sur la table.",
    },
    "ecommerce": {
        "accroche": "Vos emails transactionnels et abandon panier convertissent-ils au maximum ?",
        "pertinence": "En e-commerce, un email de récupération qui atterrit en spam = un client perdu définitivement.",
    },
    "agency": {
        "accroche": "Gérez-vous la délivrabilité pour vos clients ou sous-traitez-vous l'incertitude ?",
        "pertinence": "Les agences qui maîtrisent la délivrabilité gardent leurs clients plus longtemps et justifient des retainers plus élevés.",
    },
    "default": {
        "accroche": "Votre délivrabilité email suit-elle vos ambitions de croissance ?",
        "pertinence": "Quelle que soit votre activité, un email qui n'arrive pas est une opportunité manquée.",
    },
}

INSIGHTS_EN = {
    "cold_email": {
        "accroche": "Are your outbound campaigns actually hitting the inbox?",
        "pertinence": "As a prospecting player, you know deliverability makes the difference between an empty pipeline and a full calendar.",
    },
    "email_marketing": {
        "accroche": "Do your newsletters land in primary or spam?",
        "pertinence": "With new Gmail/Yahoo rules, even the best content gets filtered without proper infrastructure.",
    },
    "saas": {
        "accroche": "How many qualified leads are you losing to poor deliverability?",
        "pertinence": "For B2B SaaS, every transactional or marketing email that fails to deliver = MRR left on the table.",
    },
    "ecommerce": {
        "accroche": "Are your transactional and cart abandonment emails converting at max?",
        "pertinence": "In e-commerce, a recovery email landing in spam = a customer lost forever.",
    },
    "agency": {
        "accroche": "Do you manage deliverability for clients or outsource uncertainty?",
        "pertinence": "Agencies mastering deliverability retain clients longer and justify higher retainers.",
    },
    "default": {
        "accroche": "Does your email deliverability match your growth ambitions?",
        "pertinence": "Whatever your business, an email that doesn't arrive is a missed opportunity.",
    },
}


def _detect_sector(company: Dict[str, Any]) -> str:
    """Detect the most relevant sector from company data."""
    text = " ".join(str(company.get(k) or "") for k in
                    ("name", "description", "sector", "domain")).lower()

    scores = {}
    for sector, keywords in SECTOR_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > 0:
            scores[sector] = score

    if not scores:
        return "default"

    # Return sector with highest score
    return max(scores, key=scores.get)


def email_insight(company: Dict[str, Any], lang: str = "fr") -> Tuple[str, str]:
    """
    Return (accroche, pertinence) for a company based on its sector.

    Args:
        company: Company dict with name, description, sector, domain
        lang: "fr" for French, "en" for English

    Returns:
        Tuple of (accroche, pertinence) strings
    """
    sector = _detect_sector(company)
    insights = INSIGHTS_FR if lang == "fr" else INSIGHTS_EN
    sector_insights = insights.get(sector, insights["default"])

    accroche = sector_insights.get("accroche", insights["default"]["accroche"])
    pertinence = sector_insights.get("pertinence", insights["default"]["pertinence"])

    log.debug(f"email_insight: {company.get('domain', 'unknown')} -> sector={sector}, lang={lang}")
    return accroche, pertinence


def fill_template(template: str, values: Dict[str, Any]) -> str:
    """
    Replace {{clé}} variables in a template string with values from dict.

    Args:
        template: String containing {{variable}} placeholders
        values: Dict mapping variable names to values

    Returns:
        Filled template string
    """
    if not template:
        return ""

    def _replace_var(match):
        var = match.group(1).strip()
        if var in values:
            val = values[var]
            return str(val) if val is not None else ""
        # Check for nested keys like {{company.name}}
        if "." in var:
            parts = var.split(".")
            current = values
            for part in parts:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    return ""
            return str(current) if current is not None else ""
        return ""

    result = re.sub(r"\{\{([^}]+)\}\}", _replace_var, template)
    return result


def fill_template_with_conditions(template: str, values: Dict[str, Any]) -> str:
    """
    Fill template with {{var}} replacement and {% if var %}...{% endif %} conditionals.

    Similar to personalizer.py's _fill_template but standalone.
    """
    if not template:
        return ""

    # First pass: replace simple {{var}}
    def _replace_var(match):
        var = match.group(1).strip()
        if var in values:
            val = values[var]
            return str(val) if val is not None else ""
        if "." in var:
            parts = var.split(".")
            current = values
            for part in parts:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    return ""
            return str(current) if current is not None else ""
        return ""

    result = re.sub(r"\{\{([^}]+)\}\}", _replace_var, template)

    # Second pass: handle conditionals {% if var %}...{% endif %}
    if_blocks = re.findall(r"\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}",
                           result, re.DOTALL)
    for cond, content in if_blocks:
        condition_var = cond.strip()
        cond_true = False

        if condition_var in values and str(values[condition_var]).strip():
            cond_true = True
        elif condition_var == "has_decision_maker":
            cond_true = True  # default fallback

        if cond_true:
            clean = re.sub(r"\{%\s*(if|endif)\s*%\}", "", content)
            result = result.replace("{% if " + cond + " %}" + content + "{% endif %}", clean, 1)
        else:
            result = result.replace("{% if " + cond + " %}" + content + "{% endif %}", "")

    return result


# For backwards compatibility and explicit exports
__all__ = [
    "email_insight",
    "fill_template",
    "fill_template_with_conditions",
    "SECTOR_KEYWORDS",
    "INSIGHTS_FR",
    "INSIGHTS_EN",
]