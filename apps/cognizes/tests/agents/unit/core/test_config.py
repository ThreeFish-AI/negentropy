"""Unit tests for config module."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from cognizes.agents.config import Settings, settings


@pytest.mark.unit
class TestSettings:
    """Test cases for Settings class."""

    @pytest.fixture
    def temp_env_vars(self):
        """Temporary environment variables for testing."""
        original_env = {}
        test_env = {
            "DEBUG": "true",
            "LOG_LEVEL": "DEBUG",
            "API_HOST": "127.0.0.1",
            "API_PORT": "9000",
            "API_PREFIX": "/v1",
            "PAPERS_DIR": "test_papers",
            "MAX_UPLOAD_SIZE": "100",
            "ANTHROPIC_API_KEY": "test-key-123",
            "ANTHROPIC_BASE_URL": "https://test.api.example.com",
            "BATCH_SIZE": "20",
            "PARALLEL_TASKS": "5",
            "EXTRACT_IMAGES": "false",
            "EXTRACT_TABLES": "false",
            "EXTRACT_FORMULAS": "false",
            "TARGET_LANGUAGE": "en",
            "PRESERVE_FORMAT": "false",
            "TRANSLATION_BATCH_SIZE": "10000",
            "WS_HEARTBEAT_INTERVAL": "60",
            "WS_CONNECTION_TIMEOUT": "1200",
            "DATABASE_URL": "sqlite:///test.db",
            "REDIS_URL": "redis://localhost:6379",
            "SECRET_KEY": "test-secret-key",
            "ACCESS_TOKEN_EXPIRE_MINUTES": "60",
            "CORS_ORIGINS": "http://localhost:9003,http://localhost:8080",
            "LOG_DIR": "test_logs",
            "LOG_MAX_SIZE": "20",
            "LOG_BACKUP_COUNT": "10",
        }

        # Save original env vars
        for key in test_env:
            original_env[key] = os.environ.get(key)
            os.environ[key] = test_env[key]

        yield test_env

        # Restore original env vars
        for key, value in original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_settings_default_values(self):
        """Test Settings with default values."""
        # The Settings class reads environment vars at instantiation time,
        # so we patch the environment for specific tests
        # Test with clean environment (no env vars)
        import os
        from unittest.mock import patch

        from cognizes.agents.config import Settings

        with patch.dict(os.environ, {}, clear=True):
            s = Settings()

        # Test that defaults are reasonable values
        assert isinstance(s.DEBUG, bool)
        assert isinstance(s.LOG_LEVEL, str)
        assert isinstance(s.API_HOST, str)
        assert isinstance(s.API_PORT, int)
        assert isinstance(s.PAPERS_DIR, str)
        # Check actual default values (may be affected by environment)
        assert s.LOG_LEVEL == "INFO"
        assert s.API_HOST == "0.0.0.0"
        assert s.API_PORT == 8000
        assert s.API_PREFIX == "/api"
        assert s.PAPERS_DIR == "papers"
        assert s.MAX_UPLOAD_SIZE == 50 * 1024 * 1024
        assert s.ANTHROPIC_API_KEY == ""
        assert s.ANTHROPIC_BASE_URL == ""
        assert s.WORKFLOW_CONFIG["papers_dir"] == "papers"
        assert s.WORKFLOW_CONFIG["batch_size"] == 10
        assert s.WORKFLOW_CONFIG["parallel_tasks"] == 3
        assert s.PDF_CONFIG["extract_images"] is True
        assert s.PDF_CONFIG["extract_tables"] is True
        assert s.PDF_CONFIG["extract_formulas"] is True
        assert s.TRANSLATION_CONFIG["target_language"] == "zh"
        assert s.TRANSLATION_CONFIG["preserve_format"] is True
        assert s.TRANSLATION_CONFIG["batch_size"] == 5000
        assert s.WS_HEARTBEAT_INTERVAL == 30
        assert s.WS_CONNECTION_TIMEOUT == 600
        assert s.DATABASE_URL is None
        assert s.REDIS_URL is None
        assert s.SECRET_KEY == "your-secret-key-change-this"
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 30
        assert isinstance(s.CORS_ORIGINS, list)
        assert "http://localhost:9003" in s.CORS_ORIGINS
        assert s.LOG_DIR == "logs"
        assert s.LOG_FILE == "logs/app.log"
        assert s.LOG_MAX_SIZE == 10 * 1024 * 1024
        assert s.LOG_BACKUP_COUNT == 5

    def test_settings_with_env_vars(self, temp_env_vars):
        """Test Settings with environment variables."""
        # Clear environment and set test values
        with patch.dict(os.environ, {}, clear=True):
            for key, value in temp_env_vars.items():
                os.environ[key] = value

            s = Settings()

            assert s.DEBUG is True
            assert s.LOG_LEVEL == "DEBUG"
            assert s.API_HOST == "127.0.0.1"
            assert s.API_PORT == 9000
            assert s.API_PREFIX == "/v1"
            assert s.PAPERS_DIR == "test_papers"
            assert s.MAX_UPLOAD_SIZE == 100 * 1024 * 1024
            assert s.ANTHROPIC_API_KEY == "test-key-123"
            assert s.ANTHROPIC_BASE_URL == "https://test.api.example.com"
            assert s.WORKFLOW_CONFIG["batch_size"] == 20
            assert s.WORKFLOW_CONFIG["parallel_tasks"] == 5
            assert s.PDF_CONFIG["extract_images"] is False
            assert s.PDF_CONFIG["extract_tables"] is False
            assert s.PDF_CONFIG["extract_formulas"] is False
            assert s.TRANSLATION_CONFIG["target_language"] == "en"
            assert s.TRANSLATION_CONFIG["preserve_format"] is False
            assert s.TRANSLATION_CONFIG["batch_size"] == 10000
            assert s.WS_HEARTBEAT_INTERVAL == 60
            assert s.WS_CONNECTION_TIMEOUT == 1200
            assert s.DATABASE_URL == "sqlite:///test.db"
            assert s.REDIS_URL == "redis://localhost:6379"
            assert s.SECRET_KEY == "test-secret-key"
            assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 60
            assert s.CORS_ORIGINS == ["http://localhost:9003", "http://localhost:8080"]
            assert s.LOG_DIR == "test_logs"
            assert s.LOG_FILE == "test_logs/app.log"
            assert s.LOG_MAX_SIZE == 20 * 1024 * 1024
            assert s.LOG_BACKUP_COUNT == 10

    def test_settings_boolean_conversion(self):
        """Test boolean environment variable conversion."""
        test_cases = [
            ("true", True),
            ("True", True),
            ("TRUE", True),
            ("false", False),
            ("False", False),
            ("FALSE", False),
            ("", False),
            ("other", False),
        ]

        for value, expected in test_cases:
            # Save original
            original_debug = os.environ.get("DEBUG")
            try:
                os.environ["DEBUG"] = value
                s = Settings()
                assert s.DEBUG == expected, f"Failed for value: {value}"
            finally:
                # Restore
                if original_debug is None:
                    os.environ.pop("DEBUG", None)
                else:
                    os.environ["DEBUG"] = original_debug

    def test_settings_integer_conversion(self):
        """Test integer environment variable conversion."""
        test_cases = [
            ("8000", 8000),
            ("0", 0),
            ("-1", -1),
            ("100", 100),
        ]

        for value, expected in test_cases:
            # Save original
            original_port = os.environ.get("API_PORT")
            try:
                os.environ["API_PORT"] = value
                s = Settings()
                assert s.API_PORT == expected, f"Failed for value: {value}"
            finally:
                # Restore
                if original_port is None:
                    os.environ.pop("API_PORT", None)
                else:
                    os.environ["API_PORT"] = original_port

    def test_settings_integer_conversion_invalid(self):
        """Test integer conversion with invalid values."""
        with patch.dict(os.environ, {"API_PORT": "invalid"}):
            with pytest.raises(ValueError):
                from importlib import reload

                from cognizes.agents import config

                reload(config)

                Settings()

    def test_papers_path_property(self):
        """Test papers_path property."""
        # Save original
        original_papers_dir = os.environ.get("PAPERS_DIR")
        try:
            os.environ["PAPERS_DIR"] = "test_papers"
            s = Settings()
            assert isinstance(s.papers_path, Path)
            assert str(s.papers_path) == "test_papers"
        finally:
            # Restore
            if original_papers_dir is None:
                os.environ.pop("PAPERS_DIR", None)
            else:
                os.environ["PAPERS_DIR"] = original_papers_dir

    def test_log_path_property(self):
        """Test log_path property."""
        # Save original
        original_log_dir = os.environ.get("LOG_DIR")
        try:
            os.environ["LOG_DIR"] = "test_logs"
            s = Settings()
            assert isinstance(s.log_path, Path)
            assert str(s.log_path) == "test_logs"
        finally:
            # Restore
            if original_log_dir is None:
                os.environ.pop("LOG_DIR", None)
            else:
                os.environ["LOG_DIR"] = original_log_dir

    def test_workflow_config_uses_papers_dir(self):
        """Test WORKFLOW_CONFIG uses PAPERS_DIR."""
        # Save original
        original_papers_dir = os.environ.get("PAPERS_DIR")
        try:
            os.environ["PAPERS_DIR"] = "custom_papers"
            s = Settings()
            assert s.WORKFLOW_CONFIG["papers_dir"] == "custom_papers"
        finally:
            # Restore
            if original_papers_dir is None:
                os.environ.pop("PAPERS_DIR", None)
            else:
                os.environ["PAPERS_DIR"] = original_papers_dir

    def test_pdf_config_uses_papers_dir(self):
        """Test PDF_CONFIG uses PAPERS_DIR."""
        # Save original
        original_papers_dir = os.environ.get("PAPERS_DIR")
        try:
            os.environ["PAPERS_DIR"] = "pdf_storage"
            s = Settings()
            assert s.PDF_CONFIG["papers_dir"] == "pdf_storage"
        finally:
            # Restore
            if original_papers_dir is None:
                os.environ.pop("PAPERS_DIR", None)
            else:
                os.environ["PAPERS_DIR"] = original_papers_dir

    def test_cors_origins_single_value(self):
        """Test CORS_ORIGINS with single value."""
        # Save original
        original_cors = os.environ.get("CORS_ORIGINS")
        try:
            os.environ["CORS_ORIGINS"] = "http://example.com"
            s = Settings()
            assert s.CORS_ORIGINS == ["http://example.com"]
        finally:
            # Restore
            if original_cors is None:
                os.environ.pop("CORS_ORIGINS", None)
            else:
                os.environ["CORS_ORIGINS"] = original_cors

    def test_cors_origins_multiple_values(self):
        """Test CORS_ORIGINS with multiple values."""
        origins = "http://localhost:9003,https://example.com,http://test.com"
        with patch.dict(os.environ, {"CORS_ORIGINS": origins}):
            from importlib import reload

            from cognizes.agents import config

            reload(config)

            s = Settings()
            assert s.CORS_ORIGINS == [
                "http://localhost:9003",
                "https://example.com",
                "http://test.com",
            ]

    def test_cors_origins_with_whitespace(self):
        """Test CORS_ORIGINS with whitespace."""
        origins = " http://localhost:9003 , https://example.com "
        with patch.dict(os.environ, {"CORS_ORIGINS": origins}):
            from importlib import reload

            from cognizes.agents import config

            reload(config)

            s = Settings()
            # Note: The current implementation doesn't strip whitespace
            assert s.CORS_ORIGINS == [
                " http://localhost:9003 ",
                " https://example.com ",
            ]

    def test_max_upload_size_calculation(self):
        """Test MAX_UPLOAD_SIZE calculation."""
        with patch.dict(os.environ, {"MAX_UPLOAD_SIZE": "100"}):
            from importlib import reload

            from cognizes.agents import config

            reload(config)

            s = Settings()
            assert s.MAX_UPLOAD_SIZE == 100 * 1024 * 1024

    def test_log_file_path_construction(self):
        """Test LOG_FILE path construction."""
        with patch.dict(os.environ, {"LOG_DIR": "custom_logs"}):
            from importlib import reload

            from cognizes.agents import config

            reload(config)

            s = Settings()
            assert s.LOG_FILE == "custom_logs/app.log"

    def test_log_max_size_calculation(self):
        """Test LOG_MAX_SIZE calculation."""
        with patch.dict(os.environ, {"LOG_MAX_SIZE": "20"}):
            from importlib import reload

            from cognizes.agents import config

            reload(config)

            s = Settings()
            assert s.LOG_MAX_SIZE == 20 * 1024 * 1024

    def test_global_settings_instance(self):
        """Test global settings instance."""
        assert isinstance(settings, Settings)
        # Should have default attributes
        assert hasattr(settings, "DEBUG")
        assert hasattr(settings, "API_HOST")
        assert hasattr(settings, "API_PORT")
        assert hasattr(settings, "papers_path")
        assert hasattr(settings, "log_path")

    def test_settings_immutable_config(self):
        """Test that config dictionaries are properly set."""
        with patch.dict(os.environ, {}, clear=True):
            from importlib import reload

            from cognizes.agents import config

            reload(config)

            s = Settings()

            # Check config dictionaries exist and have expected keys
            assert "papers_dir" in s.WORKFLOW_CONFIG
            assert "batch_size" in s.WORKFLOW_CONFIG
            assert "parallel_tasks" in s.WORKFLOW_CONFIG

            assert "papers_dir" in s.PDF_CONFIG
            assert "extract_images" in s.PDF_CONFIG
            assert "extract_tables" in s.PDF_CONFIG
            assert "extract_formulas" in s.PDF_CONFIG

            assert "target_language" in s.TRANSLATION_CONFIG
            assert "preserve_format" in s.TRANSLATION_CONFIG
            assert "batch_size" in s.TRANSLATION_CONFIG

    def test_load_dotenv_not_called_in_test(self):
        """Test that load_dotenv behavior is handled."""
        # Since load_dotenv is called at module level, we just verify
        # the Settings class works regardless
        s = Settings()
        assert hasattr(s, "DEBUG")
        assert isinstance(s.DEBUG, bool)

    def test_environment_variable_priority(self):
        """Test that environment variables take priority."""
        # Save originals
        original_port = os.environ.get("API_PORT")
        original_papers = os.environ.get("PAPERS_DIR")

        try:
            # Set test values
            os.environ["API_PORT"] = "9000"
            os.environ["PAPERS_DIR"] = "test"

            s = Settings()

            # Check that the values are read
            assert isinstance(s.API_PORT, int)
            assert s.PAPERS_DIR == "test"
            # And configs that use PAPERS_DIR should use the value
            assert s.WORKFLOW_CONFIG["papers_dir"] == "test"
            assert s.PDF_CONFIG["papers_dir"] == "test"
        finally:
            # Restore
            if original_port is None:
                os.environ.pop("API_PORT", None)
            else:
                os.environ["API_PORT"] = original_port
            if original_papers is None:
                os.environ.pop("PAPERS_DIR", None)
            else:
                os.environ["PAPERS_DIR"] = original_papers
