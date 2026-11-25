"""Import Signavia company directories into the prospecting CRM."""

import json
import os
from typing import Optional

from src.crm import CRM
from src.utils import log, normalize_domain


def import_signavia(crm: CRM, source_path: str, limit: Optional[int] = None, dry_run: bool = False) -> dict:
    """Import all companies from the Signavia directory.

    For each company directory:
    - Extract domain from directory name
    - Read score.json and qualification.json
    - Create company in CRM with: domain, name, description, sector, score,
      status=qualified (if score >= 70), market="fr", segment="signavia"
    - Add event "signavia_import" with score/fit/rationale
    - If contacts exist in qualification data, add them as contacts
      with verification_status="found"

    Args:
        crm: CRM instance
        source_path: Path to Signavia company directories
        limit: Maximum number of companies to import (None = all)
        dry_run: If True, validate without modifying CRM

    Returns:
        Dict with import stats
    """
    # Get all company directories
    companies_dir = source_path
    if not os.path.isdir(companies_dir):
        log.error(f"Source path not found: {companies_dir}")
        return {"imported": 0, "errors": 0, "skipped": 0}

    # List all subdirectories (company directories)
    dirs = []
    for entry in os.listdir(companies_dir):
        entry_path = os.path.join(companies_dir, entry)
        if os.path.isdir(entry_path):
            dirs.append(entry)

    # Sort for deterministic ordering
    dirs.sort()

    # Apply limit if specified
    if limit is not None:
        dirs = dirs[:limit]

    imported = 0
    errors = 0
    skipped = 0

    for dir_name in dirs:
        dir_path = os.path.join(companies_dir, dir_name)

        # Extract domain from directory name
        domain = dir_name

        # Normalize the domain using the project's utility function
        domain = normalize_domain(domain)

        # Check if already imported (idempotent - skip existing domains)
        existing = crm.get_company_by_domain(domain)
        if existing:
            skipped += 1
            log.debug(f"Skipping {dir_name}: already exists in CRM")
            continue

        # Read score.json
        score_path = os.path.join(dir_path, "score.json")
        qual_path = os.path.join(dir_path, "qualification.json")

        score_data = None
        qual_data = None

        if os.path.exists(score_path):
            with open(score_path, encoding="utf-8") as f:
                score_data = json.load(f)
        else:
            log.warning(f"score.json not found for {dir_name}")
            # We need score data to proceed, so skip this company
            skipped += 1
            continue

        if os.path.exists(qual_path):
            with open(qual_path, encoding="utf-8") as f:
                qual_data = json.load(f)

        # Extract score data
        score = score_data.get("score", 0)
        fit = score_data.get("fit", "weak")
        rationale = score_data.get("rationale", "")

        # Extract qualification data
        qual_score = qual_data.get("score", 0) if qual_data else 0
        qual_fit = qual_data.get("fit", "weak") if qual_data else "weak"
        qual_rationale = qual_data.get("rationale", "") if qual_data else ""

        # Use the qualification score if available, otherwise use score
        final_score = qual_score if qual_score > 0 else score

        # Determine status based on score
        # status=qualified if score >= 70
        status = "qualified" if final_score >= 70 else "discovered"

        # Company name - capitalize directory name
        name = dir_name.capitalize()

        # Description - use qualification rationale if available, else score rationale
        description = qual_rationale if qual_rationale else rationale
        if not description:
            description = f"Company from Signavia prospecting: {dir_name}"

        # Sector - not available in Signavia data
        sector = ""

        # Market and segment from task requirements
        market = "fr"
        segment = "signavia"

        # Source
        source = "signavia"

        # Build company data dict
        company_data = {
            "domain": domain,
            "name": name,
            "description": description,
            "sector": sector,
            "score": final_score,
            "status": status,
            "market": market,
            "source": source,
            "segment": segment,
        }

        if dry_run:
            # In dry-run mode, validate the data structure without modifying CRM
            log.info(f"DRY_RUN: Would import {dir_name}: score={final_score}, status={status}, domain={domain}")
            imported += 1
            continue

        # Upsert company into CRM
        try:
            cid = crm.upsert_company(company_data)

            # Add event "signavia_import" with score/fit/rationale
            crm.add_event(
                company_id=cid,
                event_type="signavia_import",
                details={
                    "score": final_score,
                    "fit": fit,
                    "rationale": rationale,
                    "qual_score": qual_score,
                    "qual_fit": qual_fit,
                    "qual_rationale": qual_rationale,
                    "domain": domain,
                    "directory": dir_name,
                }
            )

            # Add contacts if they exist in qualification data
            # The task says: "If contacts exist in qualification data, add them as contacts
            # with email_status='found'"
            # Signavia qualification data contains only {score, fit, rationale} with no contacts,
            # so this is a no-op for current data but included for future compatibility
            if qual_data and "contacts" in qual_data:
                contacts = qual_data["contacts"]
                if isinstance(contacts, list):
                    for contact in contacts:
                        email = contact.get("email", "")
                        if email:
                            contact_name = contact.get("name", "")
                            contact_firstname = contact.get("firstname", None)
                            crm.upsert_contact({
                                "company_id": cid,
                                "email": email,
                                "name": contact_name or dir_name,
                                "firstname": contact_firstname,
                                "verification_status": "found",
                                "domain": domain,
                            })
                            log.debug(f"Added contact {email} for {dir_name}")

            imported += 1
            log.info(f"Imported {dir_name}: score={final_score}, status={status}")

        except Exception as e:
            errors += 1
            log.error(f"Error importing {dir_name}: {e}")

    crm.close()
    return {"imported": imported, "errors": errors, "skipped": skipped}


if __name__ == "__main__":
    import sys
    import argparse

    parser = argparse.ArgumentParser(description="Import Signavia company directories")
    parser.add_argument(
        "--source-path",
        type=str,
        default=r"D:\git-projects\Signavia\signavia-prospecting",
        help="Path to Signavia company directories",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of companies to import",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate import without modifying CRM",
    )
    args = parser.parse_args()

    crm = CRM()

    if args.dry_run:
        log.warning("DRY_RUN mode: validating import structure only")
        # Just validate that the source path exists and files are readable
        if os.path.isdir(args.source_path):
            dirs = [
                d for d in os.listdir(args.source_path)
                if os.path.isdir(os.path.join(args.source_path, d))
            ]
            log.info(f"Found {len(dirs)} company directories in source path")
            # Show first 3 as examples
            for d in dirs[:3]:
                score_path = os.path.join(args.source_path, d, "score.json")
                if os.path.exists(score_path):
                    with open(score_path, encoding="utf-8") as f:
                        data = json.load(f)
                    log.info(f"  {d}: score={data.get('score')}, fit={data.get('fit')}")
        else:
            log.error(f"Source path not found: {args.source_path}")
        crm.close()
    else:
        stats = import_signavia(crm, args.source_path, args.limit, args.dry_run)
        print(f"Import terminé: {stats['imported']} importés, {stats['errors']} erreurs, {stats['skipped']} ignorés")
