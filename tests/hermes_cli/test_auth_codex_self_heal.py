"""Regression tests for Hermes-scoped Codex OAuth credentials."""

import json

import pytest

import hermes_cli.auth as auth
from hermes_cli.auth import AuthError, _refresh_codex_auth_tokens, resolve_codex_runtime_credentials

STALE = {"access_token": "stale-access", "refresh_token": "stale-refresh"}


def test_stale_refresh_token_requires_hermes_reauthentication(monkeypatch):
    """A rejected Hermes refresh must not adopt credentials from the CLI."""
    saved = {}
    def _rejected(*_a, **_k):
        raise AuthError(
            "refresh token rejected",
            provider="openai-codex",
            code="invalid_grant",
            relogin_required=True,
        )

    monkeypatch.setattr(auth, "refresh_codex_oauth_pure", _rejected)
    monkeypatch.setattr(auth, "_save_codex_tokens", lambda t, *a, **k: saved.update(t))

    with pytest.raises(AuthError) as exc:
        _refresh_codex_auth_tokens(STALE, 20.0)

    assert exc.value.code == "invalid_grant"
    assert saved == {}










def test_missing_singleton_access_token_requires_hermes_reauthentication(tmp_path, monkeypatch):
    """A malformed Hermes store must not be repaired from the CLI store."""
    hermes_home = tmp_path / "hermes"
    codex_home = tmp_path / "codex"
    hermes_home.mkdir()
    codex_home.mkdir()
    (hermes_home / "auth.json").write_text(json.dumps({
        "version": 1,
        "providers": {
            "openai-codex": {
                "tokens": {"refresh_token": "stale-refresh"},
                "last_refresh": "2026-06-01T00:00:00Z",
                "auth_mode": "chatgpt",
            },
        },
    }))
    (codex_home / "auth.json").write_text(json.dumps({
        "tokens": {
            "access_token": "fresh-access",
            "refresh_token": "fresh-refresh",
        },
    }))
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    monkeypatch.setenv("CODEX_HOME", str(codex_home))

    with pytest.raises(AuthError) as exc:
        resolve_codex_runtime_credentials()

    assert exc.value.code == "codex_auth_missing_access_token"
    stored = json.loads((hermes_home / "auth.json").read_text())
    tokens = stored["providers"]["openai-codex"]["tokens"]
    assert tokens == {"refresh_token": "stale-refresh"}
