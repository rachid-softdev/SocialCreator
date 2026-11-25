"""Tests for the prospecting package."""

import json
import os
import tempfile
from pathlib import Path

import pytest


class TestTypes:
    """Tests for core types."""

    def test_prospect_status_values(self):
        from src.prospecting_types import ProspectStatus
        assert ProspectStatus.DISCOVERED.value == "discovered"
        assert ProspectStatus.APPROVED.value == "approved"
        assert ProspectStatus.UNSUBSCRIBED.value == "unsubscribed"

    def test_search_result_to_dict(self):
        from src.prospecting_types import SearchResult
        result = SearchResult(title="Test Co", url="https://test.com", snippet="A B C", position=1)
        d = result.to_dict()
        assert d["title"] == "Test Co"
        assert d["url"] == "https://test.com"
        assert d["position"] == 1

    def test_company_to_dict(self):
        from src.prospecting_types import Company
        company = Company(domain="test.com", name="Test")
        d = company.to_dict()
        assert d["domain"] == "test.com"
        assert d["name"] == "Test"


class TestConfig:
    """Tests for configuration management."""

    def test_load_icp_from_json(self):
        from src.config import load_icp
        icp = load_icp("config/icp.json")
        assert len(icp.markets) > 0
        assert icp.qualification_threshold == 70
        assert len(icp.exclude_domains) > 0

    def test_load_config_from_env(self):
        from src.config import load_config_from_env
        config = load_config_from_env()
        assert config.icp is not None
        assert config.llm is not None
        assert config.email is not None
        assert config.crm is not None
        assert config.discovery is not None
        assert config.notifications is not None


class TestUtils:
    """Tests for utility functions."""

    def test_normalize_domain(self):
        from src.utils import normalize_domain
        assert normalize_domain("https://www.Test.com/path") == "test.com"
        assert normalize_domain("https://sub.domain.com") == "sub.domain.com"

    def test_is_valid_domain(self):
        from src.utils import is_valid_domain
        assert is_valid_domain("test.com") is True
        assert is_valid_domain("bad") is False
        assert is_valid_domain("invalid_domain") is False


class TestLLM:
    """Tests for LLM manager with heuristic fallback."""

    def test_heuristic_qualify(self):
        from src.llm import HeuristicEngine
        engine = HeuristicEngine()
        result = engine.qualify(text="We are a cold email agency for B2B")
        assert 0 <= result["score"] <= 100
        assert isinstance(result["qualified"], bool)

    def test_llm_manager_heuristic(self):
        from src.llm import LLMManager
        manager = LLMManager({"provider": "heuristic", "fallback_heuristic": True})
        result = manager.call("qualify company")
        assert isinstance(result, dict)


class TestLLMSessionCleanup:
    """Tests for CLI session cleanup after opencode/kilo searches."""

    @staticmethod
    def _events(*events):
        return "\n".join(json.dumps(event) for event in events) + "\n"

    def _success_output(self, session_id="ses_test", text='[{"name": "Test"}]'):
        return self._events(
            {"type": "step_start", "sessionID": session_id,
             "part": {"type": "step-start"}},
            {"type": "text", "sessionID": session_id,
             "part": {"type": "text", "text": text}},
            {"type": "step_finish", "sessionID": session_id,
             "part": {"type": "step-finish"}},
        )

    def _manager(self):
        from src.llm import LLMManager
        return LLMManager({"provider": "opencode", "model": "test/model"})

    def test_run_parses_text_and_deletes_session(self, monkeypatch):
        import subprocess

        calls = []

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            if "run" in cmd:
                return subprocess.CompletedProcess(
                    cmd, 0, stdout=self._success_output(), stderr=""
                )
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

        monkeypatch.setattr(subprocess, "run", fake_run)

        result = self._manager()._call_opencode("prompt")

        assert result == {"text": '[{"name": "Test"}]'}
        assert len(calls) == 2
        assert calls[0][1] == "run"
        assert calls[0][2:4] == ["--format", "json"]
        assert calls[0][4:6] == ["--auto", "--model"]
        assert calls[1][1:3] == ["session", "delete"]
        assert calls[1][3] == "ses_test"

    def test_cleanup_on_provider_error(self, monkeypatch):
        import subprocess

        calls = []
        output = self._events(
            {"type": "step_start", "sessionID": "ses_err",
             "part": {"type": "step-start"}},
            {"type": "error", "sessionID": "ses_err",
             "error": {"type": "provider.auth",
                       "message": "This API key has expired"}},
        )

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            if "run" in cmd:
                return subprocess.CompletedProcess(cmd, 1, stdout=output, stderr="")
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

        monkeypatch.setattr(subprocess, "run", fake_run)

        with pytest.raises(RuntimeError, match="expired"):
            self._manager()._call_opencode("prompt")

        assert any(cmd[1:3] == ["session", "delete"] for cmd in calls)

    def test_cleanup_on_timeout(self, monkeypatch):
        import subprocess

        calls = []

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            if "run" in cmd:
                raise subprocess.TimeoutExpired(
                    cmd, 60, output=self._success_output("ses_timeout")
                )
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

        monkeypatch.setattr(subprocess, "run", fake_run)

        with pytest.raises(subprocess.TimeoutExpired):
            self._manager()._call_opencode("prompt")

        delete_calls = [cmd for cmd in calls if cmd[1:3] == ["session", "delete"]]
        assert len(delete_calls) == 1
        assert delete_calls[0][3] == "ses_timeout"

    def test_llm_searcher_returns_text(self):
        from src.adapters.discovery.llm_search import LLMSearcher

        class DummyLLM:
            def call(self, prompt):
                return {"text": '[{"name": "Test"}]'}

        searcher = LLMSearcher.__new__(LLMSearcher)
        searcher.llm = DummyLLM()

        assert searcher._call_with_chain("prompt") == '[{"name": "Test"}]'


class TestEmail:
    """Tests for email sender."""

    def test_unsubscribe_token_generation(self):
        from src.email_sender import EmailSender
        sender = EmailSender({"hmac_secret": "test-secret", "unsubscribe_domain": "test.com"})
        token = sender.generate_unsubscribe_token("contact@test.com")
        assert len(token) > 0
        url = sender.generate_unsubscribe_url("contact@test.com")
        assert "token=" in url

    def test_list_unsubscribe_header(self):
        from src.email_sender import EmailSender
        sender = EmailSender({"unsubscribe_domain": "test.com", "hmac_secret": "test-secret"})
        header = sender.generate_list_unsubscribe_header("contact@test.com")
        assert "List-Unsubscribe" in header or "<" in header

    def test_dry_run_send(self):
        from src.email_sender import EmailSender
        sender = EmailSender({"dry_run": True, "api_key": "test"})
        result = sender.send(
            to_email="test@test.com",
            subject="Test",
            body_html="<p>Test</p>",
        )
        assert result.success is True
        assert result.message_id == "dry_run"


class TestCRM:
    """Tests for CRM."""

    def test_crm_init_sqlite(self):
        from src.crm import CRM
        with tempfile.TemporaryDirectory() as tmpdir:
            config = {"backend": "sqlite", "sqlite_path": f"{tmpdir}/test_crm.db"}
            crm = CRM(config)
            assert crm.backend == "sqlite"
            stats = crm.get_stats()
            assert "total" in stats
            crm.close()

    def test_crm_upsert_and_get(self):
        from src.crm import CRM
        with tempfile.TemporaryDirectory() as tmpdir:
            config = {"backend": "sqlite", "sqlite_path": f"{tmpdir}/test_crm.db"}
            crm = CRM(config)

            cid = crm.upsert_company({
                "domain": "testcompany.com",
                "name": "Test Company",
                "website": "https://testcompany.com",
                "description": "We do cold email",
                "source": "google",
                "status": "discovered",
            })

            company = crm.get_company_by_domain("testcompany.com")
            assert company is not None
            assert company["name"] == "Test Company"
            assert company["id"] == cid

            crm.close()

    def test_crm_draft_methods(self):
        from src.crm import CRM
        with tempfile.TemporaryDirectory() as tmpdir:
            config = {"backend": "sqlite", "sqlite_path": f"{tmpdir}/test_crm.db"}
            crm = CRM(config)

            crm.upsert_draft({
                "company_id": 1,
                "contact_email": "contact@testcompany.com",
                "subject": "Test",
                "body": "Body",
                "status": "pending",
            })

            draft = crm.get_draft_by_email("contact@testcompany.com")
            assert draft is not None
            assert draft["subject"] == "Test"

            crm.close()


class TestPipeline:
    """Tests for pipeline stages."""

    def test_discover_stage_needs_redis_or_db(self):
        # Discovery stage requires valid dependencies (selenium etc.)
        # Just verify function exists
        from src.pipeline import stages
        assert hasattr(stages, "discover_stage")
        assert hasattr(stages, "qualify_stage")
        assert hasattr(stages, "enrich_stage")
        assert hasattr(stages, "personalize_stage")
        assert hasattr(stages, "send_stage")
        assert hasattr(stages, "replies_stage")
        assert hasattr(stages, "stats_stage")


class TestRunnerLock:
    """Tests for runner lock."""

    def test_runner_lock_exists(self):
        from src.lock import RunnerLock
        assert hasattr(RunnerLock, "acquire_or_skip")
        assert hasattr(RunnerLock, "release")
