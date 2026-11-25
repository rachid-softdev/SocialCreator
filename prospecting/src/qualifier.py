"""
Heuristic qualification engine with proven MailGuardPro signals.

Ported from MailGuardPro's qualifier.py with battle-tested signals for
B2B cold email/outbound/lead generation agency detection.
"""

import json
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from .prospecting_types import Company as CompanyType
from .utils import log


# ============================================================
# SIGNALS — battle-tested from MailGuardPro production runs
# ============================================================

# Domaines génériques (annuaires, news, blogs) : jamais des prospects
NOISE_DOMAIN_PATTERNS = (
    "sortlist.", "goodfirms.", "techbehemoths.", "semrush.com", "themanifest.",
    "listingcanada.", "ibtimes.", "blog.", "news.", "directory.", "annuaire.",
)

# Signaux hors cible (B2C local, presse, formation, graphisme...)
NOISE_TEXT_KEYWORDS = (
    "annuaire", "directory", "comparateur", "actualités", "actualite", "news",
    "blog", "immobilier", "real estate", "restaurant", "formation", "graphiste",
    "graphisme", "relations presse", "public relations", "télémarketing",
    "telemarketing", "social media", "agence média", "media agency",
)

# Signaux métier forts (scoring local sans LLM)
STRONG_SIGNALS = {
    "cold email": 35, "cold outreach": 35, "outbound": 30,
    "lead generation": 30, "lead gen": 30, "génération de leads": 30,
    "generation de leads": 30, "prospection": 25,
    "email marketing": 30, "e-mailing": 30, "newsletter": 25,
    "marketing automation": 25, "klaviyo": 30, "hubspot": 25,
    "mailchimp": 25, "revops": 30, "demand generation": 30,
    "sales enablement": 25, "sdr": 20, "b2b": 15, "saas": 15,
    "e-commerce": 15, "ecommerce": 15, "shopify": 20,
}

MEDIUM_SIGNALS = {
    "agence": 10, "agency": 10, "marketing": 8, "digital": 5,
    "crm": 10, "sales": 8, "growth": 15, "acquisition": 10,
    "prospection commerciale": 20, "agence web": 5, "seo": 3,
}

NEGATIVE_SIGNALS = {
    "immobilier": -35, "real estate": -35, "restaurant": -35,
    "association": -30, "mairie": -35, "administration": -35,
    "graphiste": -25, "graphisme": -25, "formation": -20,
    "télémarketing": -30, "telemarketing": -30, "social media": -20,
    "public relations": -20, "relations presse": -20,
    "annuaire": -50, "directory": -50, "comparateur": -50,
    "news": -40, "blog": -30,
}

COMPETITOR_SIGNALS = (
    "zerobounce", "neverbounce", "hunter.io", "dropcontact", "clearbit",
    "apollo.io", "email validation", "email verification", "email finder",
    "data provider", "base de données", "lead database",
    "reachinbox", "saleshandy", "emelia", "mystrika", "manyreach",
    "closedin", "salescaptain", "leadsmunch", "hublead", "visbl",
)

# Signaux portés par le domaine seul (souvent l'info dispo dans Google)
DOMAIN_SIGNALS = {
    "coldemail": 35, "coldemailing": 35, "coldoutreach": 35,
    "leadgeneration": 30, "leadgen": 30, "prospection": 30,
    "emailmarketing": 30, "emailing": 30, "email": 10,
    "outbound": 30, "revops": 30, "demandgeneration": 30,
    "growthprospect": 30, "growthagency": 30, "salesagency": 25,
    "agency": 10, "agence": 10, "growth": 15, "marketing": 8,
    "digital": 5, "sales": 8, "lead": 10, "prospect": 15,
    "acquisition": 10, "b2b": 10, "saas": 10, "ecommerce": 10,
    "shopify": 15,
}

# Agences notoires dont le domaine ne contient aucun mot-clé métier
KNOWN_AGENCIES = {
    "belkins": 30, "martal": 30, "callbox": 30, "devlo": 30,
    "saleshive": 30, "leadium": 30, "cience": 30, "upcall": 30,
    "salestask": 30, "leadspring": 30, "newbreed": 30,
}

QUERY_STRONG_SIGNALS = (
    "cold email", "cold outreach", "outbound", "lead generation",
    "lead gen", "prospection", "email marketing", "e-mailing",
    "revops", "demand generation", "sales enablement",
    "génération de leads", "délivrabilité", "deliverability",
)

QUERY_MEDIUM_SIGNALS = (
    "agence", "agency", "growth", "marketing", "b2b", "saas",
    "e-commerce", "ecommerce", "klaviyo", "hubspot",
    "marketing automation", "email",
)


# ============================================================
# HELPERS
# ============================================================

def _normalize(text: str) -> str:
    """Minuscule, sans accents ni séparateurs, pour matcher domaines et noms."""
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _pre_filter(company: Dict[str, Any], icp: Dict[str, Any]) -> Optional[str]:
    """Écarte sans appel LLM les domaines manifestement hors cible."""
    domain = (company.get("domain") or "").lower()
    excluded = {d.lower().strip() for d in icp.get("exclude_domains", []) if d}
    if domain in excluded:
        return "domaine exclu (concurrent/fournisseur)"
    for pattern in NOISE_DOMAIN_PATTERNS:
        if pattern in domain:
            return f"domaine générique ({pattern})"
    text = " ".join(str(company.get(k) or "") for k in
                    ("name", "description", "sector")).lower()
    for keyword in NOISE_TEXT_KEYWORDS:
        if keyword in text:
            return f"mot-clé hors cible ({keyword})"
    return None


def _heuristic_score(company: Dict[str, Any], icp: Dict[str, Any],
                     discovery_query: str = "") -> Tuple[int, str, str]:
    """Score local 0-100, utilisé quand aucun LLM n'est disponible.

    Returns: (score, rationale, fit)
    fit in: core, secondary, weak, excluded
    """
    raw_text = " ".join(str(company.get(k) or "") for k in
                        ("name", "description", "sector", "domain")).lower()
    compact = _normalize(raw_text)
    domain = _normalize(company.get("domain") or "")
    query = (discovery_query or "").lower()
    query_compact = _normalize(query)

    score = 20
    reasons = []
    matched = set()

    def add_matches(signals: Dict[str, int]):
        nonlocal score
        for keyword, points in signals.items():
            key = _normalize(keyword)
            if key in matched:
                continue
            if keyword in raw_text or (key and key in compact):
                score += points
                reasons.append(keyword)
                matched.add(key)

    add_matches(STRONG_SIGNALS)
    add_matches(MEDIUM_SIGNALS)

    # Signaux du domaine : souvent la seule information des résultats Google.
    for keyword, points in DOMAIN_SIGNALS.items():
        key = _normalize(keyword)
        if key and key in domain and key not in matched:
            score += points
            reasons.append(f"domaine:{keyword}")
            matched.add(key)

    # Agences connues : rattrape les domaines opaques (belkins.io, etc.).
    for keyword, points in KNOWN_AGENCIES.items():
        if keyword in domain:
            score += points
            reasons.append(f"connu:{keyword}")

    # La requête de découverte décrit l'ICP visé : signal de confirmation.
    if query:
        query_bonus = 0
        if any(k in query or _normalize(k) in query_compact
               for k in QUERY_STRONG_SIGNALS):
            query_bonus += 25
        if any(k in query or _normalize(k) in query_compact
               for k in QUERY_MEDIUM_SIGNALS):
            query_bonus += 5
        if query_bonus:
            score += query_bonus
            reasons.append(f"requête:{query[:60]}")

    for keyword, points in NEGATIVE_SIGNALS.items():
        key = _normalize(keyword)
        if keyword in raw_text or (key and key in compact):
            score += points
            reasons.append(f"-{keyword}")

    for keyword in COMPETITOR_SIGNALS:
        key = _normalize(keyword)
        if keyword in raw_text or (key and key in compact):
            score -= 60
            reasons.append(f"concurrent:{keyword}")

    if company.get("website"):
        score += 5
    market_code = company.get("market") or "fr"
    market = next((m for m in icp.get("markets", [])
                   if m.get("code") == market_code), {})
    country = (company.get("country") or "").upper()
    if country and country in [str(c).upper()
                               for c in market.get("target_countries", [])]:
        score += 5
    employees = company.get("employees")
    if employees:
        try:
            first = int(str(employees).split("-")[0].strip())
            if 5 <= first <= 250:
                score += 5
        except (TypeError, ValueError):
            pass

    score = max(0, min(100, score))
    if score >= 80:
        fit = "core"
    elif score >= 65:
        fit = "secondary"
    elif score >= 40:
        fit = "weak"
    else:
        fit = "excluded"
    rationale = "Heuristique locale : " + (
        ", ".join(reasons[:7]) if reasons else "aucun signal fort")
    return score, rationale[:300], fit


def qualify(crm, limit: int = 15, icp: Optional[Dict] = None,
            min_score: int = 60, is_heuristic_mode: bool = True,
            fallback_heuristic: bool = True) -> Dict[str, int]:
    """
    Qualifie les entreprises jamais scorées (status=new ou enriched).
    Retourne {scored, qualified, dropped, errors}.
    """
    if icp is None:
        icp = {"markets": [], "exclude_domains": [], "min_score_to_qualify": min_score}

    companies = crm.get_companies(status="discovered", limit=limit)
    if not companies:
        log.info("Aucune entreprise à qualifier")
        return {"scored": 0, "qualified": 0, "dropped": 0, "errors": 0}

    scored = qualified = dropped = errors = 0

    for company in companies:
        reason = _pre_filter(company, icp)
        if reason:
            crm.update_status(company["domain"], "rejected", None)
            crm.add_event(company["id"], "dropped",
                          {"score": 0, "rationale": reason, "pre_filter": True})
            dropped += 1
            log.info(f"{company['name']} ({company['domain']}): {reason}")
            continue

        # Récupérer la requête de découverte depuis les événements
        discovery_query = ""
        events = crm.get_events(company["id"])
        for ev in events:
            if ev.get("event_type") == "discovered" and ev.get("details"):
                try:
                    payload = json.loads(ev["details"]) if isinstance(ev["details"], str) else ev["details"]
                except Exception:
                    continue
                query = str(payload.get("query") or "").strip()
                if query:
                    discovery_query = query
                    break

        if is_heuristic_mode:
            score, rationale, fit = _heuristic_score(company, icp, discovery_query)
            log.info(f"Heuristique: {company['name']} ({company['domain']})")
        else:
            # LLM call would go here
            if fallback_heuristic:
                score, rationale, fit = _heuristic_score(company, icp, discovery_query)
                log.warning(f"LLM indisponible, score heuristique pour {company['domain']}")
            else:
                errors += 1
                log.warning(f"Échec qualification {company['domain']}, ignoré")
                continue

        if score >= min_score:
            target_status = "qualified"
            crm.update_status(company["domain"], target_status, None)
            crm.add_event(company["id"], "qualified",
                          {"score": score, "fit": fit, "rationale": rationale})
            qualified += 1
            log.success(f"{company['name']}: {score}/100 ({fit}) - {rationale}")
        else:
            crm.update_status(company["domain"], "rejected", None)
            crm.add_event(company["id"], "dropped",
                          {"score": score, "rationale": rationale})
            dropped += 1
            log.warning(f"{company['name']}: {score}/100 - {rationale}")
        scored += 1

    summary = {"scored": scored, "qualified": qualified, "dropped": dropped, "errors": errors}
    log.success(f"Qualification: {qualified} qualifiées, {dropped} écartées, {errors} erreurs")
    return summary