"""Unit tesztek: Comet Models — Pydantic V2 validáció"""
import pytest
from myai.agents.comet.models import BrowserStep, ActorResult, CriticResult, CometResult, CometTask


class TestBrowserStep:
    def test_minimal_step(self):
        step = BrowserStep(action="navigate")
        assert step.action == "navigate"
        assert step.selector is None
        assert step.tab_index == 0
        assert step.critical is False

    def test_full_step(self):
        step = BrowserStep(
            action="click",
            selector="#submit-btn",
            description="Kattintás a küldés gombra",
            critical=True,
            tab_index=1,
            x=100,
            y=200,
        )
        assert step.action == "click"
        assert step.selector == "#submit-btn"
        assert step.critical is True
        assert step.tab_index == 1

    def test_step_dict_export(self):
        step = BrowserStep(action="fill", selector="input[name=email]", text="test@test.com")
        d = step.model_dump()
        assert d["action"] == "fill"
        assert d["text"] == "test@test.com"


class TestActorResult:
    def test_success_result(self):
        r = ActorResult(success=True, extracted={"title": "Google"})
        assert r.success is True
        assert r.extracted["title"] == "Google"
        assert r.error is None

    def test_failure_result(self):
        r = ActorResult(success=False, error="Element not found")
        assert r.success is False
        assert r.error == "Element not found"


class TestCriticResult:
    def test_success(self):
        r = CriticResult(success=True)
        assert r.success is True
        assert r.suggestion is None

    def test_failure_with_suggestion(self):
        r = CriticResult(success=False, error="CAPTCHA", suggestion="Próbáld másik módszerrel")
        assert r.error == "CAPTCHA"
        assert r.suggestion is not None


class TestCometResult:
    def test_empty_result(self):
        r = CometResult(success=True)
        assert r.attempts == 1
        assert len(r.data) == 0

    def test_result_with_data(self):
        actor_results = [
            ActorResult(success=True, extracted={"title": "Test"}),
            ActorResult(success=False, error="timeout"),
        ]
        r = CometResult(success=False, data=actor_results, attempts=3, error="Max retries")
        assert r.attempts == 3
        assert len(r.data) == 2


class TestCometTask:
    def test_minimal_task(self):
        t = CometTask(task="Keress rá a Google-on")
        assert t.task == "Keress rá a Google-on"
        assert t.context == {}

    def test_task_with_context(self):
        t = CometTask(task="Töltsd ki az űrlapot", context={"headless": False})
        assert t.context["headless"] is False
