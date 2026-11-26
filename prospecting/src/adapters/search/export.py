#!/usr/bin/env python3
"""
Export prospects from CRM — adapted from CRM's export_prospects/export_markdown.

Provides multi-format export (CSV, Markdown, JSON) for qualified prospects.
"""

import csv
import io
import json
from typing import Any, Dict, List, Literal, Optional

from src.crm import CRM
from src.prospecting_types import ProspectStatus


def export_prospects(
    crm: CRM,
    min_score: int = 70,
    format: Literal["csv", "md", "json"] = "csv",
    status: Optional[str] = None,
    limit: int = 1000
) -> str:
    """
    Export qualified prospects in specified format.

    Args:
        crm: CRM instance
        min_score: Minimum qualification score (default 70)
        format: Export format - "csv", "md" (markdown), or "json"
        status: Filter by prospect status (default: qualified)
        limit: Maximum number of records

    Returns:
        Formatted export string
    """
    if status is None:
        status = ProspectStatus.QUALIFIED.value

    companies = crm.get_companies(status=status, limit=limit)

    # Filter by score
    companies = [c for c in companies if c.get("score", 0) >= min_score]

    if format == "csv":
        return _export_csv(companies)
    elif format == "md":
        return _export_markdown(companies, min_score)
    elif format == "json":
        return _export_json(companies)
    else:
        raise ValueError(f"Unknown format: {format}")


def _export_csv(companies: List[Dict[str, Any]]) -> str:
    """Export as CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID", "Domain", "Name", "Website", "Status", "Score",
        "Sector", "City", "Country", "Market", "Source",
        "Description", "Employees", "LinkedIn URL", "Created At"
    ])

    for c in companies:
        writer.writerow([
            c.get("id", ""),
            c.get("domain", ""),
            c.get("name", ""),
            c.get("website", ""),
            c.get("status", ""),
            c.get("score", 0),
            c.get("sector", ""),
            c.get("city", ""),
            c.get("country", ""),
            c.get("market", ""),
            c.get("source", ""),
            c.get("description", ""),
            c.get("employees", ""),
            c.get("linkedin_url", ""),
            c.get("created_at", ""),
        ])

    return output.getvalue()


def _export_markdown(companies: List[Dict[str, Any]], min_score: int = 70) -> str:
    """Export as Markdown table."""
    lines = ["# Prospects Qualifiés", ""]
    lines.append(f"> Minimum score: {min_score}")
    lines.append(f"> Total prospects: {len(companies)}")
    lines.append("")

    if not companies:
        lines.append("*Aucun prospect qualifié ne correspond aux critères.*")
        return "\n".join(lines)

    # Table header
    lines.append("| ID | Domaine | Nom | Score | Secteur | Ville | Pays | Marché | Source |")
    lines.append("|----|---------|-----|-------|---------|-------|------|--------|--------|")

    for c in companies:
        domain = c.get("domain", "")
        name = c.get("name", "").replace("|", "\\|")
        score = c.get("score", 0)
        sector = c.get("sector", "").replace("|", "\\|")
        city = c.get("city", "").replace("|", "\\|")
        country = c.get("country", "").replace("|", "\\|")
        market = c.get("market", "").replace("|", "\\|")
        source = c.get("source", "").replace("|", "\\|")

        lines.append(f"| {c.get('id', '')} | `{domain}` | {name} | {score} | {sector} | {city} | {country} | {market} | {source} |")

    return "\n".join(lines)


def _export_json(companies: List[Dict[str, Any]]) -> str:
    """Export as JSON array."""
    # Convert datetime objects to strings if present
    serializable = []
    for c in companies:
        row = {}
        for k, v in c.items():
            if hasattr(v, "isoformat"):  # datetime
                row[k] = v.isoformat()
            else:
                row[k] = v
        serializable.append(row)

    return json.dumps(serializable, ensure_ascii=False, indent=2)


def export_markdown(
    crm: CRM,
    min_score: int = 70,
    limit: int = 1000
) -> str:
    """
    Export qualified prospects as Markdown.

    Convenience wrapper matching CRM's export_markdown signature.

    Args:
        crm: CRM instance
        min_score: Minimum qualification score
        limit: Maximum number of records

    Returns:
        Markdown formatted string
    """
    return export_prospects(crm, min_score=min_score, format="md", limit=limit)


def export_json(
    crm: CRM,
    min_score: int = 70,
    limit: int = 1000
) -> str:
    """
    Export qualified prospects as JSON.

    Args:
        crm: CRM instance
        min_score: Minimum qualification score
        limit: Maximum number of records

    Returns:
        JSON formatted string
    """
    return export_prospects(crm, min_score=min_score, format="json", limit=limit)


def export_csv(
    crm: CRM,
    min_score: int = 70,
    limit: int = 1000
) -> str:
    """
    Export qualified prospects as CSV.

    Args:
        crm: CRM instance
        min_score: Minimum qualification score
        limit: Maximum number of records

    Returns:
        CSV formatted string
    """
    return export_prospects(crm, min_score=min_score, format="csv", limit=limit)


__all__ = [
    "export_prospects",
    "export_markdown",
    "export_json",
    "export_csv",
]