"""
LLM-based prospect discovery adapter.

Uses an LLM (via opencode / kilo / openrouter / openai / heuristic) to generate
a list of target B2B companies matching an ICP query, instead of scraping Google.

This is the `opencode --auto` / `kilo --auto` search adapter mentioned alongside
Google + DuckDuckGo.
"""

import json
import re
from typing import List, Optional

from src.prospecting_types import SearchResult
from src.llm import LLMManager
from src.utils import log


class LLMSearcher:
    """
    Génère des prospects cibles via un LLM plutôt que par scraping SERP.

    Le LLM reçoit une requête ICP et retourne une liste JSON d'entreprises
    cibles (nom, domaine, site web, description). Retourne des SearchResult.
    """

    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None,
                 api_key: Optional[str] = None, base_url: Optional[str] = None,
                 fallback_provider: Optional[str] = None,
                 fallback_model: Optional[str] = None):
        """
        provider: default "opencode"
        fallback_provider: default "kilo"

        ``model`` / ``fallback_model`` default to None, which lets each CLI
        pick its own configured default model.
        """
        self.provider = provider or "opencode"
        self.model = model
        self.fallback_provider = fallback_provider or "kilo"
        self.fallback_model = fallback_model
        self.llm = LLMManager(config={
            "provider": self.provider,
            "model": self.model,
            "api_key": api_key,
            "base_url": base_url,
        })

    def _call_with_chain(self, prompt: str) -> str:
        """
        Call opencode --auto, with kilo --auto fallback handled by LLMManager.

        Returns the LLM text output and raises if both providers fail.
        """
        result = self.llm.call(prompt)
        if isinstance(result, dict):
            return result.get("text", "")
        return str(result or "")

    def search(self, query: str, num_results: int = 10) -> List[SearchResult]:
        """
        Demande au LLM de générer des entreprises cibles pour la requête.

        Retourne une liste de SearchResult (peut être vide si le LLM échoue).
        """
        prompt = self._build_prompt(query, num_results)

        try:
            text = self._call_with_chain(prompt)
            companies = self._parse_json(text)
        except Exception as e:  # noqa: BLE001
            log.warning(f"LLM search failed for '{query}': {e}")
            companies = []

        search_results: List[SearchResult] = []
        seen_domains = set()
        for c in companies:
            domain = (c.get("domain") or c.get("website") or "").strip().lower()
            domain = self._normalize_domain(domain)
            if not domain or domain in seen_domains or "." not in domain:
                continue
            seen_domains.add(domain)
            search_results.append(SearchResult(
                title=c.get("name", domain.split(".")[0].capitalize()),
                url=c.get("website", f"https://{domain}"),
                snippet=c.get("description", ""),
                position=len(search_results) + 1,
            ))

        log.info(f"LLM search '{query}': {len(search_results)} entreprises")
        return search_results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_prompt(query: str, num_results: int) -> str:
        return (
            f"Tu es un expert en prospection B2B cold email. "
            f"Génère une liste de {num_results} entreprises réelles françaises "
            f"correspondant à cette requête : \"{query}\".\n"
            "Pour chaque entreprise, fournis :\n"
            "- name : nom officiel de l'entreprise\n"
            "- domain : nom de domaine principal (ex: exemple.fr, sans https://)\n"
            "- website : URL complète du site (ex: https://exemple.fr)\n"
            "- description : ce que fait l'entreprise (une phrase)\n"
            "Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour.\n"
            "Exemple de format :\n"
            '[{"name":"LeadActiv","domain":"leadactiv.fr","website":"https://leadactiv.fr","description":"Agence de prospection B2B externalisée"}]\n'
        )

    @staticmethod
    def _parse_json(text: str) -> List[dict]:
        """Extrait un tableau JSON depuis le texte du LLM (résiliente au bruit)."""
        # Try direct parse
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return [c for c in data if isinstance(c, dict)]
            if isinstance(data, dict):
                for key in ("companies", "entreprises", "results", "items"):
                    if isinstance(data.get(key), list):
                        return [c for c in data[key] if isinstance(c, dict)]
        except (json.JSONDecodeError, ValueError):
            pass

        # Try to find JSON array within the text
        match = re.search(r"\[\s*\{.*\}\s*\]", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except (json.JSONDecodeError, ValueError):
                pass

        # Try to find individual JSON objects
        objects = re.findall(r"\{[^{}]*\}", text)
        found = []
        for obj in objects:
            try:
                d = json.loads(obj)
                if isinstance(d, dict) and ("name" in d or "domain" in d or "website" in d):
                    found.append(d)
            except (json.JSONDecodeError, ValueError):
                continue
        return found

    @staticmethod
    def _normalize_domain(domain: str) -> str:
        domain = domain.strip().lower()
        for prefix in ("https://", "http://", "www."):
            if domain.startswith(prefix):
                domain = domain[len(prefix):]
        # Strip path, query, fragment
        domain = domain.split("/")[0].split("?")[0].split("#")[0]
        return domain
