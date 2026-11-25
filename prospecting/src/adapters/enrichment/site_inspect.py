"""
Site inspection: CMS detection, source tool detection, blog freshness.

Adapted from Omnysync's site_inspect.py and Folia's site_analysis.py.
Provides CMS detection, source tool detection (Google Docs, Notion, Airtable, Contentful),
blog freshness analysis, and inspection scoring for qualification.
"""

import re
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from src.utils import log, normalize_domain

# ============================================================
# CMS SIGNATURES (from Omnysync)
# ============================================================

# CMS signatures: (regex_pattern, cms_name, confidence)
CMS_SIGNATURES = [
    # WordPress
    (r"wp-content|wp-includes|wordpress\.org", "wordpress", 0.9),
    # Shopify
    (r"shopify\.com|Shopify|checkout\.shopify\.com", "shopify", 0.9),
    # Squarespace
    (r"squarespace\.com|Squarespace", "squarespace", 0.85),
    # Wix
    (r"wix\.com|Wix|data-wix-", "wix", 0.8),
    # Webflow
    (r"webflow\.io|Webflow", "webflow", 0.85),
    # Drupal
    (r"sites/default|modules/system|theme\.info", "drupal", 0.8),
    # Joomla
    (r"joomla|com_content|com_contact", "joomla", 0.75),
    # Ghost
    (r"ghost\.org|Ghost|casper", "ghost", 0.8),
    # Shopify (headless/canonical)
    (r"cart\.shopify\.com|checkout\.shopify", "shopify", 0.9),
]

# Strong CMS signatures: higher confidence patterns that strongly indicate a CMS
STRONG_SIGNATURES = [
    (r"wp-content|wp-includes", "wordpress", 0.95),
    (r"Shopify", "shopify", 0.9),
    (r"squarespace\.com", "squarespace", 0.85),
    (r"data-wix-", "wix", 0.8),
    (r"casper|ghost\.org", "ghost", 0.85),
]

# Source tool detection signatures
SOURCE_SIGNATURES = {
    "google_docs": [r"docs\.google\.com", r"g\.docs\.com"],
    "notion": [r"notion\.so|notion\.api", r"integrations/notion"],
    "airtable": [r"airtable\.com|table\.airtable", r"block\.airtable"],
    "contentful": [r"contentful\.com", r"contentful\.io"],
}

# Blog detection hints
BLOG_HINTS = [
    r"/blog|/actuality|/news|/posts|/article",
    r"<a[^>]*>[Bb]log|[Nn]ews|[Pp]osts",
    r"class=\".*blog.*\"|class=\".*news.*\"",
    r"type='blog'|role='blog'| ' Blog' | ' News',",
]

# Blog paths to check
BLOG_PATHS = [
    "/blog", "/actualite", "/news", "/posts", "/articles",
    "/blog/", "/actualite/", "/news/", "/posts/", "/articles/",
]


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _strip_html_attributes(html: str) -> str:
    """Remove HTML attributes for simpler pattern matching."""
    # Remove attributes but keep tags and text
    cleaned = re.sub(r'\s+[^\s>]+="[^"]*"', '', html)
    cleaned = re.sub(r'\s+[^\s>]+=\'[^\']*\'', '', cleaned)
    return cleaned


def _has_meta_generator(html: str, generator_name: str) -> bool:
    """Check if HTML meta generator tag contains a specific CMS name."""
    patterns = [
        f'<meta[^>]*name=["\']generator["\'][^>]*content=["\']{generator_name}["\']',
        f'<meta[^>]*content=["\']{generator_name}["\'][^>]*name=["\']generator["\']',
    ]
    for pattern in patterns:
        if re.search(pattern, html, re.IGNORECASE):
            return True
    return False


# ============================================================
# CMS DETECTION
# ============================================================


def detect_cms(html: str, url: str) -> Tuple[Optional[str], float, Dict[str, Any]]:
    """
    Detect the CMS from HTML content.

    Returns:
        (cms_name, confidence, signals) where:
        - cms_name: detected CMS or None
        - confidence: confidence score 0-1
        - signals: dict of detected signals
    """
    signals: Dict[str, Any] = {
        "cms": None,
        "cms_confidence": 0.0,
        "generator": None,
        "powerby": None,
        "content_type": None,
    }

    if not html:
        return (None, 0.0, signals)

    html_lower = html.lower()
    cleaned_html = _strip_html_attributes(html)

    # Check for CMS generator meta tag
    for cms_pattern, cms_name, cms_confidence in CMS_SIGNATURES:
        if re.search(cms_pattern, html_lower):
            signals["cms"] = cms_name
            signals["cms_confidence"] = cms_confidence
            signals["generator"] = cms_name
            return (cms_name, cms_confidence, signals)

    # Check strong signatures first
    for strong_pattern, cms_name, strong_confidence in STRONG_SIGNATURES:
        if re.search(strong_pattern, html_lower):
            signals["cms"] = cms_name
            signals["cms_confidence"] = strong_confidence
            signals["generator"] = cms_name
            return (cms_name, strong_confidence, signals)

    # Check for common CMS generator meta tags
    cms_order = ["wordpress", "shopify", "squarespace", "wix", "webflow", "drupal", "joomla", "ghost"]
    for cms_name in cms_order:
        if _has_meta_generator(html, cms_name):
            signals["cms"] = cms_name
            signals["cms_confidence"] = 0.7
            signals["generator"] = cms_name
            return (cms_name, 0.7, signals)

    # Default: no CMS detected
    return (None, 0.0, signals)


# ============================================================
# SOURCE TOOL DETECTION
# ============================================================


def detect_source_tools(html: str) -> List[str]:
    """
    Detect source tools used in the page HTML.

    Returns list of detected tools: google_docs, notion, airtable, contentful
    """
    detected: List[str] = []
    html_lower = html.lower()

    for tool, patterns in SOURCE_SIGNATURES.items():
        for pattern in patterns:
            if re.search(pattern, html_lower):
                detected.append(tool)
                break  # Only add each tool once

    return detected


# ============================================================
# BLOG FRESHNESS
# ============================================================


def _extract_last_post_date(html: str) -> Optional[datetime]:
    """Extract the last blog post date from HTML."""
    if not html:
        return None

    # Look for various date patterns in blog posts
    date_patterns = [
        r'<time[^>]*datetime=["\']([^"\']+)["\']',
        r'class=["\']([^"\']*date[^"\']*)["\']',
        r'<span[^>]*datetime=["\']([^"\']+)["\']',
        r'publish.date|posted.on|updated.on',
    ]

    for pattern in date_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            date_str = match.group(1) if match.lastindex else match.group(0)
            # Try to parse the date
            try:
                # ISO format
                if "T" in date_str:
                    return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                # Other common formats
                parsed = datetime.strptime(date_str.strip(), "%B %d, %Y")
                return parsed.replace(tzinfo=timezone.utc)
                # Fallback: try year only
            except ValueError:
                continue

    # Look for typical blog post date patterns in text
    text_dates = re.findall(r'\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})', html, re.IGNORECASE)
    if text_dates:
        try:
            day, month, year = text_dates[0]
            month_num = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].index(month.lower()) + 1
            return datetime(int(year), month_num, int(day), tzinfo=timezone.utc)
        except (ValueError, IndexError):
            pass

    return None


def freshness_days(last_post_date: Optional[datetime]) -> int:
    """
    Calculate days since last blog post.

    Returns:
        Number of days since last post (0 if date is today or future,
        large number if no date provided).
    """
    if last_post_date is None:
        # No post date available - return high number
        return 999

    try:
        now = datetime.now(timezone.utc)
        if last_post_date.tzinfo is None:
            last_post_date = last_post_date.replace(tzinfo=timezone.utc)

        delta = now - last_post_date
        days = max(0, delta.days)

        # Cap at 3650 days (~10 years) to avoid extremely large numbers
        return min(days, 3650)

    except Exception as e:
        log.debug(f"Error calculating freshness: {e}")
        return 999


# ============================================================
# BLOG INSPECTION
# ============================================================


def _detect_blog_info(html: str, url: str) -> Dict[str, Any]:
    """Detect blog URL, post count, and last post date from HTML."""
    result: Dict[str, Any] = {
        "blog_url": None,
        "post_count": 0,
        "last_post_date": None,
    }

    if not html:
        return result

    # Try to find blog link in navigation or sidebar
    blog_url_patterns = [
        r'href=["\'](/blog|/actualite|/news|/posts)["\']',
        r'rel=["\']blog["\']|type=["\']blog["\']',
    ]

    for pattern in blog_url_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            path = match.group(1)
            # Construct full URL
            from urllib.parse import urljoin
            result["blog_url"] = urljoin(url, path)
            break

    # If no blog URL found from links, try common blog paths
    if not result["blog_url"]:
        for path in BLOG_PATHS:
            if re.search(rf'{re.escape(path)}', html, re.IGNORECASE):
                from urllib.parse import urljoin
                result["blog_url"] = urljoin(url, path)
                break

    # Extract last post date
    result["last_post_date"] = _extract_last_post_date(html)

    # Estimate post count from blog post markers
    post_markers = re.findall(r'<article[^>]*>|<section[^>]*class=[^>]*post[^>]*>|class=[^>]*="[^"]*post[^"]*"', html, re.IGNORECASE)
    result["post_count"] = len(post_markers)

    return result


def inspect_site(url: str, domain: str) -> Dict[str, Any]:
    """
    Inspect a site and return comprehensive analysis.

    Returns dict with:
    - cms: detected CMS name
    - confidence: CMS detection confidence 0-1
    - source_tools: list of detected source tools
    - blog_url: detected blog URL if any
    - post_count: estimated number of blog posts
    - last_post_date: datetime of last post if found
    - signals: dict of all detected signals
    - freshness_days: days since last post
    - inspection_score_bonus: 0-20 bonus for qualifier
    """
    # Normalize domain
    norm_domain = normalize_domain(domain)

    # Fetch the page HTML
    signals: Dict[str, Any] = {
        "domain": norm_domain,
        "url": url,
        "cms": None,
        "cms_confidence": 0.0,
        "source_tools": [],
        "blog_url": None,
        "post_count": 0,
        "last_post_date": None,
        "freshness_days": 999,
        "qualifier_bonus": 0,
    }

    try:
        import requests
        from bs4 import BeautifulSoup

        # Fetch the page
        try:
            resp = requests.get(
                url,
                timeout=10,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                },
            )
            if resp.status_code != 200:
                return signals
            html = resp.text
        except Exception as e:
            log.debug(f"Failed to fetch {url}: {e}")
            return signals

        # Detect CMS
        cms, confidence, cms_signals = detect_cms(html, url)
        signals.update(cms_signals)

        # Detect source tools
        source_tools = detect_source_tools(html)
        signals["source_tools"] = source_tools

        # Detect blog info
        blog_info = _detect_blog_info(html, url)
        signals.update({
            "blog_url": blog_info.get("blog_url"),
            "post_count": blog_info.get("post_count", 0),
            "last_post_date": blog_info.get("last_post_date"),
        })

        # Calculate freshness
        if signals["last_post_date"]:
            signals["freshness_days"] = freshness_days(signals["last_post_date"])
        else:
            signals["freshness_days"] = 999

        # Calculate inspection score bonus
        signals["qualifier_bonus"] = inspection_score_bonus(signals)

    except Exception as e:
        log.error(f"Error inspecting site {url}: {e}")

    return signals


def inspection_score_bonus(result: Dict[str, Any]) -> int:
    """
    Calculate inspection score bonus (0-20) for qualifier.

    Bonus rules:
    - Fresh blog (< 30 days): +15
    - Moderate blog (30-90 days): +10
    - Stale blog (90-365 days): +5
    - Very stale blog (> 365 days): +0
    - CMS detected: +5
    - Source tools detected (google_docs/notion/airtable/contentful): +3 each, max +10
    - No CMS detected: -5 (penalty, min 0)

    Final bonus is clamped to range 0-20.
    """
    final_bonus = 0
    cms_detected = result.get("cms") is not None
    source_tools = result.get("source_tools") or []

    # CMS component
    if cms_detected:
        final_bonus += 5
    else:
        final_bonus -= 5  # Penalty for no CMS

    # Source tools component (max +10)
    tool_count = len(source_tools)
    final_bonus += min(tool_count * 3, 10)

    # Freshness component
    freshness = result.get("freshness_days", 999)
    if freshness <= 30:
        final_bonus += 15  # Fresh
    elif freshness <= 90:
        final_bonus += 10  # Moderate
    elif freshness <= 365:
        final_bonus += 5   # Stale

    # Ensure range 0-20
    return max(0, min(20, final_bonus))


# ============================================================
# MAIN INSPECTION EXPORT
# ============================================================

__all__ = [
    "inspect_site",
    "detect_cms",
    "detect_source_tools",
    "freshness_days",
    "inspection_score_bonus",
    "CMS_SIGNATURES",
    "STRONG_SIGNATURES",
    "SOURCE_SIGNATURES",
    "BLOG_HINTS",
    "BLOG_PATHS",
]