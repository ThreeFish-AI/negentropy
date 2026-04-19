"""Tests for YAML configuration loading, deep merge, and priority semantics."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from negentropy.config._base import get_yaml_section, reset_sections, set_yaml_section
from negentropy.config.yaml_loader import (
    deep_merge,
    get_default_config_path,
    get_yaml_file_paths,
    load_merged_yaml_config,
    reset_cache,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _clean_caches():
    """Reset caches and section registry between tests."""
    reset_cache()
    reset_sections()
    yield
    reset_cache()
    reset_sections()


# ---------------------------------------------------------------------------
# deep_merge
# ---------------------------------------------------------------------------


class TestDeepMerge:
    def test_flat_override(self):
        assert deep_merge({"a": 1, "b": 2}, {"b": 3, "c": 4}) == {"a": 1, "b": 3, "c": 4}

    def test_nested_merge(self):
        base = {"db": {"url": "default", "pool_size": 5}}
        override = {"db": {"pool_size": 10}}
        assert deep_merge(base, override) == {"db": {"url": "default", "pool_size": 10}}

    def test_nested_new_key(self):
        assert deep_merge({"db": {"url": "default"}}, {"db": {"echo": True}}) == {
            "db": {"url": "default", "echo": True},
        }

    def test_no_mutation(self):
        base = {"x": {"y": 1}}
        override = {"x": {"z": 2}}
        deep_merge(base, override)
        assert base == {"x": {"y": 1}}  # not mutated


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------


class TestPathResolution:
    def test_default_config_exists(self):
        path = get_default_config_path()
        assert path.is_file()
        assert path.name == "config.default.yaml"

    def test_default_config_is_valid_yaml(self):
        import yaml

        path = get_default_config_path()
        with open(path) as f:
            data = yaml.safe_load(f)
        assert isinstance(data, dict)
        assert "database" in data
        assert "logging" in data

    def test_yaml_file_paths_includes_default(self):
        paths = get_yaml_file_paths()
        assert len(paths) >= 1
        assert any(p.name == "config.default.yaml" for p in paths)

    def test_user_config_included_when_exists(self, tmp_path):
        user_yaml = tmp_path / "config.yaml"
        user_yaml.write_text("app:\n  name: test\n")
        with patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_yaml):
            paths = get_yaml_file_paths()
            assert user_yaml in paths

    def test_cli_config_via_env_var(self, tmp_path, monkeypatch):
        cli_yaml = tmp_path / "custom.yaml"
        cli_yaml.write_text("logging:\n  level: DEBUG\n")
        monkeypatch.setenv("NE_CONFIG_PATH", str(cli_yaml))
        paths = get_yaml_file_paths()
        assert cli_yaml in paths


# ---------------------------------------------------------------------------
# Merged config loading
# ---------------------------------------------------------------------------


class TestMergedConfig:
    def test_load_default_only(self):
        config = load_merged_yaml_config()
        assert config["database"]["pool_size"] == 5
        assert config["logging"]["level"] == "INFO"

    def test_user_overrides_default(self, tmp_path):
        user_yaml = tmp_path / "config.yaml"
        user_yaml.write_text("database:\n  pool_size: 99\n")
        with patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_yaml):
            config = load_merged_yaml_config()
            assert config["database"]["pool_size"] == 99
            # Other defaults preserved
            assert config["database"]["max_overflow"] == 10

    def test_cli_overrides_user(self, tmp_path, monkeypatch):
        user_yaml = tmp_path / "config.yaml"
        user_yaml.write_text("database:\n  pool_size: 50\n")
        cli_yaml = tmp_path / "cli.yaml"
        cli_yaml.write_text("database:\n  pool_size: 42\n")

        with (
            patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_yaml),
            monkeypatch.context() as m,
        ):
            m.setenv("NE_CONFIG_PATH", str(cli_yaml))
            config = load_merged_yaml_config()
            assert config["database"]["pool_size"] == 42

    def test_deep_merge_nested(self, tmp_path):
        user_yaml = tmp_path / "config.yaml"
        user_yaml.write_text(
            "knowledge:\n  default_extractor_routes:\n    url:\n      primary:\n        server_name: custom-server\n"
        )
        with patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_yaml):
            config = load_merged_yaml_config()
            routes = config["knowledge"]["default_extractor_routes"]
            assert routes["url"]["primary"]["server_name"] == "custom-server"
            # Other nested defaults preserved
            assert routes["url"]["primary"]["tool_name"] == "parse_webpage_to_markdown"


# ---------------------------------------------------------------------------
# Section registry
# ---------------------------------------------------------------------------


class TestSectionRegistry:
    def test_set_and_get(self):
        set_yaml_section("test", {"key": "value"})
        assert get_yaml_section("test") == {"key": "value"}

    def test_missing_section_returns_empty(self):
        assert get_yaml_section("nonexistent") == {}

    def test_reset_clears_all(self):
        set_yaml_section("a", {"x": 1})
        reset_sections()
        assert get_yaml_section("a") == {}


# ---------------------------------------------------------------------------
# Integration: Settings loads YAML values
# ---------------------------------------------------------------------------


class TestSettingsIntegration:
    def test_settings_reads_default_yaml(self):
        """Verify the global settings singleton reads from config.default.yaml."""
        from negentropy.config import settings

        # These values match config.default.yaml defaults
        assert settings.database.pool_size == 5
        assert settings.logging.level.value == "INFO"
        assert settings.services.credential_backend.value == "inmemory"

    def test_env_var_overrides_yaml(self, monkeypatch):
        """Environment variables must take precedence over YAML values."""
        monkeypatch.setenv("NE_DB_POOL_SIZE", "42")
        reset_cache()
        reset_sections()

        from negentropy.config import Settings

        s = Settings()
        assert s.database.pool_size == 42

    def test_yaml_override_user_config(self, tmp_path):
        """User YAML overrides package defaults."""
        user_yaml = tmp_path / "config.yaml"
        user_yaml.write_text("database:\n  pool_size: 20\n")

        with patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_yaml):
            reset_cache()
            reset_sections()

            from negentropy.config import Settings

            s = Settings()
            assert s.database.pool_size == 20
            # Other defaults preserved
            assert s.database.max_overflow == 10


# ---------------------------------------------------------------------------
# Nested env delimiter & environment section structure
# ---------------------------------------------------------------------------


class TestEnvNestedDelimiter:
    """`env_nested_delimiter="__"` 允许通过扁平环境变量覆盖深层嵌套字段。"""

    def test_env_nested_delimiter_override(self, monkeypatch):
        monkeypatch.setenv(
            "NE_KNOWLEDGE_DEFAULT_EXTRACTOR_ROUTES__URL__PRIMARY__TIMEOUT_MS",
            "90000",
        )
        reset_cache()
        reset_sections()

        from negentropy.config import Settings

        s = Settings()
        assert s.knowledge.default_extractor_routes.url.primary.timeout_ms == 90000


class TestEnvironmentSectionStructure:
    """`environment.env` 为规范结构；顶级 `env:` 保留向后兼容回退。"""

    def test_new_environment_section(self, tmp_path):
        user_yaml = tmp_path / "config.yaml"
        user_yaml.write_text("environment:\n  env: production\n")

        with patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_yaml):
            reset_cache()
            reset_sections()

            from negentropy.config import Settings

            s = Settings()
            assert s.environment.env == "production"

    def test_legacy_top_level_env_still_works(self, tmp_path):
        user_yaml = tmp_path / "config.yaml"
        user_yaml.write_text("env: staging\n")

        with patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_yaml):
            reset_cache()
            reset_sections()

            from negentropy.config import Settings

            s = Settings()
            assert s.environment.env == "staging"
