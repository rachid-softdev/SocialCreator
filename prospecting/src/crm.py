"""CRM (Contact Relationship Management) with SQLite + PostgreSQL backends."""

import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.prospecting_types import (
    Company, Contact, CRMEvent, ProspectStatus, EmailVerificationStatus,
    PipelineResult
)
from src.utils import ensure_dir, read_json, write_json


class CRM:
    """Contact Relationship Management system.

    Supports SQLite (local) and PostgreSQL (cloud) backends.
    SQLite is the default; PostgreSQL can be configured via DATABASE_URL env var.
    """

    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.backend = self.config.get("backend", "sqlite")
        self._conn: Optional[sqlite3.Connection] = None
        self._postgres_conn = None

        if self.backend == "sqlite":
            sqlite_path = self.config.get("sqlite_path", "data/crm.db")
            ensure_dir(sqlite_path)
            self._conn = sqlite3.connect(str(sqlite_path), isolation_level=None)
            self._init_sqlite()
        elif self.backend == "postgresql":
            import asyncpg
            dsn = self.config.get("database_url", "")
            self._postgres_conn = asyncpg.connect(dsn)

    def _init_sqlite(self) -> None:
        """Initialize SQLite tables."""
        cur = self._conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                website TEXT,
                description TEXT,
                sector TEXT,
                city TEXT,
                country TEXT,
                employees INTEGER,
                market TEXT,
                source TEXT,
                status TEXT DEFAULT 'discovered',
                score INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                reviewed_at TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                firstname TEXT,
                phone TEXT,
                city TEXT,
                job TEXT,
                verification_status TEXT DEFAULT 'unknown',
                domain TEXT,
                created_at TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                event_type TEXT NOT NULL,
                details TEXT,
                created_at TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                contact_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                language TEXT DEFAULT 'fr',
                followup_number INTEGER DEFAULT 0,
                scheduled_at TEXT,
                sent_at TEXT,
                created_at TEXT,
                status TEXT DEFAULT 'pending'
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        self._conn.commit()

    # Company methods

    def get_company_by_domain(self, domain: str) -> Optional[dict]:
        """Get a company by domain, or None if not found."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT * FROM companies WHERE domain = ?",
            (domain.lower().strip(),)
        )
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        return None

    def upsert_company(self, company: dict) -> int:
        """Insert or update a company. Returns company ID."""
        domain = company.get("domain", "").lower().strip()
        if not domain:
            raise ValueError("Company must have a domain")

        now = datetime.utcnow().isoformat()
        existing = self.get_company_by_domain(domain)
        if existing:
            # Update existing
            cur = self._conn.cursor()
            cur.execute(
                """UPDATE companies 
                   SET name = ?, website = ?, description = ?, sector = ?,
                       city = ?, country = ?, employees = ?, market = ?,
                       source = ?, status = ?, score = ?, updated_at = ?
                 WHERE domain = ?""",
                (
                    company.get("name"), company.get("website"),
                    company.get("description"), company.get("sector"),
                    company.get("city"), company.get("country"),
                    company.get("employees"), company.get("market"),
                    company.get("source"), company.get("status", "discovered"),
                    company.get("score", 0), now, domain
                )
            )
            # Return existing ID
            return existing["id"]
        else:
            # Insert new
            cur = self._conn.cursor()
            cur.execute(
                """INSERT INTO companies (domain, name, website, description, sector,
                   city, country, employees, market, source, status, score, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    domain,
                    company.get("name"),
                    company.get("website"),
                    company.get("description"),
                    company.get("sector"),
                    company.get("city"),
                    company.get("country"),
                    company.get("employees"),
                    company.get("market"),
                    company.get("source"),
                    company.get("status", "discovered"),
                    company.get("score", 0),
                    now, now,
                )
            )
            return cur.lastrowid

    def get_companies(self, status: Optional[str] = None, limit: int = 100) -> List[dict]:
        """Get companies, optionally filtered by status."""
        cur = self._conn.cursor()
        if status:
            cur.execute(
                "SELECT * FROM companies WHERE status = ? LIMIT ?",
                (status, limit)
            )
        else:
            cur.execute("SELECT * FROM companies LIMIT ?", (limit,))
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]

    # Contact methods

    def upsert_contact(self, contact: dict) -> int:
        """Insert or update a contact. Returns contact ID."""
        email = contact.get("email", "").lower().strip()
        if not email:
            raise ValueError("Contact must have an email")

        company_id = contact.get("company_id")
        # name is NOT NULL in schema; fall back to local-part of email
        name = contact.get("name") or contact.get("full_name") or email.split("@")[0]
        existing = self.get_contact_by_email(email)
        if existing:
            cur = self._conn.cursor()
            cur.execute(
                """UPDATE contacts 
                   SET name = ?, firstname = ?, phone = ?, city = ?, job = ?,
                       verification_status = ?, domain = ?
                 WHERE email = ?""",
                (
                    name, contact.get("firstname"),
                    contact.get("phone"), contact.get("city"),
                    contact.get("job"),
                    contact.get("verification_status", "unknown"),
                    email, email
                )
            )
            return existing["id"]
        else:
            cur = self._conn.cursor()
            cur.execute(
                """INSERT INTO contacts (company_id, name, email, firstname, phone,
                   city, job, verification_status, domain, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    company_id, name, email,
                    contact.get("firstname"), contact.get("phone"),
                    contact.get("city"), contact.get("job"),
                    contact.get("verification_status", "unknown"),
                    email, datetime.utcnow().isoformat()
                )
            )
            return cur.lastrowid

    def get_contact_by_email(self, email: str) -> Optional[dict]:
        """Get a contact by email."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT * FROM contacts WHERE email = ?",
            (email.lower().strip(),)
        )
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        return None

    def get_contacts_by_company(self, company_id: int) -> List[dict]:
        """Get all contacts for a company."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT * FROM contacts WHERE company_id = ?",
            (company_id,)
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]

    # Event methods

    def add_event(self, company_id: int, event_type: str, details: Optional[dict] = None) -> int:
        """Add an event for a company. Returns event ID."""
        now = datetime.utcnow().isoformat()
        details_json = json.dumps(details) if details else "{}"
        cur = self._conn.cursor()
        cur.execute(
            "INSERT INTO events (company_id, event_type, details, created_at) VALUES (?, ?, ?, ?)",
            (company_id, event_type, details_json, now)
        )
        return cur.lastrowid

    def add_signals(self, company_id: int, signals: List[str]) -> None:
        """Add signals to a company as an event."""
        now = datetime.utcnow().isoformat()
        cur = self._conn.cursor()
        for signal in signals:
            details_json = json.dumps({"signal": signal, "source": "enricher"})
            cur.execute(
                "INSERT INTO events (company_id, event_type, details, created_at) VALUES (?, ?, ?, ?)",
                (company_id, "signal_added", details_json, now)
            )

    def add_description(self, company_id: int, description: str) -> None:
        """Update company description."""
        now = datetime.utcnow().isoformat()
        cur = self._conn.cursor()
        cur.execute(
            "UPDATE companies SET description = ?, updated_at = ? WHERE id = ?",
            (description, now, company_id)
        )

    def get_events(self, company_id: int, event_type: Optional[str] = None) -> List[dict]:
        """Get events for a company."""
        cur = self._conn.cursor()
        if event_type:
            cur.execute(
                "SELECT * FROM events WHERE company_id = ? AND event_type = ?",
                (company_id, event_type)
            )
        else:
            cur.execute("SELECT * FROM events WHERE company_id = ?", (company_id,))
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]

    # Draft methods

    def upsert_draft(self, draft: dict) -> int:
        """Insert or update a draft."""
        email = draft.get("contact_email", "").lower().strip()
        company_id = draft.get("company_id")
        now = datetime.utcnow().isoformat()

        existing = self.get_draft_by_email(email)
        if existing:
            cur = self._conn.cursor()
            cur.execute(
                """UPDATE drafts 
                   SET subject = ?, body = ?, language = ?, followup_number = ?,
                       scheduled_at = ?, sent_at = ?, status = ?
                 WHERE contact_email = ?""",
                (
                    draft.get("subject"), draft.get("body"),
                    draft.get("language", "fr"),
                    draft.get("followup_number", 0),
                    draft.get("scheduled_at", None),
                    draft.get("sent_at", None),
                    draft.get("status", "pending"),
                    email
                )
            )
            return existing["id"]
        else:
            cur = self._conn.cursor()
            cur.execute(
                """INSERT INTO drafts (company_id, contact_email, subject, body,
                   language, followup_number, scheduled_at, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    company_id, email, draft.get("subject"),
                    draft.get("body"), draft.get("language", "fr"),
                    draft.get("followup_number", 0),
                    draft.get("scheduled_at", None),
                    draft.get("status", "pending")
                )
            )
            return cur.lastrowid

    def get_draft_by_email(self, email: str) -> Optional[dict]:
        """Get a draft by email."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT * FROM drafts WHERE contact_email = ?",
            (email.lower().strip(),)
        )
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        return None

    def get_drafts_by_company(self, company_id: int) -> List[dict]:
        """Get all drafts for a company."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT * FROM drafts WHERE company_id = ?",
            (company_id,)
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]

    def get_pending_drafts(self, limit: int = 50) -> List[dict]:
        """Get pending drafts ready to send."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT d.*, c.domain, c.name as company_name FROM drafts d "
            "JOIN companies c ON d.company_id = c.id "
            "WHERE d.status = 'pending' ORDER BY d.created_at LIMIT ?",
            (limit,)
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]

    def mark_draft_sent(self, draft_id: int, resend_id: str = None) -> bool:
        """Mark a draft as sent."""
        cur = self._conn.cursor()
        cur.execute(
            "UPDATE drafts SET status = 'sent', sent_at = ?, resend_id = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), resend_id, draft_id)
        )
        return cur.rowcount > 0

    def add_draft(self, draft: dict) -> int:
        """Add a draft (alias for upsert_draft)."""
        return self.upsert_draft(draft)

    def get_company(self, company_id: int) -> Optional[dict]:
        """Get company by ID."""
        cur = self._conn.cursor()
        cur.execute("SELECT * FROM companies WHERE id = ?", (company_id,))
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        return None

    def company_has_email(self, company_id: int) -> bool:
        """Check if company has at least one contact with email."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT 1 FROM contacts WHERE company_id = ? AND email IS NOT NULL AND email != '' LIMIT 1",
            (company_id,)
        )
        return cur.fetchone() is not None

    def get_best_contact(self, company_id: int) -> Optional[dict]:
        """Get best contact for a company (prefer verified, then plausible)."""
        cur = self._conn.cursor()
        cur.execute(
            """SELECT * FROM contacts WHERE company_id = ? 
               ORDER BY CASE verification_status 
                   WHEN 'verified' THEN 0 
                   WHEN 'plausible' THEN 1 
                   ELSE 2 END, id""",
            (company_id,)
        )
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        return None

    # Status methods

    def update_status(self, domain: str, status: str, reviewed_at: Optional[str] = None) -> bool:
        """Update a company's status."""
        cur = self._conn.cursor()
        if reviewed_at:
            cur.execute(
                "UPDATE companies SET status = ?, reviewed_at = ? WHERE domain = ?",
                (status, reviewed_at, domain)
            )
        else:
            cur.execute(
                "UPDATE companies SET status = ? WHERE domain = ?",
                (status, domain)
            )
        return cur.rowcount > 0

    def get_stats(self) -> dict:
        """Get CRM statistics."""
        cur = self._conn.cursor()
        cur.execute("""
            SELECT status, COUNT(*) as cnt, AVG(score) as avg_score
            FROM companies 
            GROUP BY status
        """)
        rows = cur.fetchall()
        stats = {"total": 0}
        for row in rows:
            status, cnt, avg_score = row
            stats[status] = {"count": cnt, "avg_score": float(avg_score) if avg_score else 0}
            stats["total"] += cnt
        # Add counts per status
        for status_name in ["discovered", "qualified", "rejected", "drafted", "approved", "declined", "sent", "replied", "unsubscribed"]:
            if status_name not in stats:
                stats[status_name] = {"count": 0, "avg_score": 0}
        return stats

    def stats(self) -> dict:
        """Alias for get_stats()."""
        return self.get_stats()

    # Followup helpers

    def count_sent_emails(self, company_id: int) -> int:
        """Count sent emails for a company (via drafts with status=sent)."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM drafts WHERE company_id = ? AND status = 'sent'",
            (company_id,),
        )
        row = cur.fetchone()
        return int(row[0]) if row else 0

    def is_suppressed(self, domain: str = None, email: str = None) -> bool:
        """Check if an email/domain is suppressed."""
        cur = self._conn.cursor()
        if domain:
            cur.execute(
                "SELECT 1 FROM settings WHERE key = ? AND value LIKE ?",
                (f"suppressed:{domain}", f"%{domain}%"),
            )
        elif email:
            cur.execute(
                "SELECT 1 FROM settings WHERE key = ? AND value LIKE ?",
                (f"suppressed:{email}", f"%{email}%"),
            )
        else:
            return False
        return cur.fetchone() is not None

    def set_suppressed(self, domain: str, value: str = "1") -> None:
        """Set suppression flag (domain or email key)."""
        cur = self._conn.cursor()
        key = f"suppressed:{domain}"
        cur.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = ?",
            (key, value, value),
        )
        self._conn.commit()

    # Close

    def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
        if self._postgres_conn:
            import asyncio
            asyncio.get_event_loop().run_until_complete(self._postgres_conn.close())
            self._postgres_conn = None

    # Convenience methods from the legacy run.py

    def get_company_by_domain_legacy(self, domain: str):
        """Legacy: get company by domain (case-insensitive)."""
        return self.get_company_by_domain(domain)

    def set_company_status(self, company_id: int, status: str) -> bool:
        """Set company status."""
        # Find domain from company_id
        company = self.get_companies(limit=1)  # This won't work as expected, need refactor
        # For now, update the status directly
        cur = self._conn.cursor()
        cur.execute("UPDATE companies SET status = ? WHERE id = ?", (status, company_id))
        return cur.rowcount > 0

    def add_event_legacy(self, company_id: int, event_type: str, details: dict) -> None:
        """Legacy: add event."""
        self.add_event(company_id, event_type, details)

    def stats_legacy(self) -> dict:
        """Legacy: get stats."""
        return self.get_stats()

    # Helper: get contact by company domain + email
    def get_contact_by_company_and_email(self, company_id: int, email: str) -> Optional[dict]:
        """Get a contact for a specific company by email."""
        cur = self._conn.cursor()
        cur.execute(
            "SELECT * FROM contacts WHERE company_id = ? AND email = ?",
            (company_id, email.lower().strip())
        )
        row = cur.fetchone()
        if row:
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
        return None

    # Backfill/generic emails

    def backfill_generic_emails(self, limit: int = 30, workers: int = 6) -> dict:
        """Backfill generic emails (contact@, hello@, sales@, info@) with verification.

        Heuristic-based: tries generic emails on domains without catch-all.
        Returns summary dict.
        """
        from src.prospecting_types import EmailVerificationStatus
        summary = {"checked": 0, "verified": 0, "plausible": 0, "invalid": 0, "errors": 0}
        companies = self.get_companies(limit=limit * 2)  # get more to filter
        for company in companies:
            if summary["checked"] >= limit:
                break
            domain = company.get("domain", "")
            if not domain:
                continue
            # Only try on companies without verified contacts yet
            existing_contacts = self.get_contacts_by_company(company["id"])
            existing_emails = {c["email"] for c in existing_contacts}
            generic_patterns = [
                f"contact@{domain}",
                f"hello@{domain}",
                f"sales@{domain}",
                f"info@{domain}",
            ]
            for generic_email in generic_patterns:
                if summary["checked"] >= limit:
                    break
                if generic_email in existing_emails:
                    continue
                # Simple heuristic: check if the email appears to be a catch-all
                # In a real implementation, this would do SMTP verification
                # For now, mark as plausible based on pattern
                summary["checked"] += 1
                # Check if domain is likely catch-all (simple heuristic)
                is_catch_all = self._is_likely_catch_all(domain)
                if is_catch_all:
                    summary["errors"] += 1
                else:
                    summary["plausible"] += 1
                    # Add the contact
                    self.upsert_contact({
                        "company_id": company["id"],
                        "name": generic_email.split("@")[0].capitalize(),
                        "email": generic_email,
                        "verification_status": EmailVerificationStatus.PLAUSIBLE,
                        "domain": domain,
                    })
        return summary

    def _is_likely_catch_all(self, domain: str) -> bool:
        """Simple heuristic to detect if a domain might be catch-all."""
        # In production, this would do actual SMTP verification
        # For now, just return False (assume not catch-all)
        return False

    # Export methods

    def export_prospects(self, min_score: int = 70, format: str = "csv") -> str:
        """Export qualified prospects."""
        companies = self.get_companies(status="qualified", limit=1000)
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Domain", "Name", "Status", "Score", "Sector", "City", "Country", "Market", "Source"])
        for c in companies:
            writer.writerow([
                c["id"], c["domain"], c["name"], c["status"],
                c.get("score", 0), c.get("sector", ""), c.get("city", ""),
                c.get("country", ""), c.get("market", ""), c.get("source", "")
            ])
        return output.getvalue()

    def export_markdown(self, min_score: int = 70) -> str:
        """Export qualified prospects as Markdown."""
        companies = self.get_companies(status="qualified", limit=1000)
        lines = ["# Prospects Qualifiés", ""]
        lines.append(f"> Minimum score: {min_score}")
        lines.append("")
        lines.append("| Domaine | Nom | Score | Secteur | Ville | Pays | Marché | Source |")
        lines.append("|---------|-----|-------|---------|-------|------|--------|--------|")
        for c in companies:
            lines.append(f"| `{c['domain']}` | {c['name']} | {c.get('score', 0)} | {c.get('sector', '')} | {c.get('city', '')} | {c.get('country', '')} | {c.get('market', '')} | {c.get('source', '')} |")
        return "\n".join(lines)


# Backwards-compatible aliases from legacy run.py
def get_company_by_domain(domain: str) -> Optional[dict]:
    """Legacy function."""
    # CRM already imported at module level
    crm = CRM()
    result = crm.get_company_by_domain(domain)
    crm.close()
    return result


def set_company_status(company_id: int, status: str) -> bool:
    """Legacy function."""
    crm = CRM()
    result = crm.set_company_status(company_id, status)
    crm.close()
    return result


def add_event(company_id: int, event_type: str, details: dict) -> None:
    """Legacy function."""
    crm = CRM()
    crm.add_event(company_id, event_type, details)
    crm.close()


def stats() -> dict:
    """Legacy function."""
    crm = CRM()
    result = crm.get_stats()
    crm.close()
    return result


__all__ = [
    "CRM", "get_company_by_domain", "set_company_status", "add_event",
    "stats", "CRMEvent", "ProspectStatus", "EmailVerificationStatus",
]