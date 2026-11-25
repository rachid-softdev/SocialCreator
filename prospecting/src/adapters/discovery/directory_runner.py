#!/usr/bin/env python3
"""
Multi-source directory runner — adapted from Folia's directory_runner.py.

Orchestrates prospect discovery across multiple directory sources
(agences-web-france.fr, mon-expert-digital.com, etc.) following Folia's
pattern of combining multiple directory sources.

Each directory adapter exposes `fetch_profile_urls()` and `fetch_profile(url)`.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Dict, List, Optional

from src.utils import log


def directory_runner(
    limit: int = 100,
    workers: int = 8,
    directory_sources: Optional[List[str]] = None,
) -> List[Dict]:
    """
    Run discovery across multiple directory sources and return unique companies.

    Follows Folia's pattern: iterate over directory source modules,
    fetch profile URLs, then fetch each profile in parallel,
    deduplicate by domain, and return company dicts.

    Directory source modules must expose:
        - fetch_profile_urls(limit) -> List[str]
        - fetch_profile(url) -> Optional[dict]

    Args:
        limit: Maximum total companies across all sources
        workers: Thread pool workers for parallel profile fetching
        directory_sources: List of source module names (e.g. ["directory_discovery",
            "directory_expert", "directory_prestavis", "directory_fepsem",
            "directory_local"]). If None, all built-in sources are used.

    Returns:
        List of company dicts with domain, name, website, etc.
    """
    if directory_sources is None:
        directory_sources = [
            "directory_discovery",   # agences-web-france.fr
            "directory_expert",      # mon-expert-digital.com
            "directory_prestavis",   # prestavis.com
            "directory_fepsem",      # fepsem.org
            "directory_local",       # annuaire-des-entreprises-locales.fr
        ]

    all_companies: List[Dict] = []
    seen_domains: set = set()

    for source_name in directory_sources:
        try:
            source = _import_source(source_name)
        except Exception as exc:  # noqa: BLE001
            log.warning(f"directory_runner: unable to import {source_name}: {exc}")
            continue

        if not hasattr(source, "fetch_profile_urls") or not hasattr(source, "fetch_profile"):
            log.warning(f"directory_runner: {source_name} missing required functions")
            continue

        try:
            urls = source.fetch_profile_urls()
        except Exception as exc:  # noqa: BLE001
            log.warning(f"directory_runner: {source_name} fetch_profile_urls failed: {exc}")
            continue

        if not urls:
            log.info(f"{source_name}: 0 profile URLs")
            continue

        log.info(f"{source_name}: {len(urls)} profile URLs (limit={limit})")

        # Fetch profiles in parallel
        fetched: List[Dict] = []
        remaining = limit - len(all_companies)
        if remaining <= 0:
            break

        urls_to_fetch = urls[:remaining * 2]  # fetch some extra to account for failures

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(source.fetch_profile, u): u for u in urls_to_fetch}
            for fut in as_completed(futures):
                try:
                    company = fut.result()
                except Exception as exc:  # noqa: BLE001
                    log.debug(f"profile fetch failed: {exc}")
                    continue
                if not company:
                    continue
                domain = company.get("domain", "")
                if not domain or domain in seen_domains:
                    continue
                seen_domains.add(domain)
                company["source"] = company.get("source") or source_name
                fetched.append(company)

                if len(fetched) >= remaining:
                    break

        log.success(f"{source_name}: {len(fetched)} companies fetched")
        all_companies.extend(fetched)

        if len(all_companies) >= limit:
            break

    log.success(f"directory_runner complete: {len(all_companies)} total companies from {len(directory_sources)} sources")
    return all_companies[:limit]


def _import_source(module_name: str):
    """Import a directory source module by name."""
    import importlib

    candidates = [
        f"src.adapters.discovery.{module_name}",
        f"adapters.discovery.{module_name}",
        module_name,
    ]

    last_error = None
    for candidate in candidates:
        try:
            return importlib.import_module(candidate)
        except ImportError as exc:
            last_error = exc
            continue

    raise ImportError(f"Could not import directory source '{module_name}': {last_error}")


__all__ = [
    "directory_runner",
]