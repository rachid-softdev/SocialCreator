"""Enrichment adapter for site crawling, email extraction, and contact discovery.

Exports:
- harvest_site(domain) → HarvestResult: full site crawl with emails + decision makers
- inspect_site(url, domain) → dict with CMS, confidence, source_tools, blog info, signals, freshness, score bonus
- detect_cms(html, url) → (cms, confidence, signals)
- detect_source_tools(html) → list of tools
- freshness_days(last_post_date) → days since last post
- inspection_score_bonus(result) → 0-20 bonus for qualifier
- analyze_site(domain) → platform detection, catalog size, tech stack
- PlatformSignals dataclass
- _extract_emails_from_html(html) → list of emails from mailto: + text
- verify_email(email) → (status, detail): SMTP verification
- _generate_email_patterns(decision_makers, domain) → generated email patterns
- _extract_decision_makers(html, base_url) → decision makers from site HTML
- crawl_site(start_url, max_pages=150, delay_ms=150) → list of (html, url, lang)
- html_to_text(html) → text extracted from HTML
- extract_main_text(page_html) → main text (excl. header/footer)
- normalize_url(base_url, link) → absolutized normalized URL
- extract_contacts_from_html(html) → list of {email, source} contacts
- scan_html(raw) → list of (email, source) found in HTML
"""

from .site_harvest import harvest_site, PageResult, HarvestResult, _extract_emails_from_html, _extract_decision_makers, _generate_email_patterns, _sanitize_email, _is_valid_email, _normalize_name, _strip_accents
from .email_finder import verify_email, verify_email_batch, _get_mx_records
from .site_inspect import inspect_site, detect_cms, detect_source_tools, freshness_days, inspection_score_bonus, CMS_SIGNATURES, STRONG_SIGNATURES, SOURCE_SIGNATURES, BLOG_HINTS, BLOG_PATHS
from .site_analysis import analyze_site, PlatformSignals
from .crawl_utils import (crawl_site, html_to_text, extract_main_text,
                           normalize_url, http_get, get_with_retry,
                           parse_sitemap, discover_sitemap_urls,
                           probe_legal_pages, purge_crawl_dir)
from .contact_extractor import (scan_html, extract_contacts_from_html,
                                 site_domain, cf_decode, looks_like_noise,
                                 is_same_domain, score_email,
                                 slugifier, generate_email_patterns,
                                 RE_MAILTO, RE_PLAIN, RE_CF_ATTR,
                                 RE_CF_HREF, RE_DATA_EMAIL, RE_JSONLD,
                                 RE_HTML_LANG, RE_SEC_CONTACT,
                                 CANDIDATE_SLUGS, MAX_EXTRA_PAGES,
                                 MAX_HEADLESS_PAGES, NOISE_DOMAIN,
                                 NOISE_SUFFIX, TLD_LANG)

__all__ = [
    "harvest_site",
    "PageResult",
    "HarvestResult",
    "_extract_emails_from_html",
    "_extract_decision_makers",
    "_generate_email_patterns",
    "verify_email",
    "verify_email_batch",
    "_sanitize_email",
    "_is_valid_email",
    "_normalize_name",
    "_strip_accents",
    "_get_mx_records",
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
    "analyze_site",
    "PlatformSignals",
    # New exports
    "crawl_site",
    "html_to_text",
    "extract_main_text",
    "normalize_url",
    "extract_contacts_from_html",
    "scan_html",
    "site_domain",
    "cf_decode",
    "looks_like_noise",
    "is_same_domain",
    "score_email",
    "slugifier",
    "generate_email_patterns",
    # Crawl utils
    "normalize_url",
    "http_get",
    "get_with_retry",
    "parse_sitemap",
    "discover_sitemap_urls",
    "probe_legal_pages",
    "purge_crawl_dir",
    # Contact extraction
    "RE_MAILTO",
    "RE_PLAIN",
    "RE_CF_ATTR",
    "RE_CF_HREF",
    "RE_DATA_EMAIL",
    "RE_JSONLD",
    "RE_HTML_LANG",
    "RE_SEC_CONTACT",
    "CANDIDATE_SLUGS",
    "MAX_EXTRA_PAGES",
    "MAX_HEADLESS_PAGES",
    "NOISE_DOMAIN",
    "NOISE_SUFFIX",
    "TLD_LANG",
]