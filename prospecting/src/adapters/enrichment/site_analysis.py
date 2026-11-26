"""
Site analysis: platform detection, catalog size estimation, tech stack signals.

Adapted from Folia's site_analysis.py. Performs CMS detection, e-commerce platform
identification, blog detection, and content analysis to produce a comprehensive
site profile with catalog estimation and tech stack signals.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.utils import log, normalize_domain

# ============================================================
# DATA CLASSES
# ============================================================


@dataclass
class PlatformSignals:
    """Platform and tech stack signals for a site."""
    platform: Optional[str] = None  # e.g., "shopify", "woocommerce", "magento"
    platform_confidence: float = 0.0
    cms: Optional[str] = None  # e.g., "wordpress", "drupal"
    cms_confidence: float = 0.0
    catalog_size: Optional[int] = None  # estimated number of products
    catalog_confidence: float = 0.0
    tech_stack: List[str] = field(default_factory=list)
    blog_present: bool = False
    blog_url: Optional[str] = None
    content_summary: str = ""
    page_count_estimate: int = 0


# ============================================================
# E-COMMERCE PLATFORM DETECTION
# ============================================================

# Platform signatures: (regex_pattern, platform_name, confidence)
PLATFORM_SIGNATURES = [
    (r"Shopify", "shopify", 0.9),
    (r"WooCommerce", "woocommerce", 0.85),
    (r"Magento", "magento", 0.85),
    (r"BigCommerce", "bigcommerce", 0.8),
    (r"Squarespace Commerce", "squarespace_commerce", 0.8),
    (r"Wix Stores", "wix_stores", 0.75),
    (r"PrestaShop", "prestashop", 0.85),
    (r"Salesforce Commerce", "salesforce_commerce", 0.8),
    (r"Demandware", "demandware", 0.8),
    (r"OpenCart", "opencart", 0.75),
]

# Platform-specific catalog patterns
CATALOG_PATTERNS = {
    "shopify": [r"product\.json", r"collections?/", r"/products/", r"data-product-id"],
    "woocommerce": [r"product", r"add_to_cart", r"wc-ajax", r"wp-content/plugins/woocommerce"],
    "magento": [r"Mage\.Cookies", r"magento", r"catalog/product/view", r"checkout/cart"],
    "bigcommerce": [r"BigCommerce", r"cart\.php", r"product/specs"],
    "prestashop": [r"prestashop", r"module/", r"cartcontroller"],
    "opencart": [r"opencart", r"product_id", r"catalog/view"],
    "squarespace_commerce": [r"squarespace.*commerce", r"products?\.json", r"cart"],
    "wix_stores": [r"wixstores", r"wix.*products?"],
    "salesforce_commerce": [r"salesforce.*commerce", r"demandware"],
    "demandware": [r"demandware"],
}

# CMS signatures for blog detection
CMS_BLOG_SIGNATURES = {
    "wordpress": [r"wp-content|wp-includes|wordpress", r"wp-json/wp/v2/posts"],
    "drupal": [r"sites/default|drupal", r"node/[0-9]+"],
    "joomla": [r"joomla", r"com_content"],
    "ghost": [r"ghost", r"casper"],
    "squarespace": [r"squarespace\.com", r"static1\.squarespace"],
}

# Common blog paths
BLOG_PATHS = [
    "/blog", "/actualite", "/news", "/posts", "/articles",
    "/journal", "/content", "/resources", "/insight",
]

# Tech stack indicators
TECH_STACK_SIGNATURES = {
    "analytics": [r"google-analytics", r"gtag\(", r"ga\(", r"matomo", r"plausible"],
    "tag_manager": [r"googletagmanager\.com|GTM-", r"gtm\.js"],
    "cdn": [r"cloudflare", r"cloudfront\.net", r"fastly"],
    "cdn_js": [r"cdnjs|unpkg|jsdelivr|cloudflare.*cdn"],
    "advertising": [r"googlesyndication", r"doubleclick", r"facebook.*pixel", r"fbq\("],
    "chat": [r"intercom", r"zendesk.*chat", r"drift", r"crisp"],
    "reviews": [r"trustpilot", r"yotpo", r"stamped", r"loox"],
    "payments": [r"stripe\.com|stripe\.js", r"paypal", r"checkout\.paypal"],
    "payments_2": [r"apple-pay", r"google-pay"],
    "fonts": [r"fonts\.googleapis", r"typekit", r"fonts\.gstatic"],
    "framework": [r"react", r"vue\.js", r"angular", r"next\.js", r"nuxt"],
    "css_framework": [r"bootstrap", r"tailwind", r"bulma"],
    "social": [r"facebook.*plugin", r"twitter.*widget", r"linkedin.*share"],
    "forms": [r"typeform", r"jotform", r"gravity.*forms", r"contact.*form.*7"],
}

# ============================================================
# HELPER FUNCTIONS
# ============================================================


def _detect_platform(html: str, url: str) -> Dict[str, Any]:
    """Detect e-commerce platform and CMS from HTML."""
    result: Dict[str, Any] = {
        "platform": None,
        "platform_confidence": 0.0,
        "cms": None,
        "cms_confidence": 0.0,
    }

    html_lower = html.lower()

    # Detect e-commerce platform
    for pattern, platform_name, confidence in PLATFORM_SIGNATURES:
        if re.search(pattern, html_lower):
            result["platform"] = platform_name
            result["platform_confidence"] = confidence
            break

    # Detect CMS (from site_inspect or basic patterns)
    cms_signatures = [
        (r"wp-content|wp-includes", "wordpress", 0.9),
        (r"squarespace\.com", "squarespace", 0.85),
        (r"data-wix-", "wix", 0.8),
        (r"webflow\.io", "webflow", 0.85),
        (r"sites/default|modules/system", "drupal", 0.8),
        (r"joomla|com_content", "joomla", 0.75),
        (r"ghost\.org|Ghost|casper", "ghost", 0.8),
    ]

    for pattern, cms_name, cms_confidence in cms_signatures:
        if re.search(pattern, html_lower):
            result["cms"] = cms_name
            result["cms_confidence"] = cms_confidence
            break

    return result


def _estimate_catalog_size(html: str, platform: Optional[str]) -> Dict[str, Any]:
    """Estimate catalog size based on platform and page content."""
    result: Dict[str, Any] = {
        "catalog_size": None,
        "catalog_confidence": 0.0,
    }

    html_lower = html.lower()

    # Platform-specific catalog indicators
    catalog_patterns = []
    if platform and platform in CATALOG_PATTERNS:
        catalog_patterns = CATALOG_PATTERNS[platform]
    else:
        # Generic patterns
        catalog_patterns = [
            r"product", r"shop", r"catalog", r"collections?",
            r"/products?/", r"item", r"sku",
        ]

    # Count product-like elements
    product_markers = 0
    for pattern in catalog_patterns:
        product_markers += len(re.findall(pattern, html_lower))

    # Estimate based on product markers and page structure
    if product_markers > 50:
        result["catalog_size"] = min(product_markers * 2, 1000)
        result["catalog_confidence"] = 0.7
    elif product_markers > 10:
        result["catalog_size"] = min(product_markers * 3, 500)
        result["catalog_confidence"] = 0.6
    elif product_markers > 0:
        result["catalog_size"] = min(product_markers * 5, 100)
        result["catalog_confidence"] = 0.4

    return result


def _detect_tech_stack(html: str) -> List[str]:
    """Detect tech stack from HTML signatures."""
    tech_stack: List[str] = []
    html_lower = html.lower()

    for tech_name, patterns in TECH_STACK_SIGNATURES.items():
        for pattern in patterns:
            if re.search(pattern, html_lower):
                if tech_name not in tech_stack:
                    tech_stack.append(tech_name)
                break

    return tech_stack


def _detect_blog(html: str, url: str, cms: Optional[str]) -> Dict[str, Any]:
    """Detect blog presence and URL."""
    result: Dict[str, Any] = {
        "blog_present": False,
        "blog_url": None,
    }

    # Check for blog links
    blog_url_patterns = [
        r'href=["\'](/blog|/actualite|/news|/posts)["\']',
        r'rel=["\']blog["\']|type=["\']blog["\']',
    ]

    for pattern in blog_url_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            path = match.group(1)
            from urllib.parse import urljoin
            result["blog_url"] = urljoin(url, path)
            result["blog_present"] = True
            break

    # If not found from links, try common blog paths
    if not result["blog_present"]:
        for path in BLOG_PATHS:
            if re.search(rf'{re.escape(path)}', html, re.IGNORECASE):
                from urllib.parse import urljoin
                result["blog_url"] = urljoin(url, path)
                result["blog_present"] = True
                break

    # CMS-specific blog detection
    if cms in CMS_BLOG_SIGNATURES:
        for pattern in CMS_BLOG_SIGNATURES[cms]:
            if re.search(pattern, html, re.IGNORECASE):
                result["blog_present"] = True
                break

    return result


def _analyze_content(html: str) -> Dict[str, Any]:
    """Analyze page content for signals."""
    result: Dict[str, Any] = {
        "content_summary": "",
        "page_count_estimate": 0,
    }

    # Extract text content for summary
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        # Get title
        title = soup.title.string if soup.title else ""

        # Get meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        desc = meta_desc.get("content", "") if meta_desc else ""

        # Estimate page count from navigation links
        nav_links = soup.find_all("nav", limit=1)
        if nav_links:
            links = nav_links.find_all("a", href=True)
            result["page_count_estimate"] = len(links)
        else:
            # Count all unique internal links
            all_links = soup.find_all("a", href=True)
            result["page_count_estimate"] = min(len(all_links), 50)

        # Create content summary
        summary_parts = []
        if title:
            summary_parts.append(f"Title: {title[:100]}")
        if desc:
            summary_parts.append(f"Desc: {desc[:100]}")

        result["content_summary"] = " | ".join(summary_parts) if summary_parts else "No summary"

    except Exception:
        result["content_summary"] = "Analysis error"

    return result


# ============================================================
# MAIN ANALYSIS FUNCTION
# ============================================================


def analyze_site(domain: str) -> Dict[str, Any]:
    """
    Analyze a site and return comprehensive analysis.

    Returns dict with:
    - platform: detected e-commerce platform
    - platform_confidence: confidence score 0-1
    - cms: detected CMS
    - cms_confidence: CMS confidence 0-1
    - catalog_size: estimated number of products (or None)
    - catalog_confidence: confidence for catalog estimate
    - tech_stack: list of detected tech stack elements
    - blog_present: whether a blog is present
    - blog_url: detected blog URL if present
    - content_summary: brief summary of site content
    - page_count_estimate: estimated number of pages
    """
    # Normalize domain
    norm_domain = normalize_domain(domain)

    result: Dict[str, Any] = {
        "platform": None,
        "platform_confidence": 0.0,
        "cms": None,
        "cms_confidence": 0.0,
        "catalog_size": None,
        "catalog_confidence": 0.0,
        "tech_stack": [],
        "blog_present": False,
        "blog_url": None,
        "content_summary": "",
        "page_count_estimate": 0,
    }

    # Try to fetch the site
    try:
        import requests

        # Try HTTPS then HTTP
        for proto in ("https://", "http://"):
            try:
                resp = requests.get(
                    f"{proto}{domain}",
                    timeout=10,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0.0.0 Safari/537.36"
                        )
                    },
                )
                if resp.status_code < 400:
                    html = resp.text
                    break
            except Exception:
                continue
        else:
            return result

        # Detect platform and CMS
        platform_info = _detect_platform(html, f"{proto}{domain}")
        result.update(platform_info)

        # Estimate catalog size
        catalog_info = _estimate_catalog_size(html, result["platform"])
        result.update(catalog_info)

        # Detect tech stack
        result["tech_stack"] = _detect_tech_stack(html)

        # Detect blog
        blog_info = _detect_blog(html, f"{proto}{domain}", result["cms"])
        result.update(blog_info)

        # Analyze content
        content_info = _analyze_content(html)
        result.update(content_info)

    except Exception as e:
        log.error(f"Error analyzing site {domain}: {e}")

    return result


# ============================================================
# EXPORTS
# ============================================================

__all__ = [
    "analyze_site",
    "PlatformSignals",
]