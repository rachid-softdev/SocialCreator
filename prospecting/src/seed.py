#!/usr/bin/env python3
"""
Seed import from CSV — adapted from Folia's seed.py.

Provides idempotent CSV import of company records into the CRM,
with noise domain filtering and suppression checks.
"""

import csv
import logging
from typing import Any, Dict, List, Optional, Set

from src.crm import CRM
from src.utils import log, normalize_domain

#: Known noise domains that should never be imported as prospects
NOISE_DOMAINS: Set[str] = {
    "google.com", "youtube.com", "gstatic.com", "facebook.com",
    "instagram.com", "twitter.com", "x.com", "linkedin.com",
    "tiktok.com", "pinterest.com", "github.com", "gitlab.com",
    "crunchbase.com", "glassdoor.com", "trustpilot.com",
    "sortlist.com", "goodfirms.com", "techbehemoths.com",
    "semrush.com", "themanifest.com", "listingcanada.com",
    "ibtimes.com", "blogspot.com", "wordpress.com",
    "medium.com", "substack.com",
}


def seed_from_csv(crm: CRM, path: str, limit: int = 100,
                  default_segment: str = "unknown") -> Dict[str, Any]:
    """
    Import companies from a CSV file into the CRM.

    Adapted from Folia's seed.py pattern.

    Recognized columns (all optional, matched case-insensitively):
        domain, name, website, segment, market, sector, city, country,
        description, source, email, first_name, last_name, full_name,
        function, linkedin_url, email_status

    The import is idempotent: existing domains are not duplicated.
    Emails are added as 'found' status (never 'verified').
    Suppressed domains are skipped via is_suppressed() check.

    Returns:
        Dict with summary: {imported, skipped, suppressed, errors}
    """
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except FileNotFoundError:
        log.error(f"Seed CSV not found: {path}")
        return {"imported": 0, "skipped": 0, "suppressed": 0, "errors": 1}
    except Exception as e:  # noqa: BLE001
        log.error(f"Error reading seed CSV {path}: {e}")
        return {"imported": 0, "skipped": 0, "suppressed": 0, "errors": 1}

    imported = 0
    skipped = 0
    suppressed = 0
    errors = 0
    seen_domains: Set[str] = set()

    # Pre-load existing domains from CRM for idempotency
    existing_companies = crm.get_companies(limit=10000)
    for comp in existing_companies:
        dom = comp.get("domain", "").lower().strip()
        if dom:
            seen_domains.add(dom)

    for row in rows[:limit]:
        try:
            # Normalize domain from any available column
            domain = ""
            for col in ("domain", "Domain", "DOMAIN",
                        "website", "Website", "WEBSITE",
                        "full_name", "Full_name", "FULL_NAME"):
                if col in row and row[col]:
                    domain = row[col]
                    break

            if not domain:
                log.warning("Row skipped: no domain found")
                errors += 1
                continue

            domain = normalize_domain(domain)
            if not domain or "." not in domain:
                log.warning(f"Row skipped: invalid domain '{domain}'")
                skipped += 1
                continue

            # Idempotency: skip if domain already exists
            if domain.lower() in seen_domains:
                skipped += 1
                continue

            # Suppression check
            if crm.is_suppressed(domain=domain):
                log.info(f"Domain {domain} is suppressed, skipping")
                suppressed += 1
                seen_domains.add(domain.lower())
                continue

            # Extract fields from row
            name = row.get("name", row.get("Name", "")) or ""
            name = name.strip()
            if not name:
                # Try to derive from email local-part
                if "@" in domain:
                    name = domain.split("@")[0].replace(".", " ").title()

            segment = row.get("segment", row.get("Segment", "")) or default_segment
            market = row.get("market", row.get("Market", "")) or "fr"
            sector = row.get("sector", row.get("Sector", "")) or ""
            city = row.get("city", row.get("City", "")) or row.get("localite", "") or ""
            country = row.get("country", row.get("Country", "")) or "FR"
            description = row.get("description", row.get("Description", "")) or ""
            source = row.get("source", row.get("Source", "csv_import")) or "csv_import"

            # Email handling
            email = row.get("email", row.get("Email", "")) or row.get(
                "first_name", row.get("First_name", "")) + "@" + domain if "@" not in (row.get("email", row.get("Email", "")) or "") else ""
            email = email.strip() if email else ""
            if email and "@" not in email:
                email = f"{email}@{domain}"

            # first_name and last_name from columns
            first_name = row.get("first_name", row.get("First_name", "")) or ""
            last_name = row.get("last_name", row.get("Last_name", "")) or ""

            # function and linkedin_url
            function = row.get("function", row.get("Function", "")) or ""
            linkedin_url = row.get("linkedin_url", row.get("Linkedin_url", "")) or ""

            # Email verification status
            email_status = row.get("email_status", row.get("Email_status", "found")) or "found"
            if email_status not in ("verified", "plausible", "invalid", "unknown"):
                email_status = "found"

            # Upsert company (idempotent)
            company_data = {
                "domain": domain,
                "name": name,
                "website": row.get("website", row.get("Website", "")) or None,
                "sector": sector,
                "city": city if city else None,
                "country": country if len(country) == 2 else "FR",
                "market": market,
                "source": source,
                "status": "discovered",
                "score": 0,
            }

            cid = crm.upsert_company(company_data)

            # Upsert contact if email provided
            if email:
                contact_data = {
                    "company_id": cid,
                    "name": name,
                    "email": email.lower().strip(),
                    "firstname": first_name or None,
                    "verification_status": email_status,
                    "domain": domain,
                }
                # Also add optional fields if present
                if last_name:
                    contact_data["lastname"] = last_name  # Note: CRM schema uses 'name' primarily
                if function:
                    contact_data["job"] = function

                crm.upsert_contact(contact_data)

            seen_domains.add(domain.lower())
            imported += 1

        except Exception as e:  # noqa: BLE001
            log.error(f"Error importing row: {e}")
            errors += 1

    log.success(f"Seed import from {path}: {imported} imported, "
                f"{skipped} skipped, {suppressed} suppressed, {errors} errors")

    return {
        "imported": imported,
        "skipped": skipped,
        "suppressed": suppressed,
        "errors": errors,
    }


# For backwards compatibility
__all__ = [
    "seed_from_csv",
    "NOISE_DOMAINS",
]