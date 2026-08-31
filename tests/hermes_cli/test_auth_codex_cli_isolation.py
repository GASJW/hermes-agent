"""Codex CLI credentials must never become implicit Hermes credentials."""

import json

import pytest

from hermes_cli.auth import AuthError, resolve_codex_runtime_credentials


def test_missing_hermes_auth_does_not_read_codex_cli_store(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    codex_home = tmp_path / "codex-cli"
    hermes_home.mkdir()
    codex_home.mkdir()

    hermes_store = {
        "version": 1,
        "providers": {
            "openai-codex": {
                "auth_mode": "chatgpt",
                "tokens": {"refresh_token": "hermes-refresh"},
            }
        },
        "credential_pool": {},
    }
    (hermes_home / "auth.json").write_text(
        json.dumps(hermes_store),
        encoding="utf-8",
    )
    (codex_home / "auth.json").write_text(
        json.dumps(
            {
                "tokens": {
                    "access_token": "codex-cli-access",
                    "refresh_token": "codex-cli-refresh",
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    monkeypatch.setenv("CODEX_HOME", str(codex_home))
    monkeypatch.setenv("HOME", str(tmp_path))

    with pytest.raises(AuthError) as exc:
        resolve_codex_runtime_credentials()

    assert exc.value.code == "codex_auth_missing_access_token"
    assert json.loads((hermes_home / "auth.json").read_text(encoding="utf-8")) == hermes_store
