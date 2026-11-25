"""Annuaire-entreprises.fr directory scraping for French company discovery.

Adapted from EntreprisesScraper/sources/annuaire_entreprises.py.
Uses the Recherche d'Entreprises API (annuaire-entreprises.data.gouv.fr).
"""

import time
from typing import Dict, List, Optional

import httpx

from src.utils import log


BASE_URL = "https://recherche-entreprises.api.gouv.fr"


class AnnuaireEntreprisesClient:
    """HTTP politeness client (rate-limit + retries on 429/5xx)."""

    def __init__(self, delai: float = 0.3, tentatives: int = 3,
                 user_agent: Optional[str] = None):
        self.delai = delai
        self.tentatives = tentatives
        self.client = httpx.Client(
            timeout=30,
            headers={"User-Agent": user_agent or "prospecting/1.0 (contact: local)"},
        )

    def _get(self, chemin: str, params: dict) -> dict:
        for essai in range(1, self.tentatives + 1):
            try:
                r = self.client.get(f"{BASE_URL}{chemin}", params=params)
                if r.status_code == 429:
                    time.sleep(self.delai * 10 * essai)
                    continue
                r.raise_for_status()
                return r.json()
            except httpx.HTTPError as e:
                if essai == self.tentatives:
                    raise
                time.sleep(self.delai * essai * 2)
        return {}

    def rechercher(self, q: str, page: int = 1, per_page: int = 25) -> dict:
        time.sleep(self.delai)
        return self._get("/search", {"q": q, "page": page, "per_page": per_page})

    def chercher_par_siren(self, siren: str) -> Optional[dict]:
        """Exact search by SIREN (returns fiche or None)."""
        data = self.rechercher(q=siren, per_page=1)
        for res in data.get("results", []):
            if str(res.get("siren", "")).strip() == str(siren).strip():
                return res
        return None

    def fermer(self) -> None:
        self.client.close()


def enrichir_annuaire(
    entreprises: List[dict],
    client: Optional[AnnuaireEntreprisesClient] = None,
    avancement=None
) -> List[dict]:
    """Enrich companies via the API (get fiche with dirigeants and address).

    Returns the list of API fiches retrieved (for dirigeants and addresses).
    """
    fermer = client is None
    client = client or AnnuaireEntreprisesClient()
    try:
        fiches: List[dict] = []
        n = len(entreprises)
        for i, e in enumerate(entreprises, 1):
            try:
                fiche = client.chercher_par_siren(e.get("siren", ""))
            except Exception as exc:  # noqa: BLE001
                if avancement:
                    avancement(i, n, e.get("siren", ""), f"erreur HTTP: {exc}")
                continue
            if fiche:
                fiches.append(fiche)
                if avancement:
                    avancement(i, n, e.get("siren", ""), fiche.get("nom_complet", ""))
            else:
                if avancement:
                    avancement(i, n, e.get("siren", ""), "introuvable")
        return fiches
    finally:
        if fermer:
            client.fermer()


__all__ = [
    "AnnuaireEntreprisesClient",
    "enrichir_annuaire",
    "BASE_URL",
]
