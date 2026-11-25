"""Simple validation tests for the unified prospecting package.

These tests verify that the package structure is valid and can be imported.
"""

import sys
import os

# Add the package and src directory to path
_pkg_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(_pkg_dir, "src")
sys.path.insert(0, _pkg_dir)
sys.path.insert(0, src_dir)


def test_package_imports():
    """Test that core modules can be imported."""
    # Test config
    from config import load_icp, load_config_from_env
    icp = load_icp(os.path.join(_pkg_dir, "config", "icp.json"))
    assert len(icp.markets) > 0
    print("load_icp works")

    # Test types
    from prospecting_types import Company, Contact, ProspectStatus, SearchResult
    c = Company(domain="test.com", name="Test")
    assert c.domain == "test.com"
    print("Company works")

    from prospecting_types import QualificationResult
    qr = QualificationResult(score=85, qualified=True, reason="test")
    assert qr.score == 85
    print("QualificationResult works")

    from prospecting_types import PipelineResult
    pr = PipelineResult(stage="test", success=True, processed=5)
    assert pr.stage == "test"
    print("PipelineResult works")

    # Test utils
    from utils import normalize_domain, is_valid_domain, ensure_dir
    assert normalize_domain("https://Test.com/path") == "test.com"
    assert is_valid_domain("test.com") is True
    print("Utils work")

    # Test LLM manager
    from llm import LLMManager
    mgr = LLMManager({"provider": "heuristic"})
    result = mgr.call("test prompt")
    assert isinstance(result, dict)
    print("LLMManager works")

    # Test email sender
    from email_sender import EmailSender
    sender = EmailSender({"dry_run": True})
    r = sender.send("test@test.com", "Test", "<p>Test</p>")
    assert r.success is True
    print("EmailSender works")

    # Test CRM
    from crm import CRM
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        config = {"backend": "sqlite", "sqlite_path": f"{tmpdir}/test.db"}
        crm = CRM(config)
        cid = crm.upsert_company({
            "domain": "test.com",
            "name": "Test",
            "source": "test",
            "status": "discovered",
        })
        co = crm.get_company_by_domain("test.com")
        assert co is not None
        assert co["name"] == "Test"
        crm.close()
    print("CRM works")

    # Test runner lock (basic check)
    from lock import RunnerLock
    assert hasattr(RunnerLock, "acquire_or_skip")
    assert hasattr(RunnerLock, "release")
    print("RunnerLock works")


def test_icp_config():
    """Test ICP configuration loading."""
    from config import ICPConfig, MarketConfig
    # Can't easily construct from code, just verify JSON loads
    import json
    with open(os.path.join(_pkg_dir, "config", "icp.json"), encoding="utf-8") as f:
        data = json.load(f)
    assert "markets" in data
    assert len(data["markets"]) == 2
    assert data["qualification_threshold"] == 70
    print("ICP config loads correctly")


def test_discovery_adapter():
    """Test that discovery adapter structure is valid."""
    from adapters.discovery.google_search import GoogleSearcher
    # Just verify the class exists
    assert GoogleSearcher is not None
    print("Discovery adapter (GoogleSearcher) loads")


def test_pipeline_stages():
    """Test that pipeline stages exist."""
    from pipeline import discover_stage, qualify_stage, enrich_stage
    from pipeline import personalize_stage, send_stage, replies_stage, stats_stage
    assert discover_stage is not None
    assert qualify_stage is not None
    assert enrich_stage is not None
    assert personalize_stage is not None
    assert send_stage is not None
    assert replies_stage is not None
    assert stats_stage is not None
    print("Pipeline stages exist")


if __name__ == "__main__":
    print("Running unified prospecting package validation...")
    test_package_imports()
    test_icp_config()
    test_discovery_adapter()
    test_pipeline_stages()
    print("\nAll validation tests passed!")