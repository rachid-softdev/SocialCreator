"""Classement Sortlist France (`/seo/france-fr`), complément du top francophone.

Le classement France contient ~1 691 agences. On lit les quatre premières pages
(20 puis 100 par page) et on garde les domaines uniques. Le lot est volontairement
limité côté `run_scale.py` avec `--limit` pour préserver la qualité du harvesting.
"""
from pathlib import Path

from src.adapters.discovery.directory_sortlist import SortlistDirectory

LISTING = "https://www.sortlist.fr/seo/france-fr"
CACHE = Path("data/output/sortlist_fr_agencies.json")
MAX_PAGES = 4

_directory = SortlistDirectory(LISTING, CACHE, MAX_PAGES, source="sortlistfr")


def fetch_profile_urls():
    return _directory.fetch_profile_urls()


def fetch_profile(url):
    return _directory.fetch_profile(url)
