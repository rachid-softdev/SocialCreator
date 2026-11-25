"""Utility functions for the prospecting package."""

import logging
import random
import re
import time
from pathlib import Path
from typing import Optional


class Logger:
    """Simple logger wrapper."""

    def __init__(self, name: str = "prospecting", debug: bool = False):
        self.logger = logging.getLogger(name)
        self.debug_enabled = debug
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.DEBUG if debug else logging.INFO)

    def _log(self, level: str, msg: str) -> None:
        getattr(self.logger, level)(msg)

    def info(self, msg: str) -> None:
        self._log("info", msg)

    def debug(self, msg: str) -> None:
        if self.debug_enabled:
            self._log("debug", msg)

    def warning(self, msg: str) -> None:
        self._log("warning", msg)

    def error(self, msg: str) -> None:
        self._log("error", msg)

    def success(self, msg: str) -> None:
        self._log("info", f"OK: {msg}")


log = Logger()


def smart_delay(min_sec: float, max_sec: float) -> None:
    """Sleep for a random duration between min and max seconds."""
    time.sleep(random.uniform(min_sec, max_sec))


def normalize_domain(url: str) -> str:
    """Normalize a URL to a clean domain."""
    if not url:
        return ""
    url = url.strip()
    if url.startswith(("http://", "https://")):
        from urllib.parse import urlparse
        netloc = urlparse(url).netloc
    else:
        netloc = url
    netloc = netloc.split("/")[0].split("?")[0].split("#")[0]
    netloc = netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc


def is_valid_domain(domain: str) -> bool:
    """Check if a string looks like a valid domain."""
    if not domain or "." not in domain:
        return False
    if domain.startswith(("tel:", "mailto:", "javascript:")):
        return False
    return bool(re.match(r"^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$", domain))


def ensure_dir(path: str) -> Path:
    """Ensure a directory exists, creating it if necessary.
    
    If path is a file path, creates the parent directory.
    """
    p = Path(path)
    if p.suffix:  # Has extension, treat as file path
        p = p.parent
    p.mkdir(parents=True, exist_ok=True)
    return p


def read_json(path: str, default=None):
    """Read a JSON file, returning default if missing or invalid."""
    p = Path(path)
    if not p.exists():
        return default
    try:
        with open(p, encoding="utf-8") as f:
            import json
            return json.load(f)
    except Exception:  # noqa: BLE001
        return default


def write_json(path: str, data) -> None:
    """Write data to a JSON file."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        import json
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


def load_env(path: str = ".env") -> dict:
    """Load environment variables from a .env file."""
    p = Path(path)
    if not p.exists():
        return {}
    env = {}
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


__all__ = ["Logger", "log", "smart_delay", "normalize_domain", "is_valid_domain", "ensure_dir", "read_json", "write_json", "load_env"]
