"""
Personalizer with templates + LLM fallback.

Ported from MailGuardPro's personalize.ts with battle-tested
email templates and progressive validation.
"""

import json
import re
import os
from typing import Any, Dict, List, Optional, Tuple

from .prospecting_types import Company as CompanyType
from .utils import log


# ============================================================
# CANONICAL TEMPLATES (battle-tested from production runs)
# ============================================================

TEMPLATES = [
    # Template 0: Direct cold email - personalized subject + body
    {
        "id": "t0_direct",
        "name": "direct_cold_email",
        "subject": "Quick question about {{company_name}}",
        "body": "Bonjour {{first_name}},\n\nJ'ai repéré {{company_name}} sur Google et j'ai quelques idées pour {{lowercase_first_name}}.\n\nActuellement, beaucoup d'agences comme les vôtres rencontrent {{pain_point}}.\n\nNotre approche aide les entreprises comme la vôtre à {{benefit}} en {{timeframe}}.\n\n{%- if has_decision_maker %}\nOn dirait que vous gérez {{specific_area}}. Avez-vous déjà testé {{alternative}} ?\n{%- endif %}\n\nTenez-vous au courant,\n{{your_name}}\n{{your_company}}\n{{your_email}}",
    },
    # Template 1: Agency-specific value prop
    {
        "id": "t1_agency",
        "name": "agency_value_prop",
        "subject": "Croissance agence {{company_name}} - 3 idées",
        "body": "Bonjour {{first_name}},\n\nFélicitations pour le rachat/relaunch de {{company_name}}.\n\nJ'ai remarqué que vous aidez {{type_client}} à {{resultat}}.\n\nNotre équipe a aidé {{ref_agency}} à {{ref_resultat}} en {{duree}} avec {{outil}}.\n\n{%- if has_decision_maker %}\nVous semblez être le décideur pour {{specific_area}}. On pourrait peut-être\ncollaborer sur {{proposal}}.  \n{%- endif %}\n\nCordialement,\n{{your_name}}\n{{your_company}}\n{{your_email}}",
    },
    # Template 2: Problem-agitate-solve
    {
        "id": "t2_pas",
        "name": "pas",
        "subject": "Vous perdez des prospects, {{first_name}} ?",
        "body": "Bonjour {{first_name}},\n\nBeaucoup d'agences que j'accompagne perdent {{perte_metric}} chaque mois\nà cause de {{cause}}.\n\nNous aidons à résoudre cela via {{solution}}.\n\n{%- if has_decision_maker %}\nSeriez-vous ouvert à un échange de 15 min pour voir si ça collerait ?\n{%- endif %}\n\nBien,\n{{your_name}}\n{{your_company}}\n{{your_email}}",
    },
    # Template 3: Social proof + case study
    {
        "id": "t3_social",
        "name": "social_proof_case",
        "subject": "Comment {{ref_agency}} a augmenté {{metric}} de {{pct}}",
        "body": "Bonjour {{first_name}},\n\n{%- set case_study = cases | first if cases else {} %}\n{%- if case_study %}\nNous avons aidé {{case_study.agency}} à {{case_study.result}} en {{case_study.time}}.\n{%- endif %}\n\n{%- if has_decision_maker %}\nVotre équipe {{specific_area}} semble un bon candidat pour un test similaire.\n{%- endif %}\n\n{%- set social = social_proof | first if social_proof else {} %}\n{%- if social %}\n{{social.testimonial}} - {{social.client}} ({social.year})\n{%- endif %}\n\nVoulez-vous un audit gratuit de {{company_name}} ?\n\nCordialement,\n{{your_name}}\n{{your_company}}\n{{your_email}}",
    },
    # Template 4: Open loop
    {
        "id": "t4_open",
        "name": "open_loop",
        "subject": "Une idée pour {{company_name}}",
        "body": "Bonjour {{first_name}},\n\nJ'ai repéré que {{company_name}} {%- if growth_trigger %}croît rapidement\n{%- endif %}et que {{pain_point}} peut freiner cette croissance.\n\nPas de pitch, juste une pensée.\n\n{%- if has_decision_maker %}\nSi vous gérez {{specific_area}}, j'ai quelques idées qui pourraient aider.\n{%- endif %}\n\nBien,\n{{your_name}}\n{{your_company}}\n{{your_email}}",
    },
]


def _normalize_name(name: str) -> str:
    """Minuscule, sans accents, premier caractère majuscule."""
    if not name:
        return ""
    n = name.strip().lower()
    n = re.sub(r"[^a-z]+", "", n)
    return n.capitalize()


# ============================================================
# PROGRESSIVE VALIDATION / FILL TEMPLATE
# ============================================================

def _validate_template(template: Dict[str, Any], company: Dict[str, Any],
                       icp: Dict[str, Any]) -> Tuple[bool, str]:
    """Validates that a template can be filled with available data.
    Returns (ok, reason)."""
    subject = template.get("subject", "")
    body = template.get("body", "")

    # Check for critical placeholders
    critical_placeholders = re.findall(r"\{\{(\w+)\}\}", subject + body)
    missing = [v for v in critical_placeholders
               if v not in company and v not in icp]

    if missing:
        return False, f"Missing placeholders: {missing}"

    return True, "ok"


def _fill_template(template: Dict[str, Any], company: Dict[str, Any],
                   icp: Dict[str, Any]) -> str:
    """Fills a template with company + ICP data."""
    result = template["body"]

    # Replace simple {{var}}
    def _replace_var(m):
        var = m.group(1)
        if var in company:
            val = str(company[var])
        elif var in icp:
            val = str(icp[var])
        else:
            val = ""
        return val

    result = re.sub(r"\{\{(\w+)\}\}", _replace_var, result)

    # Replace conditional blocks {%- if ... -%}...{%- endif -%}
    if_blocks = re.findall(r"\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}",
                           result, re.DOTALL)
    for cond, content in if_blocks:
        condition_var = cond.strip()
        cond_true = False
        if condition_var in company and str(company[condition_var]):
            cond_true = True
        elif condition_var in icp and str(icp[condition_var]):
            cond_true = True
        elif condition_var == "has_decision_maker":
            cond_true = True  # fallback
        else:
            cond_true = bool(str(company.get(condition_var, "")).strip())

        if cond_true:
            clean = re.sub(r"\{%\s*(if|endif)\s*%\}", "", content)
            result = result.replace("{% if " + cond + " %}" + content + "{% endif %}", clean, 1)

    return result


# ============================================================
# LLM FALLBACK (Groq / OpenAI / configurable)
# ============================================================

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False


def _call_llm(system_prompt: str, user_prompt: str,
              model: str = None, temperature: float = 0.3,
              max_tokens: int = 500) -> Optional[str]:
    """Calls an LLM (Groq preferred, fallback OpenAI, else None)."""
    if GROQ_AVAILABLE and model:
        try:
            api_key = os.environ.get("GROQ_API_KEY")
            if not api_key:
                from dotenv import load_dotenv
                load_dotenv()
                api_key = os.environ.get("GROQ_API_KEY")
            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            log.warning(f"LLM Groq error: {e}")
    return None


def _llm_personalize(company: Dict[str, Any], icp: Dict[str, Any],
                     templates: List[Dict], preference: str = "cold_email") -> Optional[Dict[str, Any]]:
    """Tries to use an LLM to create a personalized message."""
    if not GROQ_AVAILABLE:
        return None

    domain = company.get("domain", "")
    name = company.get("name", "")
    sector = company.get("sector", "")
    description = company.get("description", "")

    base_template = next(
        (t for t in templates if t["name"] == preference),
        templates[0] if templates else templates[0]
    )

    system_prompt = """You are a B2B cold email copywriter expert.
Generate a personalized outreach email in French or English depending on context.
Be concise, bring value, no fluff. Max 150 words.
Use the following data to personalize."""

    user_prompt = f"""Company: {name} ({domain})
Sector: {sector}
Description: {description}

Instructions: Create a prospecting email that:
1. Uses the contact's first name if available
2. References the company or sector
3. Provides immediate value (no aggressive pitch)
4. Contains a clear CTA
5. Makes reference to something specific about their business

Return ONLY the email body (no subject, no extra text).
"""

    try:
        result = _call_llm(system_prompt, user_prompt)
        if result:
            email_body = result.strip()
            subject = base_template["subject"]

            return {
                "subject": subject,
                "body": email_body,
                "llm_used": True,
            }
    except Exception as e:
        log.error(f"LLM personalization error: {e}")

    return None


# ============================================================
# MAIN PERSONALIZER ORCHESTRATOR
# ============================================================

def personalize_message(crm, company: Dict[str, Any],
                        icp: Dict[str, Any],
                        preference: str = "direct_cold_email",
                        use_llm: bool = True,
                        templates: List[Dict] = None) -> Dict[str, Any]:
    """
    Creates a personalized message for a qualified company.

    Returns: {subject, body, template_id, llm_used, needs_review}
    """
    if templates is None:
        templates = TEMPLATES

    if not crm.company_has_email(company["id"]):
        return {
            "subject": "[No email] " + (icp.get("fallback_subject", "Prospecting")),
            "body": f"Bonjour,\n\nWe identified {company.get('name', '')} as a prospect. No email found yet.\n\nCordialement,\nVotre equipe",
            "template_id": "no_email",
            "llm_used": False,
            "needs_review": True,
        }

    # 1. Try deterministic template first
    base_template = next(
        (t for t in templates if t["name"] == preference),
        templates[0] if templates else templates[0]
    )

    # 2. Fill the template
    filled_body = _fill_template(base_template, company, icp)
    subject = base_template["subject"]

    # 3. Try LLM if enabled
    llm_used = False
    final_subject = subject
    final_body = filled_body

    if use_llm:
        llm_result = _llm_personalize(company, icp, templates, preference)
        if llm_result and llm_result.get("llm_used"):
            llm_used = True
            final_subject = llm_result.get("subject", subject)
            if llm_result.get("body"):
                final_body = f"{filled_body}\n\n---\n{llm_result['body']}"

    # 4. Progressive validation
    needs_review = not _validate_template(
        {"subject": final_subject, "body": final_body},
        company, icp
    )

    # 5. Completeness score
    completeness = _template_completeness(final_body, company)

    return {
        "subject": final_subject,
        "body": final_body,
        "template_id": base_template["id"],
        "llm_used": llm_used,
        "needs_review": needs_review,
        "completeness_score": completeness,
    }


def _template_completeness(body: str, company: Dict[str, Any]) -> float:
    """Returns a 0-1 score of template completeness."""
    score = 0.0
    total = 8

    if company.get("first_name"):
        score += 1 / total
    if company.get("name"):
        score += 1 / total
    if company.get("your_email"):
        score += 1 / total

    has_conditional = bool(re.search(r"\{%\s*if.*?%\}", body))
    if has_conditional:
        score += 1 / total

    cta_kw = ["reply", "discuss", "chat", "call", "email"]
    if any(kw in body.lower() for kw in cta_kw):
        score += 1 / total

    if company.get("domain") and company["domain"] in body.lower():
        score += 1 / total

    return min(round(score, 2), 1.0)


__all__ = [
    "TEMPLATES",
    "personalize_message",
    "_fill_template",
    "_validate_template",
    "_llm_personalize",
    "_template_completeness",
    "_normalize_name",
]