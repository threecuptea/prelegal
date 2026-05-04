"""Tests for the AI chat endpoint."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from main import app
from routes import chat as chat_module

client = TestClient(app)


def _fake_completion_factory(payload: dict | str):
    """Build an async stub for ``litellm.acompletion`` that returns ``payload``
    as the model's structured-output content."""

    async def _fake(*_args, **_kwargs):
        content = payload if isinstance(payload, str) else json.dumps(payload)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
        )

    return _fake


@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")


def test_chat_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory(
            {
                "reply": "Got it. What state should govern this NDA?",
                "field_updates": {"purpose": "Evaluating a partnership."},
                "done": False,
            }
        ),
    )

    response = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "We're exploring a partnership."}],
            "fields": {},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reply"].endswith("?")
    assert body["field_updates"]["purpose"] == "Evaluating a partnership."
    assert body["done"] is False


def test_chat_normalizes_enum_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory(
            {
                "reply": "Set MNDA term to 2 years. Anything else to capture?",
                "field_updates": {"mndaTerm": "expires", "mndaTermYears": "2"},
                "done": False,
            }
        ),
    )

    response = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Two years."}],
            "fields": {"purpose": "Evaluating a partnership."},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["field_updates"]["mndaTerm"] == "expires"
    assert body["field_updates"]["mndaTermYears"] == "2"


def test_chat_invalid_enum_returns_502(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory(
            {
                "reply": "ok",
                "field_updates": {"mndaTerm": "forever"},  # not a valid Literal
                "done": False,
            }
        ),
    )

    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "Forever."}], "fields": {}},
    )
    assert response.status_code == 502


def test_chat_missing_api_key_returns_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "hi"}], "fields": {}},
    )
    assert response.status_code == 503


def test_chat_upstream_error_returns_502(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _boom(*_args, **_kwargs):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(chat_module, "acompletion", _boom)

    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "hi"}], "fields": {}},
    )
    assert response.status_code == 502


def test_chat_invalid_request_body_returns_422() -> None:
    response = client.post("/api/chat", json={"messages": "not a list", "fields": {}})
    assert response.status_code == 422


def test_chat_oversized_message_returns_422() -> None:
    huge = "x" * (chat_module.MAX_MESSAGE_CHARS + 1)
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": huge}], "fields": {}},
    )
    assert response.status_code == 422


def test_chat_too_many_messages_returns_422() -> None:
    overflow = [
        {"role": "user", "content": "x"} for _ in range(chat_module.MAX_MESSAGES + 1)
    ]
    response = client.post("/api/chat", json={"messages": overflow, "fields": {}})
    assert response.status_code == 422


def test_chat_done_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory(
            {
                "reply": "Great — finalized. Want to download or tweak anything?",
                "field_updates": {},
                "done": True,
            }
        ),
    )

    response = client.post(
        "/api/chat",
        json={
            "messages": [
                {"role": "assistant", "content": "Should I finalize?"},
                {"role": "user", "content": "Yes, finalize."},
            ],
            "fields": {"purpose": "x", "governingLaw": "California"},
        },
    )
    assert response.status_code == 200
    assert response.json()["done"] is True
