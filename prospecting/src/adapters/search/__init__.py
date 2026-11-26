"""
Unified multi-engine search system integrating Omnysync and Folia backends.

Exports:
- get_searcher() → returns a FallbackSearcher with configured providers based on SEARCH_PROVIDER env var
- FallbackSearcher class that tries multiple backends
- DuckSearcher class (Chrome/Selenium DuckDuckGo search) from Folia
- EcosiaSearcher class from Folia
- BingSearcher from Omnysync
- BraveSearcher from Omnysync (checks for API key)
- GoogleSearcher from unified package's existing google_search.py
"""

from __future__ import annotations

import base64
import json
import os
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from src.utils import log, smart_delay, normalize_domain, read_json, write_json
from src.crm import CRM
from src.prospecting_types import SearchResult

# Re-export the existing GoogleSearcher from the unified package
from src.adapters.discovery.google_search import GoogleSearcher as _GoogleSearcher

# -----------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------

# Timeouts per source (task requirement: Omnysync=12, Folia=12, unified=20)
HTTP_TIMEOUT_OMNI = 12
HTTP_TIMEOUT_FOLIA = 12
HTTP_TIMEOUT_UNIFIED = 20

# Retry configuration
SEARCH_MAX_RETRIES = int(os.environ.get("SEARCH_MAX_RETRIES", "3"))
SEARCH_RETRY_BACKOFF = float(os.environ.get("SEARCH_RETRY_BACKOFF", "2.0"))

# Configurable delays (avoid rate limiting)
SEARCH_DELAY_MIN = float(os.environ.get("SEARCH_DELAY_MIN", "2.0"))
SEARCH_DELAY_MAX = float(os.environ.get("SEARCH_DELAY_MAX", "5.0"))

# Optional proxy support
HTTP_PROXY = os.environ.get("HTTP_PROXY") or os.environ.get("PROXY_URL")

# Circuit breaker persistence
CIRCUIT_BREAKER_STATE_FILE = os.environ.get(
    "CIRCUIT_BREAKER_STATE_FILE", "data/search_circuit_breaker.json"
)

# Whether to use Selenium-based searchers (DuckDuckGo, Ecosia, Google).
# Set to "false" to fall back to requests-only searchers (Bing) when Chrome
# is unavailable.
USE_SELENIUM = os.environ.get("USE_SELENIUM", "true").lower() in ("1", "true", "yes")

# User-Agent strings
USER_AGENTS_OMNI = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

USER_AGENTS_FOLIA = USER_AGENTS_OMNI  # re-use unified package's agents

# Failure thresholds
MAX_CONSECUTIVE_FAILURES_OMNI = 2
MAX_LOAD_FAILURES_FOLIA = 3

# Search engine URLs
DUCK_URL = "https://duckduckgo.com/"
HTML_DUCK_URL = "https://html.duckduckgo.com/html/"
ECOSIA_URL = "https://www.ecosia.org/search"
BING_URL = "https://www.bing.com/search"
BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search"

# CSS Selectors
DUCK_RESULT_SELECTOR = "article[data-testid='result']"
DUCK_TITLE_SELECTOR = "a[data-testid='result-title-a']"
DUCK_SNIPPET_SELECTOR = "[data-result='snippet']"
ECOSIA_RESULT_SELECTOR = "article[data-test-id='organic-result']"
ECOSIA_LINK_SELECTOR = "a[data-test-id='result-link']"

# Challenge/CAPTCHA detection keywords (used for both DuckDuckGo and Google)
CHALLENGE_KEYWORDS = (
    "bots use duckduckgo too",
    "select all squares",
    "unusual traffic",
    "verify you are human",
    "captcha",
    "consent",
    "cookie",
    "robot",
    "automated",
    "blocked",
)


# -----------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------

def _get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """Get environment variable with optional default."""
    return os.environ.get(key, default)


def _headers_omni(lang: str = "fr") -> dict:
    """Request headers for Omnysync-style requests."""
    return {
        "User-Agent": random.choice(USER_AGENTS_OMNI),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6" if lang.startswith("fr") else "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
    }


def _headers_folia(lang: str = "fr") -> dict:
    """Request headers for Folia-style requests (uses Folia agents)."""
    return {
        "User-Agent": random.choice(USER_AGENTS_FOLIA),
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }


def _smart_delay_omni() -> None:
    """Omnysync-style delay from env vars."""
    min_delay = float(_get_env("SEARCH_DELAY_MIN", "3.0"))
    max_delay = float(_get_env("SEARCH_DELAY_MAX", "6.0"))
    if max_delay < min_delay:
        max_delay = min_delay
    smart_delay(min_delay, max_delay)


def _decode_ddg_url(href: str) -> Optional[str]:
    """Decode DuckDuckGo redirect URLs (/l/?uddg=...) and Google (/url?q=...)."""
    if not href:
        return None
    if href.startswith("//"):
        href = "https:" + href
    parsed = urlparse(href)
    qs = parse_qs(parsed.query)
    if parsed.path.startswith("/l/") or "uddg=" in parsed.query:
        if qs.get("uddg"):
            return unquote(qs["uddg"][0])
    if parsed.path.rstrip("/") == "/url" and qs.get("q"):
        target = qs["q"][0]
        return unquote(target) if target.startswith(("http://", "https://")) else None
    return href


def _decode_bing_url(href: str) -> Optional[str]:
    """Decode Bing redirect URLs (ck/a?...&u=a1<base64>)."""
    if not href:
        return None
    if href.startswith("//"):
        href = "https:" + href
    parsed = urlparse(href)
    if "bing.com/ck/a" not in parsed.netloc + parsed.path:
        return href
    qs = parse_qs(parsed.query)
    raw = (qs.get("u") or [""])[0]
    if raw.startswith("a1"):
        raw = raw[2:]
    try:
        padded = raw + "=" * (-len(raw) % 4)
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    except Exception:
        return None


def _clean_duck_url(href: str) -> Optional[str]:
    """Decode DuckDuckGo HTML redirect URLs."""
    if not href:
        return None
    href = href.strip()
    if href.startswith("//"):
        href = "https:" + href
    if href.startswith(("javascript:", "mailto:")):
        return None
    parsed = urlparse(href)
    if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        query = parse_qs(parsed.query)
        target = query.get("uddg", [None])[0]
        if target:
            return unquote(target)
        return None
    return href


def _parse_duck_html(html: str, num_results: int = 10) -> List[SearchResult]:
    """Parse DuckDuckGo HTML results (fallback without browser)."""
    soup = BeautifulSoup(html, "html.parser")
    results: List[SearchResult] = []
    seen = set()

    blocks = soup.select("div.result")
    if not blocks:
        blocks = soup.select("div.web-result")

    for block in blocks:
        if len(results) >= num_results:
            break
        link = block.select_one("a.result__a")
        if not link:
            continue
        title = link.get_text(" ", strip=True)
        url = _clean_duck_url(link.get("href", ""))
        if not title or not url or url in seen:
            continue
        if "duckduckgo.com" in url:
            continue
        snippet_el = block.select_one(".result__snippet")
        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
        seen.add(url)
        results.append(
            SearchResult(
                title=title[:200],
                url=url,
                snippet=snippet[:500],
                position=len(results) + 1,
            )
        )
    return results


# -----------------------------------------------------------------------
# Circuit breaker state persistence
# -----------------------------------------------------------------------

def _save_circuit_breaker_state(searcher_name: str, blocked: bool) -> None:
    """Persist circuit breaker state to a JSON file so it survives across runs."""
    state = read_json(CIRCUIT_BREAKER_STATE_FILE, {})
    if state is None:
        state = {}
    state[searcher_name] = {
        "blocked": blocked,
        "timestamp": _utc_timestamp(),
    }
    write_json(CIRCUIT_BREAKER_STATE_FILE, state)


def _load_circuit_breaker_state(searcher_name: str) -> bool:
    """Load circuit breaker state from file. Returns True if previously blocked."""
    state = read_json(CIRCUIT_BREAKER_STATE_FILE, {})
    if not state or searcher_name not in state:
        return False
    # Only respect blocks that are less than 24 hours old
    entry = state[searcher_name]
    if not isinstance(entry, dict) or not entry.get("blocked"):
        return False
    ts = entry.get("timestamp")
    if ts:
        try:
            from datetime import datetime, timedelta, timezone
            saved = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if saved.tzinfo is None:
                saved = saved.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - saved > timedelta(hours=24):
                # Expired block, clear it
                _save_circuit_breaker_state(searcher_name, False)
                return False
        except Exception:  # noqa: BLE001
            pass
    return True


def _utc_timestamp() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# -----------------------------------------------------------------------
# Retry helper
# -----------------------------------------------------------------------

def _retry_on_failure(max_retries: int = 0, backoff: float = 0.0):
    """Decorator to retry a search function on failure.

    Each retry increases the wait time by `backoff` seconds (exponential).
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            retries = max_retries or SEARCH_MAX_RETRIES
            backoff_base = backoff or SEARCH_RETRY_BACKOFF
            last_exc = None
            for attempt in range(retries):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:  # noqa: BLE001
                    last_exc = exc
                    if attempt < retries - 1:
                        wait = backoff_base * (2 ** attempt)
                        log.debug(f"Retry {attempt + 1}/{retries} after {wait:.1f}s: {exc}")
                        smart_delay(wait, wait + 0.5)
            if last_exc:
                raise last_exc
            return []
        return wrapper
    return decorator


# -----------------------------------------------------------------------
# Base Searcher Interface
# -----------------------------------------------------------------------

class BaseSearcher:
    """Base interface for all search backends."""

    name = "base"

    def search(self, query: str, num_results: int = 10, lang: str = "fr") -> List[SearchResult]:
        raise NotImplementedError

    def close(self) -> None:
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# -----------------------------------------------------------------------
# DuckDuckGo Searcher (Folia - Selenium)
# -----------------------------------------------------------------------

class DuckSearcher(BaseSearcher):
    """DuckDuckGo search via Chrome headless with CDP user-agent override (Folia pattern)."""

    name = "duckduckgo"

    def __init__(self, headless: bool = True, results_per_query: int = 10):
        self.headless = headless
        self.results_per_query = results_per_query
        self._driver: Optional[webdriver.Chrome] = None
        self._blocked = _load_circuit_breaker_state(self.name)
        self._failures = 0

    def _create_driver(self) -> webdriver.Chrome:
        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--lang=fr-FR")
        options.add_argument(f"user-agent={random.choice(USER_AGENTS_FOLIA)}")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        chrome_bin = _get_env("CHROME_BIN", "").strip()
        if chrome_bin:
            options.binary_location = chrome_bin

        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(HTTP_TIMEOUT_FOLIA)
        driver.execute_cdp_cmd(
            "Network.setUserAgentOverride",
            {"userAgent": random.choice(USER_AGENTS_FOLIA)},
        )
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        return driver

    def _ensure_driver(self) -> None:
        if self._driver is None:
            log.debug("Création du driver Chrome (DuckDuckGo)...")
            self._driver = self._create_driver()

    def close(self) -> None:
        if self._driver is not None:
            try:
                self._driver.quit()
            except Exception:  # noqa: BLE001
                pass
            self._driver = None

    def search(self, query: str, num_results: Optional[int] = None, lang: str = "fr") -> List[SearchResult]:
        if self._blocked:
            log.debug("DuckDuckGo bloqué précédemment : recherche ignorée")
            return []

        self._ensure_driver()
        num_results = num_results or self.results_per_query
        url = f"{DUCK_URL}?q={quote_plus(query)}&ia=web&kl=wt-wt"
        log.info(f"🔎 DuckDuckGo: {query}")

        try:
            self._driver.get(url)
            WebDriverWait(self._driver, 12).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, DUCK_RESULT_SELECTOR)
                )
            )
            smart_delay(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX)
        except Exception as exc:  # noqa: BLE001
            body = ""
            try:
                body = self._driver.find_element(By.TAG_NAME, "body").text
            except Exception:  # noqa: BLE001
                pass
            low_body = body.lower()
            if any(k in low_body for k in ("bots use duckduckgo too", "select all squares", "captcha", "robot")):
                self._blocked = True
                _save_circuit_breaker_state(self.name, True)
                log.warning("DuckDuckGo affiche un CAPTCHA : moteur ignoré pour ce run")
                return []

            self._failures += 1
            log.warning(f"DuckDuckGo: aucun résultat chargeable ({exc})")

            if self._failures >= 2:
                self.close()
            try:
                self._ensure_driver()
            except Exception as driver_exc:  # noqa: BLE001
                log.warning(f"Chrome indisponible pour DuckDuckGo: {driver_exc}")
            else:
                fallback = self._html_fallback(query, num_results)
                if fallback:
                    return fallback

            if self._failures >= MAX_LOAD_FAILURES_FOLIA:
                self._blocked = True
                _save_circuit_breaker_state(self.name, True)
                log.warning("DuckDuckGo bloqué après plusieurs échecs : moteur ignoré")
            return []

        results = self._extract_results(num_results)
        self._failures = 0
        log.debug(f"{len(results)} résultats DuckDuckGo extraits")
        smart_delay(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX)
        return results

    def _html_fallback(self, query: str, num_results: int) -> List[SearchResult]:
        """Fallback to HTML endpoint when React interface fails to load.

        Detects HTTP 202 / challenge pages and returns early so the caller
        can fall back to the next provider.
        """
        try:
            self._driver.get(
                f"{HTML_DUCK_URL}?q={quote_plus(query)}&kl=wt-wt"
            )
            smart_delay(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX)
            body = self._driver.find_element(By.TAG_NAME, "body").text
            low_body = body.lower()

            # Challenge / 202 detection
            if any(k in low_body for k in ("bots use duckduckgo too", "select all squares",
                                             "captcha", "robot", "consent")):
                self._blocked = True
                _save_circuit_breaker_state(self.name, True)
                log.warning("DuckDuckGo HTML affiche un défi CAPTCHA : moteur ignoré")
                return []

            if not low_body.strip():
                # Empty body often means a 202 challenge page without content
                self._failures += 1
                log.debug("DuckDuckGo HTML corps vide (possible 202 challenge)")
                return []

            results = _parse_duck_html(self._driver.page_source, num_results)
            if results:
                log.debug(f"{len(results)} résultats DuckDuckGo HTML extraits")
                self._failures = 0
            return results
        except Exception as exc:  # noqa: BLE001
            log.debug(f"Fallback HTML DuckDuckGo indisponible: {exc}")
            return []

    def _extract_results(self, num_results: int) -> List[SearchResult]:
        results: List[SearchResult] = []
        seen_urls = set()

        try:
            articles = self._driver.find_elements(By.CSS_SELECTOR, DUCK_RESULT_SELECTOR)
        except Exception:  # noqa: BLE001
            return results

        for article in articles:
            if len(results) >= num_results:
                break
            try:
                if (article.get_attribute("data-nrn") or "").lower() == "ad":
                    continue
                link = article.find_element(By.CSS_SELECTOR, DUCK_TITLE_SELECTOR)
                title = (link.text or "").strip()
                href = link.get_attribute("href") or ""
                url = _clean_duck_url(href)
                if not url or "duckduckgo.com" in url or url in seen_urls:
                    continue

                snippet = ""
                snippets = article.find_elements(By.CSS_SELECTOR, DUCK_SNIPPET_SELECTOR)
                if snippets:
                    snippet = (snippets[0].text or "").strip()

                seen_urls.add(url)
                results.append(
                    SearchResult(
                        title=(title or url)[:200],
                        url=url,
                        snippet=snippet[:500],
                        position=len(results) + 1,
                    )
                )
            except Exception:  # noqa: BLE001
                continue
        return results


# -----------------------------------------------------------------------
# Ecosia Searcher (Folia - Selenium)
# -----------------------------------------------------------------------

class EcosiaSearcher(BaseSearcher):
    """Ecosia search via Chrome headless with CDP user-agent override (Folia pattern)."""

    name = "ecosia"

    def __init__(self, headless: bool = True, results_per_query: int = 10):
        self.headless = headless
        self.results_per_query = results_per_query
        self._driver: Optional[webdriver.Chrome] = None
        self._blocked = _load_circuit_breaker_state(self.name)
        self._failures = 0

    def _create_driver(self) -> webdriver.Chrome:
        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--lang=fr-FR")
        options.add_argument(f"user-agent={random.choice(USER_AGENTS_FOLIA)}")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        chrome_bin = _get_env("CHROME_BIN", "").strip()
        if chrome_bin:
            options.binary_location = chrome_bin

        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(HTTP_TIMEOUT_FOLIA)
        driver.execute_cdp_cmd(
            "Network.setUserAgentOverride",
            {"userAgent": random.choice(USER_AGENTS_FOLIA)},
        )
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        return driver

    def _ensure_driver(self) -> None:
        if self._driver is None:
            log.debug("Création du driver Chrome (Ecosia)...")
            self._driver = self._create_driver()

    def close(self) -> None:
        if self._driver is not None:
            try:
                self._driver.quit()
            except Exception:  # noqa: BLE001
                pass
            self._driver = None

    def search(self, query: str, num_results: Optional[int] = None, lang: str = "fr") -> List[SearchResult]:
        if self._blocked:
            log.debug("Ecosia bloqué précédemment : recherche ignorée")
            return []

        self._ensure_driver()
        num_results = num_results or self.results_per_query
        url = f"{ECOSIA_URL}?q={quote_plus(query)}"
        log.info(f"🔎 Ecosia: {query}")

        try:
            self._driver.get(url)
            WebDriverWait(self._driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ECOSIA_RESULT_SELECTOR))
            )
            smart_delay(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX)
        except Exception as exc:  # noqa: BLE001
            body = ""
            try:
                body = self._driver.find_element(By.TAG_NAME, "body").text
            except Exception:  # noqa: BLE001
                pass
            low_body = body.lower()
            if "ecosia firewall" in low_body or "captcha" in low_body:
                self._blocked = True
                _save_circuit_breaker_state(self.name, True)
                log.warning("Ecosia affiche un firewall : moteur ignoré pour ce run")
            else:
                self._failures += 1
                if self._failures >= MAX_LOAD_FAILURES_FOLIA:
                    self._blocked = True
                    _save_circuit_breaker_state(self.name, True)
                log.warning(f"Ecosia: aucun résultat chargeable ({exc})")
            return []

        results = self._extract_results(num_results)
        self._failures = 0
        log.debug(f"{len(results)} résultats Ecosia extraits")
        smart_delay(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX)
        return results

    def _extract_results(self, num_results: int) -> List[SearchResult]:
        results: List[SearchResult] = []
        seen_urls = set()

        try:
            articles = self._driver.find_elements(By.CSS_SELECTOR, ECOSIA_RESULT_SELECTOR)
        except Exception:  # noqa: BLE001
            return results

        for article in articles:
            if len(results) >= num_results:
                break
            try:
                title = (article.get_attribute("aria-label") or "").strip()
                link = article.find_element(By.CSS_SELECTOR, ECOSIA_LINK_SELECTOR)
                href = (link.get_attribute("href") or "").strip()
                if not href or "ecosia.org" in href or href in seen_urls:
                    continue
                snippet = (article.text or "").strip()[:500]
                seen_urls.add(href)
                results.append(
                    SearchResult(
                        title=(title or href)[:200],
                        url=href,
                        snippet=snippet,
                        position=len(results) + 1,
                    )
                )
            except Exception:  # noqa: BLE001
                continue
        return results


# -----------------------------------------------------------------------
# Bing Searcher (Omnysync - requests)
# -----------------------------------------------------------------------

class BingSearcher(BaseSearcher):
    """Bing search via requests + BeautifulSoup (Omnysync pattern)."""

    name = "bing"

    def __init__(self, proxy: Optional[str] = None) -> None:
        self._session = requests.Session()
        if proxy:
            self._session.proxies = {"http": proxy, "https": proxy}
        self._blocked = _load_circuit_breaker_state(self.name)
        self._failures = 0

    def search(
        self, query: str, num_results: int = 10, lang: str = "fr"
    ) -> List[SearchResult]:
        if self._blocked:
            log.debug("Bing bloqué précédemment : requête ignorée")
            return []
        params = {
            "q": query,
            "count": num_results,
            "setlang": "fr" if lang.startswith("fr") else "en-US",
            "cc": "FR" if lang.startswith("fr") else "US",
        }
        log.info(f"🔎 Bing: {query}")
        try:
            resp = self._session.get(
                BING_URL,
                params=params,
                headers=_headers_omni(lang),
                timeout=HTTP_TIMEOUT_OMNI,
            )
        except requests.RequestException as exc:
            self._register_failure(f"réseau: {exc}")
            return []

        text = resp.text or ""
        low = text.lower()
        if resp.status_code in (403, 429) or "captcha" in low or "unusual traffic" in low:
            self._register_failure(f"HTTP {resp.status_code} / challenge")
            return []
        if "aucun résultat pour" in low or "there are no results for" in low:
            # Soft-block: Bing claims no results even for common queries
            self._register_failure("aucun résultat (soft-block probable)")
            return []

        results = self._parse(text, num_results)
        if not results:
            log.warning("Bing: aucun résultat (structure changée ou blocage)")
        _smart_delay_omni()
        return results

    def _parse(self, html: str, num_results: int) -> List[SearchResult]:
        soup = BeautifulSoup(html, "html.parser")
        results: List[SearchResult] = []
        seen = set()
        for li in soup.select("li.b_algo"):
            link = li.select_one("h2 a")
            if not link:
                continue
            url = _decode_bing_url(link.get("href", ""))
            if not url or url in seen:
                continue
            if not url.startswith(("http://", "https://")):
                continue
            title = link.get_text(" ", strip=True)
            snippet_el = li.select_one(".b_caption p") or li.select_one("p")
            snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
            seen.add(url)
            results.append(
                SearchResult(
                    title=title[:200],
                    url=url,
                    snippet=snippet[:500],
                    position=len(results) + 1,
                )
            )
            if len(results) >= num_results:
                break
        return results

    def _register_failure(self, reason: str) -> None:
        self._failures += 1
        log.warning(f"Bing: {reason}")
        if self._failures >= MAX_CONSECUTIVE_FAILURES_OMNI:
            self._blocked = True
            _save_circuit_breaker_state(self.name, True)
            log.warning("Bing: circuit breaker activé pour ce run")


# -----------------------------------------------------------------------
# Brave Searcher (Omnysync - API)
# -----------------------------------------------------------------------

class BraveSearcher(BaseSearcher):
    """Brave Search API (requires BRAVE_SEARCH_API_KEY)."""

    name = "brave"

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = (api_key or _get_env("BRAVE_SEARCH_API_KEY") or "").strip()
        self._blocked = _load_circuit_breaker_state(self.name)
        self._failures = 0

    def search(
        self, query: str, num_results: int = 10, lang: str = "fr"
    ) -> List[SearchResult]:
        if self._blocked:
            log.debug("Brave bloqué précédemment : requête ignorée")
            return []
        if not self._api_key:
            log.debug("Brave: BRAVE_SEARCH_API_KEY non configurée")
            self._blocked = True
            return []

        count = max(1, min(int(num_results or 10), 20))
        params = {
            "q": query,
            "count": count,
            "country": "FR" if lang.startswith("fr") else "US",
            "search_lang": "fr" if lang.startswith("fr") else "en",
            "safesearch": "off",
            "text_decorations": "false",
        }
        headers = {
            "Accept": "application/json",
            "X-Subscription-Token": self._api_key,
            "User-Agent": random.choice(USER_AGENTS_OMNI),
        }
        log.info(f"🔎 Brave: {query}")
        try:
            resp = requests.get(
                BRAVE_API_URL, params=params, headers=headers, timeout=HTTP_TIMEOUT_OMNI
            )
        except requests.RequestException as exc:
            self._register_failure(f"réseau: {exc}")
            return []

        if resp.status_code in (401, 403):
            self._register_failure(f"HTTP {resp.status_code} (clé invalide/bloquée)")
            return []
        if resp.status_code == 429:
            self._register_failure("HTTP 429 (quota atteint)")
            return []
        if resp.status_code >= 400:
            self._register_failure(f"HTTP {resp.status_code}")
            return []

        try:
            payload = resp.json()
        except ValueError:
            self._register_failure("réponse JSON invalide")
            return []

        results: List[SearchResult] = []
        seen = set()
        web = payload.get("web") or {}
        for item in web.get("results") or []:
            url = (item.get("url") or "").strip()
            if not url or url in seen:
                continue
            if not url.startswith(("http://", "https://")):
                continue
            seen.add(url)
            results.append(
                SearchResult(
                    title=(item.get("title") or "")[:200],
                    url=url,
                    snippet=(item.get("description") or "")[:500],
                    position=len(results) + 1,
                )
            )
            if len(results) >= count:
                break

        if not results:
            log.warning("Brave: aucun résultat")
        _smart_delay_omni()
        return results

    def _register_failure(self, reason: str) -> None:
        self._failures += 1
        log.warning(f"Brave: {reason}")
        if self._failures >= MAX_CONSECUTIVE_FAILURES_OMNI:
            self._blocked = True
            _save_circuit_breaker_state(self.name, True)
            log.warning("Brave: circuit breaker activé pour ce run")


# -----------------------------------------------------------------------
# Google Searcher (Unified Package - Selenium with built-in DuckDuckGo fallback)
# -----------------------------------------------------------------------

class GoogleSearcher(BaseSearcher):
    """Google search via Selenium - wrapper around unified package's GoogleSearcher."""

    name = "google"

    def __init__(self, headless: bool = True, results_per_query: int = 10) -> None:
        self._searcher = _GoogleSearcher(headless=headless, results_per_query=results_per_query)

    def search(
        self, query: str, num_results: int = 10, lang: str = "fr"
    ) -> List[SearchResult]:
        # The unified GoogleSearcher.search() takes (query, num_results) and has built-in DDG fallback
        return self._searcher.search(query, num_results=num_results)

    def close(self) -> None:
        self._searcher.close()


# -----------------------------------------------------------------------
# Fallback Searcher
# -----------------------------------------------------------------------

class FallbackSearcher(BaseSearcher):
    """Tries multiple search backends in order until one returns results.

    Default order (matching Folia): DuckDuckGo → Ecosia → Google → Bing
    Configurable via SEARCH_PROVIDER and SEARCH_FALLBACK env vars (Omnysync pattern).
    """

    name = "fallback"

    def __init__(self, searchers: Optional[List[BaseSearcher]] = None):
        if searchers is not None:
            self.searchers = searchers
        else:
            # Build from environment
            self.searchers = self._build_from_env()

    def _build_from_env(self) -> List[BaseSearcher]:
        providers = [
            p.strip()
            for p in (_get_env("SEARCH_PROVIDER", "duckduckgo") or "").split(",")
            if p.strip()
        ]
        fallback = (_get_env("SEARCH_FALLBACK", "") or "").strip()
        if fallback and fallback.lower() not in [p.lower() for p in providers]:
            providers.append(fallback)

        # When Selenium is disabled and no explicit providers configured,
        # default to Bing (requests-only) instead of DuckDuckGo.
        if not providers and not USE_SELENIUM:
            providers = ["bing"]

        searchers: List[BaseSearcher] = []
        for p in providers:
            searcher = _build_searcher(p)
            if searcher:
                searchers.append(searcher)

        if not searchers:
            if USE_SELENIUM:
                log.warning("Aucun backend de recherche valide, repli sur DuckDuckGo")
                searchers = [DuckSearcher()]
            else:
                log.warning("Aucun backend de recherche valide, repli sur Bing (requests-only)")
                searchers = [BingSearcher()]

        return searchers

    def search(
        self, query: str, num_results: int = 10, lang: str = "fr"
    ) -> List[SearchResult]:
        for searcher in self.searchers:
            try:
                results = searcher.search(query, num_results=num_results, lang=lang)
            except Exception as exc:  # noqa: BLE001
                log.warning(f"{searcher.name}: erreur {exc}")
                continue
            if results:
                log.debug(f"Résultats trouvés via {searcher.name}")
                return results
        log.warning("Tous les moteurs de recherche ont échoué")
        return []

    def close(self) -> None:
        for searcher in self.searchers:
            try:
                searcher.close()
            except Exception:  # noqa: BLE001
                pass


# -----------------------------------------------------------------------
# Factory function
# -----------------------------------------------------------------------

def _build_searcher(name: str) -> Optional[BaseSearcher]:
    """Instantiate a searcher by name."""
    name = (name or "").strip().lower()
    if name in ("duckduckgo", "ddg", "duck"):
        if not USE_SELENIUM:
            log.info("Selenium désactivé (USE_SELENIUM=false) : DuckDuckGo ignoré")
            return None
        return DuckSearcher()
    if name == "ecosia":
        if not USE_SELENIUM:
            log.info("Selenium désactivé (USE_SELENIUM=false) : Ecosia ignoré")
            return None
        return EcosiaSearcher()
    if name == "bing":
        return BingSearcher()
    if name == "brave":
        if not (_get_env("BRAVE_SEARCH_API_KEY") or "").strip():
            log.debug("Brave ignoré : BRAVE_SEARCH_API_KEY absente")
            return None
        return BraveSearcher()
    if name == "google":
        if not USE_SELENIUM:
            log.info("Selenium désactivé (USE_SELENIUM=false) : Google ignoré")
            return None
        return GoogleSearcher()
    if name in ("none", "off", "disabled"):
        return None
    log.warning(f"SEARCH_PROVIDER inconnu : {name!r} (ignoré)")
    return None


def get_searcher(provider: Optional[str] = None) -> BaseSearcher:
    """Factory function returning a configured searcher.
    
    Reads SEARCH_PROVIDER (comma-separated) and SEARCH_FALLBACK env vars.
    If provider is passed explicitly, it overrides SEARCH_PROVIDER.
    """
    if provider is not None:
        searcher = _build_searcher(provider)
        if searcher is not None:
            return searcher
        log.warning(f"Provider explicite invalide ({provider!r}), repli sur env")

    # Build from environment (Omnysync pattern)
    providers = [
        p.strip()
        for p in (_get_env("SEARCH_PROVIDER", "duckduckgo") or "").split(",")
        if p.strip()
    ]
    fallback = (_get_env("SEARCH_FALLBACK", "") or "").strip()
    if fallback and fallback.lower() not in [p.lower() for p in providers]:
        providers.append(fallback)

    searchers = [s for s in (_build_searcher(p) for p in providers) if s]
    if not searchers:
        log.warning("Aucun backend de recherche valide, repli sur Bing (requests-only)")
        searchers = [BingSearcher()]

    if len(searchers) == 1:
        return searchers[0]

    log.info(f"Recherche: {' → '.join(s.name for s in searchers)} (fallback)")
    return FallbackSearcher(searchers)


# -----------------------------------------------------------------------
# Exports
# -----------------------------------------------------------------------

__all__ = [
    "BaseSearcher",
    "DuckSearcher",
    "EcosiaSearcher",
    "BingSearcher",
    "BraveSearcher",
    "GoogleSearcher",
    "FallbackSearcher",
    "get_searcher",
    "SearchResult",
]