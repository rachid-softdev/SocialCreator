"""Google SERP discovery via Selenium with DuckDuckGo fallback."""

import random
import re
import time
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from src.prospecting_types import SearchResult
from src.utils import log, smart_delay

PAGE_LOAD_TIMEOUT = 20
MAX_LOAD_FAILURES = 2

# Configurable delays between requests (avoid rate limiting)
REQUEST_DELAY_MIN = float(__import__("os").environ.get("GOOGLE_REQUEST_DELAY_MIN", "1.5"))
REQUEST_DELAY_MAX = float(__import__("os").environ.get("GOOGLE_REQUEST_DELAY_MAX", "4.0"))

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

NOISE_DOMAINS = (
    "google.", "youtube.com", "gstatic.", "accounts.google",
    "maps.google", "support.google", "policies.google",
    "webcache.googleusercontent", "cal.com", "calendly.com",
    "savvycal.com", "doodle.com", "zoom.us", "meet.google.com",
    "teams.microsoft.com", "wa.me", "api.whatsapp.com", "t.me",
    "linktr.ee", "bit.ly", "tinyurl.com", "goo.gl", "forms.gle",
    "docs.google.com", "drive.google.com", "notion.so", "notion.site",
    "airtable.com", "typeform.com", "hubspot.com", "klaviyo.com",
    "mailchimp.com", "salesforce.com", "pipedrive.com", "zapier.com",
    "make.com", "n8n.io", "openai.com", "anthropic.com",
)

# Consent / cookie banner indicators (EU GDPR consent pages)
CONSENT_KEYWORDS = (
    "before you continue",
    "consent",
    "cookie",
    "privacy",
    "accept all",
    "reject all",
    "settings",
    "manage preferences",
)


@dataclass
class GoogleSearcher:
    """Searches Google via Selenium with DuckDuckGo fallback and anti-blocking."""

    headless: bool = True
    results_per_query: int = 10
    _driver: Optional[webdriver.Chrome] = field(default=None, init=False, repr=False)
    _blocked: bool = field(default=False, init=False, repr=False)
    _failures: int = field(default=0, init=False, repr=False)
    _ddg_blocked: bool = field(default=False, init=False, repr=False)
    _ddg_failures: int = field(default=0, init=False, repr=False)

    def _create_driver(self) -> webdriver.Chrome:
        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--lang=fr-FR")
        options.add_argument(f"user-agent={random.choice(USER_AGENTS)}")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
        driver.execute_cdp_cmd("Network.setUserAgentOverride", {"userAgent": random.choice(USER_AGENTS)})
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver

    def _ensure_driver(self):
        if self._driver is None:
            log.debug("Création du driver Chrome...")
            self._driver = self._create_driver()

    def close(self) -> None:
        if self._driver is not None:
            try:
                self._driver.quit()
            except Exception:  # noqa: BLE001
                pass
            self._driver = None

    def __enter__(self) -> "GoogleSearcher":
        self._ensure_driver()
        return self

    def __exit__(self, *args) -> None:
        self.close()

    def search(self, query: str, num_results: Optional[int] = None) -> List[SearchResult]:
        """Search Google, then DuckDuckGo as fallback if Google is blocked."""
        num_results = num_results or self.results_per_query
        if not self._blocked:
            try:
                results = self._google_search(query, num_results)
                if results:
                    return results
                log.debug("Google n'a retourné aucun résultat, repli DuckDuckGo")
            except Exception as e:  # noqa: BLE001
                log.warning(f"Google indisponible ({e}), repli DuckDuckGo")
        return self._duckduckgo_search(query, num_results)

    def _google_search(self, query: str, num_results: int) -> List[SearchResult]:
        if self._blocked:
            log.debug("Google bloque precedemment : recherche ignoree")
            return []
        try:
            self._ensure_driver()
        except Exception as e:  # noqa: BLE001
            self._failures += 1
            self._blocked = True
            log.warning(f"Chrome/Google indisponible ({e}) : repli DuckDuckGo")
            return []
        url = f"https://www.google.com/search?q={quote_plus(query)}&hl=fr&num={num_results}"
        log.info(f"Google: {query}")
        start = time.time()
        try:
            self._driver.get(url)
            WebDriverWait(self._driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            # Handle EU cookie consent pages before extracting results
            self._dismiss_consent_banner()

            smart_delay(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX)
        except Exception as e:  # noqa: BLE001
            self._failures += 1
            if self._failures >= MAX_LOAD_FAILURES:
                self._blocked = True
                log.warning("Google bloque l'IP : circuit breaker ON")
            log.error(f"Erreur chargement Google: {e}")
            return []

        # Check if we landed on a consent/challenge page instead of results
        body_text = ""
        try:
            body_text = self._driver.find_element(By.TAG_NAME, "body").text
        except Exception:  # noqa: BLE001
            pass
        low_body = body_text.lower()
        if any(k in low_body for k in ("unusual traffic", "verify you are human", "robot")):
            self._failures += 1
            if self._failures >= MAX_LOAD_FAILURES:
                self._blocked = True
            log.warning(f"Google page de défi détectée: {body_text[:80]}...")
            return []

        results = self._extract_results(num_results)
        return results

    def _dismiss_consent_banner(self) -> None:
        """Attempt to dismiss EU cookie / consent overlays that block SERP results."""
        consent_selectors = [
            "//button[contains(., 'Accepter tout') or contains(., 'Accept all')]",
            "//button[contains(., 'J\'accepte') or contains(., 'Je accepte')]",
            "//button[contains(., 'Tout accepter')]",
            "//button[contains(., 'Accepter les cookies')]",
            "//button[contains(@id, 'L2AGLb')]",  # Google's "I agree" button
            "//div[contains(@id, 'cnswb')]//button",  # Consent banner wrapper
            "//button[contains(., 'Continuer') or contains(., 'Continue')]",
        ]
        for selector in consent_selectors:
            try:
                buttons = self._driver.find_elements(By.XPATH, selector)
                for btn in buttons:
                    if btn.is_displayed() and btn.is_enabled():
                        btn.click()
                        smart_delay(0.5, 1.0)
                        return
            except Exception:  # noqa: BLE001
                continue

    def _duckduckgo_search(self, query: str, num_results: int) -> List[SearchResult]:
        if self._ddg_blocked:
            log.debug("DuckDuckGo bloque precedemment : recherche ignoree")
            return []
        url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        }
        log.info(f"DuckDuckGo: {query}")
        try:
            resp = requests.get(url, params={"q": query, "kl": "fr-fr"}, headers=headers, timeout=20)
            # HTTP 202 signals a challenge page (not real results) - treat as block
            if resp.status_code == 202:
                self._ddg_failures += 1
                if self._ddg_failures >= MAX_LOAD_FAILURES:
                    self._ddg_blocked = True
                    log.warning("DuckDuckGo renvoie HTTP 202 (challenge) : circuit breaker ON")
                return []
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")

            # Detect challenge page in body even on 200
            low_text = (resp.text or "").lower()
            if any(k in low_text for k in ("bots use duckduckgo too", "select all squares",
                                            "captcha", "anomaly", "challenge")):
                self._ddg_failures += 1
                if self._ddg_failures >= MAX_LOAD_FAILURES:
                    self._ddg_blocked = True
                    log.warning("DuckDuckGo affiche un challenge : circuit breaker ON")
                return []

            soup = BeautifulSoup(resp.text, "html.parser")
            blocks = soup.select("div.result")
            if not blocks:
                self._ddg_failures += 1
                if self._ddg_failures >= MAX_LOAD_FAILURES:
                    self._ddg_blocked = True
                    log.warning("DuckDuckGo ne retourne plus de resultats : circuit breaker ON")
                return []
            results: List[SearchResult] = []
            seen_urls = set()
            for block in blocks:
                if len(results) >= num_results:
                    break
                link = block.select_one("a.result__a")
                if not link:
                    continue
                href = link.get("href", "")
                result_url = self._clean_ddg_url(href)
                if not result_url or result_url in seen_urls:
                    continue
                title = link.get_text(" ", strip=True)[:200]
                snippet_el = block.select_one(".result__snippet")
                snippet = (snippet_el.get_text(" ", strip=True)[:500] if snippet_el else "")
                seen_urls.add(result_url)
                results.append(SearchResult(title=title, url=result_url, snippet=snippet, position=len(results) + 1))
            self._ddg_failures = 0
            smart_delay(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX)
            return results
        except Exception as e:  # noqa: BLE001
            self._ddg_failures += 1
            if self._ddg_failures >= MAX_LOAD_FAILURES:
                self._ddg_blocked = True
                log.warning("DuckDuckGo inaccessible : circuit breaker ON")
            log.error(f"Erreur DuckDuckGo: {e}")
            return []

    @staticmethod
    def _clean_ddg_url(href: str) -> Optional[str]:
        if not href or href.startswith("javascript:") or href.startswith("mailto:"):
            return None
        if href.startswith("//"):
            href = "https:" + href
        parsed = urlparse(href)
        if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
            params = parse_qs(parsed.query)
            if "uddg" in params and params["uddg"]:
                return unquote(params["uddg"][0])
        return href

    def _extract_results(self, num_results: int) -> List[SearchResult]:
        """Extract search results using multiple selector strategies for robustness.

        Google SERP structure changes frequently; we try multiple approaches:
        1. Modern div.g result containers with h3 titles
        2. Legacy data-hveid result blocks
        3. Direct anchor links within result containers
        4. Fallback: all links on page (last resort)
        """
        results: List[SearchResult] = []
        seen_urls = set()

        # Strategy 1: Modern Google result containers (div.g with h3)
        try:
            containers = self._driver.find_elements(By.CSS_SELECTOR, "div.g[data-ved]")
            for container in containers:
                if len(results) >= num_results:
                    break
                try:
                    h3 = container.find_element(By.TAG_NAME, "h3")
                    title = (h3.text or "").strip()
                    # Find the main link
                    link = container.find_element(By.CSS_SELECTOR, "a[href]")
                    href = link.get_attribute("href") or ""
                    url = self._clean_google_url(href)
                    if not url or url in seen_urls or self._is_noise(url, title):
                        continue
                    # Try to extract snippet
                    snippet = ""
                    try:
                        snippet_el = container.find_element(By.CSS_SELECTOR, "div.VwiC3b, span.aCOpRe, div.IsZvec")
                        snippet = (snippet_el.text or "").strip()[:500]
                    except Exception:  # noqa: BLE001
                        pass
                    if not title:
                        title = url.split("//", 1)[-1].split("/")[0]
                    seen_urls.add(url)
                    results.append(SearchResult(title=title[:200], url=url, snippet=snippet, position=len(results) + 1))
                except Exception:  # noqa: BLE001
                    continue
        except Exception:  # noqa: BLE001
            pass

        # Strategy 2: Legacy data-hveid result blocks (older SERP layout)
        if not results:
            try:
                blocks = self._driver.find_elements(By.XPATH, "//div[@data-hveid]")
                for block in blocks:
                    if len(results) >= num_results:
                        break
                    try:
                        h3 = block.find_element(By.TAG_NAME, "h3")
                        title = (h3.text or "").strip()
                        cite = block.find_element(By.TAG_NAME, "cite")
                        url = self._url_from_cite(cite.text or cite.get_attribute("innerText") or "")
                        if not url or url in seen_urls or self._is_noise(url, title):
                            continue
                        if not title:
                            title = url.split("//", 1)[-1].split("/")[0]
                        seen_urls.add(url)
                        results.append(SearchResult(title=title[:200], url=url, snippet="", position=len(results) + 1))
                    except Exception:  # noqa: BLE001
                        continue
            except Exception:  # noqa: BLE001
                pass

        # Strategy 3: Any anchor within a result-like container
        if not results:
            try:
                links = self._driver.find_elements(By.CSS_SELECTOR, "div.g a[href], div[data-ved] a[href]")
                for link in links:
                    if len(results) >= num_results:
                        break
                    try:
                        href = link.get_attribute("href") or ""
                        url = self._clean_google_url(href)
                        if not url or url in seen_urls or self._is_noise(url, link.text):
                            continue
                        title = link.text.strip() or url
                        seen_urls.add(url)
                        results.append(SearchResult(title=title[:200], url=url, snippet="", position=len(results) + 1))
                    except Exception:  # noqa: BLE001
                        continue
            except Exception:  # noqa: BLE001
                pass

        # Strategy 4: Last resort - all links on page
        if not results:
            try:
                links = self._driver.find_elements(By.XPATH, "//a[@href]")
                for link in links:
                    if len(results) >= num_results:
                        break
                    try:
                        href = link.get_attribute("href") or ""
                        url = self._clean_google_url(href)
                        if not url or url in seen_urls or self._is_noise(url, link.text):
                            continue
                        title = link.text.strip() or url
                        seen_urls.add(url)
                        results.append(SearchResult(title=title[:200], url=url, snippet="", position=len(results) + 1))
                    except Exception:  # noqa: BLE001
                        continue
            except Exception:  # noqa: BLE001
                pass

        return results

    @staticmethod
    def _url_from_cite(text: str) -> Optional[str]:
        text = (text or "").strip()
        if not text:
            return None
        import re as _re
        match = _re.search(r"https?://[^\s›]+", text)
        if match:
            return match.group(0).rstrip(".,;")
        match = _re.search(r"\b([a-z0-9][a-z0-9.-]+\.[a-z]{2,})\b", text, _re.IGNORECASE)
        if match:
            return f"https://{match.group(1)}"
        return None

    @staticmethod
    def _clean_google_url(href: str) -> Optional[str]:
        if not href or href.startswith(("javascript:", "mailto:", "tel:", "sms:", "data:")):
            return None
        if "/url?q=" in href:
            parsed = parse_qs(urlparse(href).query)
            if "q" in parsed and parsed["q"]:
                href = parsed["q"][0]
        if not href.startswith(("http://", "https://")):
            return None
        return href

    @staticmethod
    def _is_noise(url: str, text: str) -> bool:
        for nd in NOISE_DOMAINS:
            if nd in url:
                return True
        return False
