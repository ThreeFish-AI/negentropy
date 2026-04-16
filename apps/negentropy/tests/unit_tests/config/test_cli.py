"""Tests for negentropy CLI commands (init, serve)."""

from __future__ import annotations

from unittest.mock import patch


class TestInitCommand:
    def test_init_creates_config(self, tmp_path, monkeypatch):
        """``negentropy init`` should copy default config to user dir."""
        from negentropy.config.yaml_loader import get_default_config_path

        user_dir = tmp_path / ".negentropy"
        user_file = user_dir / "config.yaml"

        with (
            patch("negentropy.config.yaml_loader.USER_CONFIG_DIR", user_dir),
            patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_file),
        ):
            from negentropy.cli import _cmd_init

            class Args:
                force = False

            ret = _cmd_init(Args())
            assert ret == 0
            assert user_file.is_file()

            # Content should match default
            default = get_default_config_path().read_text()
            assert user_file.read_text() == default

    def test_init_refuses_overwrite(self, tmp_path):
        """init without --force should refuse to overwrite."""
        user_dir = tmp_path / ".negentropy"
        user_dir.mkdir()
        user_file = user_dir / "config.yaml"
        user_file.write_text("existing")

        with (
            patch("negentropy.config.yaml_loader.USER_CONFIG_DIR", user_dir),
            patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_file),
        ):
            from negentropy.cli import _cmd_init

            class Args:
                force = False

            ret = _cmd_init(Args())
            assert ret == 1
            assert user_file.read_text() == "existing"

    def test_init_force_overwrites(self, tmp_path):
        """init --force should overwrite existing config."""
        user_dir = tmp_path / ".negentropy"
        user_dir.mkdir()
        user_file = user_dir / "config.yaml"
        user_file.write_text("old")

        with (
            patch("negentropy.config.yaml_loader.USER_CONFIG_DIR", user_dir),
            patch("negentropy.config.yaml_loader.USER_CONFIG_FILE", user_file),
        ):
            from negentropy.cli import _cmd_init

            class Args:
                force = True

            ret = _cmd_init(Args())
            assert ret == 0
            assert "old" not in user_file.read_text()


class TestServeCommand:
    def test_serve_rejects_missing_config(self, tmp_path):
        """serve with -c pointing to nonexistent file should fail."""
        from negentropy.cli import _cmd_serve

        class Args:
            config = str(tmp_path / "nonexistent.yaml")
            port = 6600
            host = "0.0.0.0"
            no_reload = False

        ret = _cmd_serve(Args())
        assert ret == 1
