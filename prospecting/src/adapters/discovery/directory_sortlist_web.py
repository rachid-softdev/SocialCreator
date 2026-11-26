"""Classement Sortlist France « développement web » (`/developpement-web/france-fr`).

Complément aux classements SEO et France : les agences de développement web sont
un vivier proche de l'ICP (sites, applications, e-commerce). Le module lit quatre
pages, filtre FR/BE/CH/LU et met les fiches uniques en cache. Le lot est limité
côté `run_scale.py` avec `--limit`.
"""
from pathlib import Path
from typing import Dict, List, Optional

from src.adapters.discovery.directory_sortlist import SortlistDirectory

LISTING = "https://www.sortlist.fr/developpement-web/france-fr"
CACHE = Path("data/output/sortlist_web_agencies.json")
MAX_PAGES = 4

_directory = SortlistDirectory(LISTING, CACHE, MAX_PAGES, source="sortlistweb")


def fetch_profile_urls() -> List[str]:
    return _directory.fetch_profile_urls()


def fetch_profile(url: str) -> Optional[Dict]:
    return _directory.fetch_profile(url)
