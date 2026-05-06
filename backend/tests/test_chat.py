"""Tests for the AI chat endpoint."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from main import app
from models.chat import MAX_MESSAGE_CHARS, MAX_MESSAGES
from services import chat_service as chat_module

client = TestClient(app)


def _fake_completion_factory(payload: dict | str):
    """Build an async stub for ``litellm.acompletion``."""

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
        _fake_completion_factory({
            "response": "Got it — exploring a partnership. What state should govern this NDA?",
            "documentType": "mutual-nda",
            "purpose": "Evaluating a partnership.",
            "isComplete": False,
        }),
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
    assert body["response"].endswith("?")
    assert body["purpose"] == "Evaluating a partnership."
    assert body["documentType"] == "mutual-nda"
    assert body["isComplete"] is False


def test_chat_document_type_detection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory({
            "response": "I'll help with a Cloud Service Agreement. What's the subscription period?",
            "documentType": "csa",
            "isComplete": False,
        }),
    )
    response = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "I need a cloud services agreement."}],
            "fields": {},
        },
    )
    assert response.status_code == 200
    assert response.json()["documentType"] == "csa"


def test_chat_normalizes_nda_enum_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory({
            "response": "Set to 2 years. Anything else to capture?",
            "mndaTermType": "expires",
            "mndaTermYears": 2,
            "isComplete": False,
        }),
    )
    response = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Two years."}],
            "fields": {"documentType": "mutual-nda", "purpose": "Evaluating a partnership."},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mndaTermType"] == "expires"
    assert body["mndaTermYears"] == 2


def test_chat_invalid_enum_returns_502(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory({
            "response": "ok",
            "mndaTermType": "forever",  # not a valid Literal
            "isComplete": False,
        }),
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
    huge = "x" * (MAX_MESSAGE_CHARS + 1)
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": huge}], "fields": {}},
    )
    assert response.status_code == 422


def test_chat_too_many_messages_returns_422() -> None:
    overflow = [
        {"role": "user", "content": "x"} for _ in range(MAX_MESSAGES + 1)
    ]
    response = client.post("/api/chat", json={"messages": overflow, "fields": {}})
    assert response.status_code == 422


def test_chat_is_complete_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory({
            "response": "Great — finalized. Want to download or tweak anything?",
            "isComplete": True,
        }),
    )
    response = client.post(
        "/api/chat",
        json={
            "messages": [
                {"role": "assistant", "content": "Should I finalize?"},
                {"role": "user", "content": "Yes, finalize."},
            ],
            "fields": {
                "documentType": "mutual-nda",
                "purpose": "Evaluating a partnership.",
                "governingLaw": "California",
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["isComplete"] is True


def test_chat_no_fields_on_first_turn(monkeypatch: pytest.MonkeyPatch) -> None:
    """Omitting `fields` entirely (first turn) must succeed."""
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory({
            "response": "Hi! What type of agreement do you need — an NDA, CSA, or something else?",
            "isComplete": False,
        }),
    )
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )
    assert response.status_code == 200
    assert "?" in response.json()["response"]


def test_chat_template_mode_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    """isTemplateMode=True must be accepted and return 200."""
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory({
            "response": "Sure — which fields would you like to change? Effective date or party 2?",
            "isComplete": False,
        }),
    )
    response = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Change party 2 to Bob."}],
            "fields": {"documentType": "mutual-nda", "purpose": "Partnership evaluation."},
            "isTemplateMode": True,
        },
    )
    assert response.status_code == 200


def test_chat_template_mode_injects_system_message() -> None:
    """build_messages includes the template-mode instruction when isTemplateMode is True."""
    from models.chat import ChatMessage, ChatRequest, ChatResponse
    from services.chat_service import _TEMPLATE_MODE_INSTRUCTION, build_messages

    request = ChatRequest(
        messages=[ChatMessage(role="user", content="Change the date.")],
        fields=ChatResponse(documentType="mutual-nda"),
        isTemplateMode=True,
    )
    messages = build_messages(request)
    contents = [m["content"] for m in messages if m["role"] == "system"]
    assert any(_TEMPLATE_MODE_INSTRUCTION in c for c in contents)


def test_chat_no_template_mode_no_extra_message() -> None:
    """build_messages does NOT inject the template-mode instruction for normal sessions."""
    from models.chat import ChatMessage, ChatRequest
    from services.chat_service import _TEMPLATE_MODE_INSTRUCTION, build_messages

    request = ChatRequest(
        messages=[ChatMessage(role="user", content="I need an NDA.")],
        isTemplateMode=False,
    )
    messages = build_messages(request)
    contents = [m["content"] for m in messages if m["role"] == "system"]
    assert not any(_TEMPLATE_MODE_INSTRUCTION in c for c in contents)


def test_chat_snapshot_summary_includes_today() -> None:
    """snapshot_summary always includes today's date."""
    from datetime import date

    from services.chat_service import snapshot_summary

    today = date.today().isoformat()
    result = snapshot_summary(None)
    assert today in result


def test_chat_party_nested_object(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        chat_module,
        "acompletion",
        _fake_completion_factory({
            "response": "Got party 1 details. What about party 2?",
            "party1": {
                "name": "Alice Smith",
                "title": "CEO",
                "company": "Acme Corp",
                "noticeAddress": "alice@acme.com",
            },
            "isComplete": False,
        }),
    )
    response = client.post(
        "/api/chat",
        json={
            "messages": [{"role": "user", "content": "Party 1 is Alice Smith, CEO of Acme Corp."}],
            "fields": {"documentType": "mutual-nda"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["party1"]["name"] == "Alice Smith"
    assert body["party1"]["company"] == "Acme Corp"
