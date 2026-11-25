"""Consolidated crawl utilities for web scraping and text extraction.

Adapted from SiteAudit/shared/crawl.py, extract_text.py, and web.py.
Provides HTTP GET with retry, HTML-to-text extraction, and BFS site crawling.
"""

import re
import time
import urllib.error
import urllib.request
from collections import deque
from html import unescape as html_unescape
from pathlib import Path
from typing import List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse, urlsplit, urlunsplit

from src.utils import log


# ============================================================================
# HTTP UTILITIES (from web.py)
# ============================================================================

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# Retry configuration
RETRYABLE_CODES = {429, 500, 502, 503, 504}
BACKOFF_S = [2, 5, 10]


def _sniff_charset(raw: bytes) -> str:
    """Detect charset from meta tag (for pages without charset in header).

    Many French sites serve ISO-8859-1 without declaring it in the header.
    """
    m = re.search(rb'(?i)charset\s*=\s*["\']?\s*([\w\-]+)', raw[:4096])
    return m.group(1).decode("ascii", errors="ignore") if m else "utf-8"


def http_get(url: str, timeout: int = 30) -> Tuple[str, str, str]:
    """GET HTTP -> (decoded_text, content_type, final_url)."""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        ctype = resp.headers.get("Content-Type", "") or ""
        m = re.search(r"charset=([\w\-]+)", ctype)
        charset = m.group(1) if m else _sniff_charset(raw)
        try:
            text = raw.decode(charset, errors="replace")
        except LookupError:
            text = raw.decode("utf-8", errors="replace")
        return text, ctype, resp.geturl()


def _retry_after(e: urllib.error.HTTPError, fallback: float) -> float:
    """Extract Retry-After header value or fallback."""
    try:
        v = e.headers.get("Retry-After") if e.headers else None
        return max(float(v), fallback)
    except (TypeError, ValueError):
        return fallback


def get_with_retry(url: str) -> Tuple[str, str, str]:
    """http_get with backoff on 429/5xx.

    Returns (html, ctype, final_url) or raises last exception.
    """
    last_exc = None
    for attempt in range(len(BACKOFF_S) + 1):
        try:
            return http_get(url)
        except urllib.error.HTTPError as e:
            if e.code not in RETRYABLE_CODES:
                raise
            last_exc = e
            if attempt < len(BACKOFF_S):
                wait = _retry_after(e, BACKOFF_S[attempt])
                log.debug(
                    f"  HTTP {e.code} sur {url} -> retry in {wait:.0f}s ({attempt+1}/{len(BACKOFF_S)})"
                )
                time.sleep(wait)
        except Exception:
            raise
    raise last_exc


# ============================================================================
# URL NORMALIZATION (from crawl.py)
# ============================================================================

SKIP_EXT = re.compile(
    r"\.(pdf|jpe?g|png|gif|svg|webp|ico|css|js|mjs|json|xml|zip|rar|7z|mp4|mp3"
    r"|woff2?|ttf|eot|docx?|xlsx?|pptx?|txt)(\?.*)?$", re.I)
SKIP_PATH = re.compile(r"(change-locale|change-currency|logout|/cart|newsletter"
                       r"|wp-json|/feed|cdn-cgi/)", re.I)
RE_HREF = re.compile(r'href="([^"#]+)"')
RE_LANG = re.compile(r"//[^/]+/([a-z]{2})(/|$)")
RE_PAGE_QS = re.compile(r"page=\d+")


def normalize_url(base_url: str, link: str) -> Optional[str]:
    """Absolutize a link; keep only ?page=N as query."""
    if not link:
        return None
    link = link.split("#", 1)[0].strip()
    if not link:
        return None
    absu = urljoin(base_url, link)
    try:
        s = urlsplit(absu)
    except ValueError:
        return None
    if s.scheme not in ("http", "https") or not s.netloc:
        return None
    path = s.path
    if path and path != "/":
        path = path.rstrip("/")
    query = s.query if RE_PAGE_QS.fullmatch(s.query) else ""
    return urlunsplit((s.scheme, s.netloc.lower(), path, query, ""))


# ============================================================================
# HTML TO TEXT EXTRACTION (from extract_text.py)
# ============================================================================

RE_SCRIPT = re.compile(r"(?is)<script\b.*?</script>")
RE_STYLE = re.compile(r"(?is)<style\b.*?</style>")
RE_COMMENT = re.compile(r"<!--.*?-->", re.S)
RE_NOSCRIPT = re.compile(r"(?is)<noscript\b.*?</noscript>")
BLOCK_TAGS = ("p|div|h[1-6]|li|tr|section|article|header|footer|ul|ol|table|label"
              r"|button|select|form|hr|figcaption|dl|dd|dt|nav")
RE_CLOSE_BLOCK = re.compile(r"(?i)</(" + BLOCK_TAGS + r")\s*>")
RE_BR = re.compile(r"(?i)<br\s*/?>")
RE_TITLE = re.compile(r"(?is)<title[^>]*>(.*?)</title>")
RE_TAG = re.compile(r"<[^>]+>")
# NB: regex SENSITIVE to case; \xa0 = non-breaking space, \u200b = zero-width space
RE_SPACES = re.compile(r"[ \t\r\f\xa0\u200b]+")
RE_LEAD_WS = re.compile(r"(?m)^\s+")
RE_MULTI_NL = re.compile(r"\n{2,}")
RE_HEADER_BLOCK = re.compile(r"(?is)<header\b.*?</header>")
RE_FOOTER_BLOCK = re.compile(r"(?is)<footer\b.*?</footer>")


def html_to_text(html: str) -> str:
    """Extract visible text from HTML content."""
    html = RE_SCRIPT.sub(" ", html)
    html = RE_STYLE.sub(" ", html)
    html = RE_COMMENT.sub(" ", html)
    html = RE_NOSCRIPT.sub(" ", html)
    html = RE_CLOSE_BLOCK.sub("\n", html)
    html = RE_BR.sub("\n", html)
    html = RE_TITLE.sub(lambda m: "\n[TITLE] %s [/TITLE]\n" % m.group(1), html)
    html = RE_TAG.sub(" ", html)
    html = html_unescape(html)
    html = RE_SPACES.sub(" ", html)
    html = RE_LEAD_WS.sub("", html)
    html = RE_MULTI_NL.sub("\n", html)
    return html.strip()


def extract_main_text(page_html: str) -> str:
    """Extract main text excluding header/footer if both present."""
    main_html = page_html
    ih, ifoot = page_html.find("</header>"), page_html.find("<footer")
    if ih >= 0 and ifoot > ih:
        main_html = page_html[ih + len("</header>"):ifoot]
    return html_to_text(main_html)


# ============================================================================
# BFS SITE CRAWLER (from crawl.py)
# ============================================================================

SITEMAP_MAX_LOCS = 5000
SITEMAP_MAX_ADD = 1000
SITEMAP_INDEX_CHILDREN = 5
RE_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)

# Legal probe paths
LEGAL_PROBE_PATHS = [
    "/mentions-legales", "/legal", "/legal-notices", "/mentions-legales.html",
    "/contact", "/nous-contacter", "/cgv", "/conditions-generales-de-vente",
]
LEGAL_PROBE_MAX_OK = 6
LEGAL_HINT = re.compile(r"mention|legal|cgv|condition|contact", re.I)


def parse_sitemap(xml_text: str) -> List[str]:
    """List <loc> entries from a sitemap / sitemapindex file."""
    return [u.strip() for u in RE_LOC.findall(xml_text)]


def discover_sitemap_urls(start: str, host: str, seen: set) -> List[str]:
    """Discover candidate URLs via robots.txt + sitemap.xml (1 level of index).

    Returns list of normalized URLs, deduplicated via seen (added inside).
    """
    parts = urlsplit(start)
    origin = urlunsplit((parts.scheme, parts.netloc, "/", "", ""))
    sm_files = []  # sitemap files to read (deduplicated)
    sm_seen = {origin + "robots.txt"}
    try:
        txt, ctype, _ = get_with_retry(origin + "robots.txt")
        if ctype and "text/html" in ctype.lower():
            txt = ""  # error page, not robots.txt
        for line in txt.splitlines():
            if line.lower().startswith("sitemap:"):
                u = line.split(":", 1)[1].strip()
                if u and u not in sm_seen:
                    sm_seen.add(u)
                    sm_files.append(u)
    except Exception:  # noqa: BLE001
        pass
    sm_files.append(origin + "sitemap.xml")

    added = []
    parsed_total = 0
    for sm_url in sm_files[:1 + SITEMAP_INDEX_CHILDREN]:
        if len(added) >= SITEMAP_MAX_ADD or parsed_total >= SITEMAP_MAX_LOCS:
            break
        try:
            xml, ctype, _ = get_with_retry(sm_url)
        except Exception:  # noqa: BLE001
            continue
        locs = parse_sitemap(xml)
        parsed_total += len(locs)
        if "<sitemapindex" in xml.lower():
            # single level: read children listed, no recursion
            children = [u for u in locs if u not in sm_seen][:SITEMAP_INDEX_CHILDREN]
            for child in children:
                sm_seen.add(child)
                try:
                    xml2, _, _ = get_with_retry(child)
                except Exception:  # noqa: BLE001
                    continue
                for u in parse_sitemap(xml2):
                    parsed_total += 1
                    nu = normalize_url(sm_url, u)
                    if nu and nu not in seen and not SKIP_EXT.search(nu) \
                            and not SKIP_PATH.search(nu) \
                            and urlsplit(nu).netloc == host:
                        seen.add(nu)
                        added.append(nu)
            continue
        for u in locs:
            if parsed_total > SITEMAP_MAX_LOCS or len(added) >= SITEMAP_MAX_ADD:
                break
            nu = normalize_url(sm_url, u)
            if nu and nu not in seen and not SKIP_EXT.search(nu) \
                    and not SKIP_PATH.search(nu) \
                    and urlsplit(nu).netloc == host:
                seen.add(nu)
                added.append(nu)
    return added


def probe_legal_pages(origin: str, host: str, seen: set,
                      delay_ms: int = 150) -> List[Tuple[str, str, str]]:
    """Fallback: download classic legal/contact paths.

    Returns list of (html, url, lang) tuples for pages actually added.
    """
    ok = 0
    results: List[Tuple[str, str, str]] = []
    for path in LEGAL_PROBE_PATHS:
        if ok >= LEGAL_PROBE_MAX_OK:
            break
        cand = normalize_url(origin, origin.rstrip("/") + path)
        if not cand or cand in seen or urlsplit(cand).netloc != host:
            continue
        seen.add(cand)
        try:
            html_txt, ctype, final_url = get_with_retry(cand)
        except Exception as e:  # noqa: BLE001
            log.debug(f"PROBE FAIL {cand} - {e}")
            continue
        if ctype and "text/html" not in ctype.lower():
            continue
        ok += 1
        mlang = RE_LANG.search(final_url or cand)
        lang = mlang.group(1) if mlang else "default"
        results.append((html_txt, final_url or cand, lang))
        log.debug(f"PROBE OK {final_url or cand}")
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)
    return results


def purge_crawl_dir(out_dir: Path) -> int:
    """Remove artifacts from previous crawl. Returns count of files removed."""
    removed = 0
    for pat in ("page-*.html", "manifest.tsv", "failed.txt", "crawl-summary.json"):
        for f in out_dir.glob(pat):
            try:
                f.unlink()
                removed += 1
            except OSError:
                pass
    return removed


def crawl_site(
    start_url: str,
    max_pages: int = 150,
    delay_ms: int = 150,
    out_dir: Optional[str] = None,
) -> List[Tuple[str, str, str]]:
    """BFS crawl of a site starting from start_url.

    Returns list of (html_content, url, lang) tuples.
    If out_dir is provided, saves pages as page-NNN.html and manifest.tsv.
    """
    start = normalize_url(start_url, start_url)
    if not start:
        log.warning(f"URL invalide: {start_url}")
        return []

    host = urlsplit(start).netloc
    queue = deque([start])
    seen: Set[str] = {start}

    # Sitemap: server URLs injected at head of queue (BFS href doesn't see JS-rendered links)
    sitemap_urls = discover_sitemap_urls(start, host, seen)
    if sitemap_urls:
        log.info(f"Sitemap: {len(sitemap_urls)} URL(s) added to queue")
        queue.extend(sitemap_urls)

    pages: List[Tuple[str, str, str]] = []
    failed = []
    blocked = 0
    n = 0

    out_path = Path(out_dir) if out_dir else None
    if out_path:
        out_path.mkdir(parents=True, exist_ok=True)

    while queue and n < max_pages:
        url = queue.popleft()
        if SKIP_PATH.search(url):
            continue
        try:
            html, ctype, final_url = get_with_retry(url)
        except urllib.error.HTTPError as e:
            if e.code in RETRYABLE_CODES:
                blocked += 1
            failed.append(url)
            log.debug(f"FAIL {url} - {e}")
            continue
        except Exception as e:  # noqa: BLE001
            failed.append(url)
            log.debug(f"FAIL {url} - {e}")
            continue
        if ctype and "text/html" not in ctype.lower():
            continue

        n += 1
        mlang = RE_LANG.search(final_url or url)
        lang = mlang.group(1) if mlang else "default"
        pages.append((html, final_url or url, lang))

        if out_path:
            fname = "page-%03d.html" % n
            (out_path / fname).write_text(html, encoding="utf-8")

        log.debug(f"OK [{n}/{max_pages}] {final_url or url}")

        for m in RE_HREF.finditer(html):
            nu = normalize_url(final_url or url, m.group(1))
            if not nu or nu in seen:
                continue
            if urlsplit(nu).netloc != host:
                continue
            if SKIP_EXT.search(nu) or SKIP_PATH.search(nu):
                continue
            seen.add(nu)
            queue.append(nu)

        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)

    # Legal probe if no legal/contact pages found
    probed = 0
    manifest_urls = [url for _, url, _ in pages]
    if n > 0 and not any(LEGAL_HINT.search(u) for u in manifest_urls):
        origin = urlunsplit((urlsplit(start).scheme, urlsplit(start).netloc, "/", "", ""))
        log.info("No legal/contact page in crawl -> probing directly...")
        probed_pages = probe_legal_pages(origin, host, seen, delay_ms)
        pages.extend(probed_pages)
        probed = len(probed_pages)

    if out_path:
        manifest_lines = [f"page-{i:03d}.html\t{url}\t{lang}" for i, (_, url, lang) in enumerate(pages, 1)]
        (out_path / "manifest.tsv").write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")
        if failed:
            (out_path / "failed.txt").write_text("\n".join(failed) + "\n", encoding="utf-8")

    log.info(f"Done: {n} pages downloaded" + (f" -> {out_dir}" if out_dir else ""))
    return pages


__all__ = [
    # HTTP
    "http_get",
    "get_with_retry",
    # URL
    "normalize_url",
    # Text extraction
    "html_to_text",
    "extract_main_text",
    # Sitemap
    "parse_sitemap",
    "discover_sitemap_urls",
    "probe_legal_pages",
    "purge_crawl_dir",
    # Crawler
    "crawl_site",
    # Constants
    "UA",
    "RETRYABLE_CODES",
    "BACKOFF_S",
    "SKIP_EXT",
    "SKIP_PATH",
    "LEGAL_PROBE_PATHS",
]