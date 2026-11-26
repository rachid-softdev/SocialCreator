"""Sirene API integration for French company discovery (INSEE SIRENE database).

Adapted from EntreprisesScraper/sources/sirene_file.py.
Provides SIRENE data download, parsing, and filtering for French companies.
"""

import csv
import os
import zipfile
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import httpx

from src.utils import log
from src.prospecting_types import Company


# Base URL for the SIRENE dataset on data.gouv.fr
URL_DATASET = (
    "https://www.data.gouv.fr/api/1/datasets/"
    "base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/"
)

# Column definitions per INSEE "dessin de fichier" v311
DESSIN_UNITELEGALE = [
    "siren", "statutDiffusionUniteLegale", "unitePurgeeUniteLegale",
    "dateCreationUniteLegale", "sigleUniteLegale", "sexeUniteLegale",
    "prenom1UniteLegale", "prenom2UniteLegale", "prenom3UniteLegale",
    "prenom4UniteLegale", "prenomUsuelUniteLegale", "pseudonymeUniteLegale",
    "identifiantAssociationUniteLegale", "trancheEffectifsUniteLegale",
    "anneeEffectifsUniteLegale", "dateDernierTraitementUniteLegale",
    "nombrePeriodesUniteLegale", "categorieEntreprise", "anneeCategorieEntreprise",
    # --- bloc période (16 champs, répété) ---
    "dateDebut", "etatAdministratifUniteLegale", "nomUniteLegale",
    "nomUsageUniteLegale", "denominationUniteLegale", "denominationUsuelle1UniteLegale",
    "denominationUsuelle2UniteLegale", "denominationUsuelle3UniteLegale",
    "categorieJuridiqueUniteLegale", "activitePrincipaleUniteLegale",
    "nomenclatureActivitePrincipaleUniteLegale", "nicSiegeUniteLegale",
    "economieSocialeSolidaireUniteLegale", "societeMissionUniteLegale",
    "caractereEmployeurUniteLegale", "activitePrincipaleNAF25UniteLegale",
]
FIXES_UL = 19
BLOC_UL = 16

DESSIN_ETABLISSEMENT = [
    "siren", "nic", "siret", "statutDiffusionEtablissement",
    "dateCreationEtablissement", "trancheEffectifsEtablissement",
    "anneeEffectifsEtablissement", "activitePrincipaleRegistreMetiersEtablissement",
    "dateDernierTraitementEtablissement", "etablissementSiege",
    "nombrePeriodesEtablissement", "complementAdresseEtablissement",
    "numeroVoieEtablissement", "indiceRepetitionEtablissement",
    "dernierNumeroVoieEtablissement", "indiceRepetitionDernierNumeroVoieEtablissement",
    "typeVoieEtablissement", "libelleVoieEtablissement", "codePostalEtablissement",
    "libelleCommuneEtablissement", "libelleCommuneEtrangerEtablissement",
    "distributionSpecialeEtablissement", "codeCommuneEtablissement",
    "codeCedexEtablissement", "libelleCedexEtablissement",
    "codePaysEtrangerEtablissement", "libellePaysEtrangerEtablissement",
    "identifiantAdresseEtablissement", "coordonneeLambertAbscisseEtablissement",
    "coordonneeLambertOrdonneeEtablissement", "complementAdresse2Etablissement",
    "numeroVoie2Etablissement", "indiceRepetition2Etablissement",
    "typeVoie2Etablissement", "libelleVoie2Etablissement", "codePostal2Etablissement",
    "libelleCommune2Etablissement", "libelleCommuneEtranger2Etablissement",
    "distributionSpeciale2Etablissement", "codeCommune2Etablissement",
    "codeCedex2Etablissement", "libelleCedex2Etablissement",
    "codePaysEtranger2Etablissement", "libellePaysEtranger2Etablissement",
    # --- bloc période (10 champs, répété) ---
    "dateDebut", "etatAdministratifEtablissement", "enseigne1Etablissement",
    "enseigne2Etablissement", "enseigne3Etablissement",
    "denominationUsuelleEtablissement", "activitePrincipaleEtablissement",
    "nomenclatureActivitePrincipaleEtablissement",
    "caractereEmployeurEtablissement", "activitePrincipaleNAF25Etablissement",
]
FIXES_ET = 44
BLOC_ET = 10

PROFIL_FORMATS: Dict[str, Tuple[List[str], int, int]] = {
    "unitelegale": (DESSIN_UNITELEGALE, FIXES_UL, BLOC_UL),
    "etablissement": (DESSIN_ETABLISSEMENT, FIXES_ET, BLOC_ET),
}

HOST_ZIP = {
    "unitelegale": "stockunitelegale",
    "etablissement": "stocketablissement",
}


@dataclass
class SireneResult:
    """Result of SIRENE filtering operation."""
    companies: List[Company] = field(default_factory=list)
    lines_read: int = 0
    companies_filtered: int = 0
    errors: int = 0


def find_resource_url(
    fichier: str = "unitelegale",
    format_fichier: str = "zip",
    client: Optional[httpx.Client] = None
) -> str:
    """Resolve current SIRENE file URL via data.gouv.fr API.

    Uses exact filename in URL to avoid historical files.
    """
    close_client = client is None
    client = client or httpx.Client(timeout=60, follow_redirects=True)
    segment = "csv" if format_fichier == "zip" else "parquet"
    extension = ".zip" if format_fichier == "zip" else ".parquet"
    target = f"stock-{HOST_ZIP[fichier]}-{segment}{extension}"
    try:
        r = client.get(URL_DATASET)
        r.raise_for_status()
        data = r.json()
        for res in data.get("resources", []):
            url = res.get("url") or ""
            fmt = (res.get("format") or "").lower()
            if url.rstrip("/").endswith(target) and fmt == format_fichier.lower():
                log.info(f"Ressource SIRENE trouvée : {res.get('title')}")
                return url
        raise LookupError(
            f"Aucune ressource se terminant par '{target}' (format {format_fichier}) "
            f"dans le jeu de données data.gouv.fr."
        )
    finally:
        if close_client:
            client.close()


def download_sirene(
    dest_dir: str,
    fichier: str = "unitelegale",
    format_fichier: str = "zip",
    url: Optional[str] = None
) -> str:
    """Download SIRENE zip and extract CSV. Returns CSV path."""
    os.makedirs(dest_dir, exist_ok=True)
    url = url or find_resource_url(fichier, format_fichier)

    zip_path = os.path.join(dest_dir, f"sirene_{fichier}.zip")
    log.info(f"📥 Téléchargement SIRENE : {url}")
    with httpx.stream("GET", url, timeout=600, follow_redirects=True) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length") or 0)
        downloaded = 0
        with open(zip_path, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // max(total, 1)
                    log.debug(f"   {downloaded/1e6:.0f} Mo / {total/1e6:.0f} Mo ({pct}%)")

    log.info("   Décompression…")
    csv_path = None
    with zipfile.ZipFile(zip_path) as z:
        for member in z.namelist():
            if member.lower().endswith((".csv", ".txt")):
                csv_path = os.path.join(dest_dir, os.path.basename(member))
                with z.open(member) as src, open(csv_path, "wb") as dst:
                    dst.write(src.read())
                break
    if not csv_path:
        raise RuntimeError("Aucun CSV trouvé dans l'archive SIRENE.")
    log.info(f"   ✓ CSV extrait : {csv_path}")
    return csv_path


def _split_period_blocks(row: List[str], dessin: List[str], fixes: int, bloc: int) -> List[Dict[str, str]]:
    """Split a row into period blocks (dicts field->value)."""
    if len(row) < fixes + bloc:
        return []
    block_fields = dessin[fixes:]
    num_blocks = (len(row) - fixes) // bloc
    return [
        {block_fields[j]: row[fixes + i * bloc + j] for j in range(bloc)}
        for i in range(num_blocks)
    ]


def _last_active_block(blocks: List[Dict[str, str]], state_key: str) -> Optional[Dict[str, str]]:
    """Return last block with administrative state 'A' (active), or None."""
    for block in reversed(blocks):
        if (block.get(state_key) or "").strip() == "A":
            return block
    return None


def filter_sirene(
    csv_path: str,
    naf_codes: Optional[List[str]] = None,
    departements: Optional[List[str]] = None,
    tranches_effectif: Optional[List[str]] = None,
    keep_diffusion_status: Optional[List[str]] = None,
    limit: int = 0,
    file_type: str = "unitelegale"
) -> SireneResult:
    """Stream-read SIRENE CSV and apply filters (limit=0 = unlimited)."""
    naf_codes = [c.strip() for c in (naf_codes or []) if c.strip()]
    departements = departements or []
    tranches = tranches_effectif or []
    keep = keep_diffusion_status or ["O"]  # "P" = partial diffusion (identity masked)

    dessin, fixes, bloc = PROFIL_FORMATS[file_type]
    block_fields = dessin[fixes:]
    state_key = block_fields[1]  # etatAdministratif{UniteLegale|Etablissement}

    # Fixed column indices per file type
    if file_type == "unitelegale":
        idx_statut_diff = 1
        idx_tranche = 13
        idx_code_postal = None
        idx_is_siege = None
    else:
        idx_statut_diff = 3
        idx_tranche = 5
        idx_code_postal = 18
        idx_is_siege = 9

    result = SireneResult()
    encodings = ("utf-8-sig", "utf-8", "latin-1")

    for enc in encodings:
        try:
            with open(csv_path, "r", encoding=enc, newline="", errors="replace") as f:
                reader = csv.reader(f, delimiter=",")
                for row in reader:
                    result.lines_read += 1
                    if not row or not row[0].strip().isdigit():
                        continue  # empty or header line
                    if len(row) < fixes + bloc:
                        result.errors += 1
                        continue
                    if idx_is_siege is not None and row[idx_is_siege].strip() != "1":
                        continue  # keep only head office (discovery by establishments)
                    if keep and row[idx_statut_diff].strip() not in keep:
                        continue
                    blocks = _split_period_blocks(row, dessin, fixes, bloc)
                    if not blocks:
                        result.errors += 1
                        continue
                    active_block = _last_active_block(blocks, state_key)
                    if active_block is None:
                        result.errors += 1
                        continue

                    naf = (
                        active_block.get("activitePrincipaleUniteLegale")
                        if file_type == "unitelegale"
                        else active_block.get("activitePrincipaleEtablissement") or ""
                    ).strip()
                    tranche = row[idx_tranche].strip()
                    code_postal = row[idx_code_postal].strip() if idx_code_postal is not None else ""

                    # Apply filters
                    if naf_codes and naf not in naf_codes:
                        continue
                    if departements:
                        cp = code_postal or ""
                        if not cp or cp[:2] not in departements:
                            continue
                    if tranches and tranche not in tranches:
                        continue

                    result.companies.append(
                        _row_to_company(row, active_block, file_type)
                    )
                    result.companies_filtered += 1
                    if limit and result.companies_filtered >= limit:
                        return result
            break
        except UnicodeDecodeError:
            continue

    log.info(
        f"   -> {csv_path}: lu={result.lines_read}, "
        f"gardées={result.companies_filtered}, erreurs={result.errors}"
    )
    return result


def _row_to_company(row: List[str], block: Dict[str, str], file_type: str) -> Company:
    """Convert a SIRENE row + active block to Company."""
    if file_type == "unitelegale":
        denomination = (
            block.get("denominationUniteLegale")
            or block.get("nomUsageUniteLegale")
            or block.get("nomUniteLegale")
            or ""
        ).strip()
        return Company(
            domain="",  # No website in SIRENE data
            name=denomination,
            postal_code="",
            city="",
            sector=block.get("activitePrincipaleUniteLegale", "").strip(),
            employees=None,
            country="FR",
            source="sirene",
            description=f"SIREN: {row[0].strip()} | NAF: {block.get('activitePrincipaleUniteLegale', '').strip()} | "
                        f"Effectifs: {row[13].strip()} | CatJuridique: {block.get('categorieJuridiqueUniteLegale', '').strip()}",
        )
    # établissement (siège)
    pieces = [p for p in (row[12].strip(), row[16].strip(), row[17].strip()) if p]
    return Company(
        domain="",
        name=(block.get("denominationUsuelleEtablissement") or "").strip(),
        postal_code=row[18].strip(),
        city=row[19].strip(),
        sector=block.get("activitePrincipaleEtablissement", "").strip(),
        employees=None,
        country="FR",
        source="sirene_etablissement",
        description=f"SIREN: {row[0].strip()} | SIRET: {row[2].strip()} | NAF: {block.get('activitePrincipaleEtablissement', '').strip()} | "
                    f"Effectifs: {row[5].strip()}",
    )


def create_sample_csv(path: str, rows: List[List[str]], file_type: str = "unitelegale") -> None:
    """Create a sample SIRENE CSV for testing."""
    dessin, fixes, bloc = PROFIL_FORMATS[file_type]
    min_len = fixes + bloc
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for row in rows:
            if len(row) < min_len:
                row = row + [""] * (min_len - len(row))
            writer.writerow(row)


__all__ = [
    "SireneResult",
    "find_resource_url",
    "download_sirene",
    "filter_sirene",
    "create_sample_csv",
]