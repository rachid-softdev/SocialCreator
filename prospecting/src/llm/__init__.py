"""LLM (Large Language Model) abstraction with configurable backend and fallback."""

import json
import os
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple

from src.prospecting_types import LLMProvider, QualificationResult
from src.utils import log


class LLMManager:
    """Manages LLM calls with configurable backends and heuristic fallback.

    Supports:
      - heuristic: No LLM, local scoring with business keywords
      - opencode: CLI-based (opencode auth login)
      - openrouter: OpenRouter API
      - openai: OpenAI-compatible API (Ollama, vLLM, LM Studio...)
    """

    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.provider = self.config.get("provider", "heuristic")
        self.model = self.config.get("model", "default")
        self.api_key = self.config.get("api_key")
        self.base_url = self.config.get("base_url")
        self.fallback_heuristic = self.config.get("fallback_heuristic", True)
        self._heur_engine = HeuristicEngine()

    def _call_heuristic(self, prompt: str, **kwargs) -> dict:
        """Call the heuristic engine directly."""
        return self._heur_engine.process(prompt, **kwargs)

    def _call_openrouter(self, prompt: str, **kwargs) -> dict:
        """Call OpenRouter API."""
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not set")
        import requests
        response = requests.post(
            f"https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": self.model or "openai/gpt-4o",
                "messages": [{"role": "user", "content": prompt}],
                **kwargs
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return {"text": data["choices"][0]["message"]["content"]}

    def _call_openai(self, prompt: str, **kwargs) -> dict:
        """Call OpenAI-compatible API (Ollama, vLLM, etc.)."""
        base = self.base_url or "http://localhost:11434/v1"
        import requests
        response = requests.post(
            f"{base}/chat/completions",
            headers={"Content-Type": "application/json"},
            json={
                "model": self.model or "local-model",
                "messages": [{"role": "user", "content": prompt}],
                **kwargs
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return {"text": data["choices"][0]["message"]["content"]}

    # ------------------------------------------------------------------
    # CLI providers (opencode / kilo)
    # ------------------------------------------------------------------

    @staticmethod
    def _cli_executable(name: str) -> str:
        """Return the CLI executable name for the current platform."""
        return f"{name}.cmd" if sys.platform == "win32" else name

    @staticmethod
    def _parse_run_events(stdout: Any) -> Tuple[Optional[str], str, List[str]]:
        """Parse NDJSON output from `run --format json`.

        Both opencode and kilo emit one JSON event per line, including the
        session ID (``sessionID``), streamed text parts (``type: text``) and
        provider errors (``type: error``).

        Returns ``(session_id, text, errors)``.
        """
        if isinstance(stdout, bytes):
            stdout = stdout.decode("utf-8", errors="replace")

        session_id: Optional[str] = None
        texts: List[str] = []
        errors: List[str] = []

        for line in (stdout or "").splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                event = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue
            if not isinstance(event, dict):
                continue

            if session_id is None and event.get("sessionID"):
                session_id = event["sessionID"]

            event_type = event.get("type")
            if event_type == "text":
                part = event.get("part")
                text = part.get("text") if isinstance(part, dict) else None
                if text:
                    texts.append(text)
            elif event_type == "error":
                error = event.get("error")
                if isinstance(error, dict):
                    errors.append(error.get("message") or error.get("type") or str(error))
                elif error:
                    errors.append(str(error))

        return session_id, "".join(texts), errors

    @staticmethod
    def _delete_cli_session(
        cmd_name: str, session_id: Optional[str], timeout: int = 30
    ) -> None:
        """Delete a CLI session (best-effort, never raises).

        Cleanup only targets the exact session created by the current call, so
        interactive user sessions are never touched.
        """
        if not session_id:
            return
        try:
            result = subprocess.run(
                [cmd_name, "session", "delete", session_id],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
            )
            if result.returncode != 0:
                log.warning(
                    f"Session cleanup failed for {session_id} "
                    f"(exit {result.returncode})"
                )
            else:
                log.debug(f"Session CLI supprimée: {session_id}")
        except Exception as exc:  # noqa: BLE001
            log.warning(f"Session cleanup failed for {session_id}: {exc}")

    def _call_cli(self, cmd_name: str, prompt: str, timeout: int) -> dict:
        """Run an opencode/kilo CLI agent and clean up its session.

        The CLI is invoked in JSON mode so the session ID and the model text can
        be extracted reliably. The session is deleted in a ``finally`` block,
        including on provider errors and timeouts, to avoid accumulating
        sessions at every search.
        """
        cmd = [cmd_name, "run", "--format", "json", "--auto"]
        if self.model and self.model != "default":
            cmd.extend(["--model", self.model])
        cmd.append(prompt)

        session_id: Optional[str] = None
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
            )
            session_id, text, errors = self._parse_run_events(result.stdout)

            if result.returncode != 0:
                detail = "; ".join(errors) or (result.stderr or "").strip()
                raise RuntimeError(
                    f"{cmd_name} run failed (exit {result.returncode})"
                    + (f": {detail}" if detail else "")
                )
            if errors:
                raise RuntimeError(f"{cmd_name} run error: {'; '.join(errors)}")
            if not text:
                raise RuntimeError(f"{cmd_name} run returned no text")

            return {"text": text}
        except subprocess.TimeoutExpired as exc:
            session_id, _, _ = self._parse_run_events(exc.stdout)
            raise
        finally:
            self._delete_cli_session(cmd_name, session_id)

    def _call_opencode(self, prompt: str, **kwargs) -> dict:
        """Call opencode CLI (no API key needed)."""
        return self._call_cli(self._cli_executable("opencode"), prompt, timeout=60)

    def _call_kilo(self, prompt: str, **kwargs) -> dict:
        """Call kilo CLI (no API key needed)."""
        return self._call_cli(self._cli_executable("kilo"), prompt, timeout=90)

    def call(self, prompt: str, **kwargs) -> dict:
        """Call the configured LLM provider with fallback chain.

        Default chain for discovery: opencode --auto → kilo --auto → heuristic.
        Never falls back to heuristic for prospect discovery unless explicitly
        requested (heuristic cannot generate company names).
        """
        provider = self.provider

        if provider == "opencode":
            try:
                return self._call_opencode(prompt, **kwargs)
            except Exception as e:  # noqa: BLE001
                msg = str(e).lower()
                # Free limit / auth expired / blocked → try kilo
                if any(k in msg for k in ("expired", "limit", "quota", "blocked", "402", "429", "unauthorized")):
                    try:
                        return self._call_kilo(prompt, **kwargs)
                    except Exception:
                        raise
                raise

        if provider == "kilo":
            try:
                return self._call_kilo(prompt, **kwargs)
            except Exception as e:  # noqa: BLE001
                msg = str(e).lower()
                if any(k in msg for k in ("expired", "limit", "quota", "blocked", "402", "429", "unauthorized")):
                    try:
                        return self._call_opencode(prompt, **kwargs)
                    except Exception:
                        raise
                raise

        if provider == "heuristic":
            return self._call_heuristic(prompt, **kwargs)

        if provider == "openrouter":
            return self._call_openrouter(prompt, **kwargs)

        if provider == "openai":
            return self._call_openai(prompt, **kwargs)

        raise ValueError(f"Unknown LLM provider: {provider}")


class HeuristicEngine:
    """Heuristic scoring and drafting without LLM."""

    def __init__(self):
        self.signals = [
            ("cold email", "agence cold email"),
            ("outbound", "agence outbound"),
            ("lead generation", "agence lead generation"),
            ("lead gen", "agence lead generation"),
            ("prospection b2b", "agence lead generation"),
            ("email marketing", "agence email marketing"),
            ("e-mailing", "agence email marketing"),
            ("klaviyo", "agence email marketing"),
            ("mailchimp", "agence email marketing"),
            ("marketing automation", "agence marketing automation"),
            ("hubspot", "agence marketing automation"),
            ("revops", "consultant RevOps"),
            ("revenue operations", "consultant RevOps"),
            ("demand generation", "agence demand generation"),
            ("sales enablement", "agence sales enablement"),
            ("growth", "agence growth"),
            ("acquisition b2b", "agence growth"),
            ("shopify", "agence e-commerce"),
            ("e-commerce", "e-commerce"),
            ("boutique en ligne", "e-commerce"),
            ("online store", "e-commerce"),
            ("ecommerce", "e-commerce"),
            ("éditeur logiciel", "éditeur SaaS"),
            ("saas", "éditeur SaaS"),
            ("saas company", "éditeur SaaS"),
            ("logiciel b2b", "éditeur SaaS"),
            ("agence web", "agence web"),
            ("web agency", "agence web"),
            ("agence marketing", "agence marketing"),
            ("digital marketing agency", "agence marketing"),
            ("cabinet conseil", "cabinet conseil"),
            ("consulting firm", "cabinet conseil"),
            ("seo", "agence SEO"),
            ("référencement", "agence SEO"),
        ]
        self.exclusions = {
            "immobilier", "restauration", "annuaire",
            "restaurant", "real estate", "restaurant"
        }
        self.penalties = {
            "immobilier": -30,
            "restauration": -30,
            "annuaire": -30,
            "restaurant": -30,
            "real estate": -30,
        }

    def process(self, prompt: str, **kwargs) -> dict:
        """Process a prompt heuristically.

        Currently supports:
          - qualification: score a company (0-100)
          - personalization: draft an email
        """
        # Simple heuristic: extract context from prompt
        if "qualify" in prompt.lower() or "score" in prompt.lower():
            return self.qualify(**kwargs)
        elif "draft" in prompt.lower() or "personalize" in prompt.lower():
            return self.draft(**kwargs)
        else:
            # Default: treat as qualification
            return self.qualify(**kwargs)

    def qualify(self, text: str = "", domain: str = "", **kwargs) -> dict:
        """Heuristic qualification: score a company (0-100)."""
        text_lower = (text or "").lower()
        score = 50  # Base score

        # Check for positive signals
        found_signals = []
        for keyword, sector in self.signals:
            if keyword.lower() in text_lower:
                score += 10
                found_signals.append(sector)

        # Check for negative signals (penalties)
        for negative, penalty in self.penalties.items():
            if negative.lower() in text_lower:
                score += penalty
                found_signals.append(f"NEG:{negative}")

        # Clamp score
        score = max(0, min(100, score))

        # Determine if qualified
        qualified = score >= 70

        return {
            "score": score,
            "qualified": qualified,
            "reason": "; ".join(found_signals) if found_signals else "no signals found",
            "sector_guess": found_signals[0] if found_signals else None,
        }

    def draft(self, text: str = "", company: Optional[dict] = None, **kwargs) -> dict:
        """Heuristic email draft generation."""
        domain = company.get("domain", "") if company else kwargs.get("domain", "")
        name = company.get("name", domain.split(".")[0] if domain else "Votre entreprise") if company else "Votre entreprise"

        subject = f"Proposition de collaboration - {name}"
        body = (
            f"Bonjour,\n\n"
            f"Je vous contacte au nom de {name} pour vous proposer une collaboration.\n\n"
            f"Nous sommes spécialisés dans l'acquisition B2B et la prospection digitale.\n"
            f"Nos solutions permettent d'augmenter vos opportunités commerciales de 30% en moyenne.\n\n"
            f"Seriez-vous disponible pour un appel de 15 minutes cette semaine ?\n\n"
            f"Cordialement,\nL'équipe Outbound"
        )

        return {
            "subject": subject,
            "body": body,
            "language": "fr",
        }

    def extract_contact_info(self, html: str) -> dict:
        """Extract contact info from HTML (heuristically)."""
        import re
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', html)
        return {"emails": list(set(emails))}


__all__ = ["LLMManager", "HeuristicEngine"]