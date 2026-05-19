"""Unit tests for the negentropy-perceives application entrypoint."""

import logging
from types import SimpleNamespace
from unittest.mock import patch

import negentropy.perceives.apps.app as app_module


class TestAppMain:
    """测试应用启动入口日志输出与参数透传。"""

    def test_main_logs_resolved_settings(self, caplog, monkeypatch):
        mock_settings = SimpleNamespace(
            server_name="negentropy-perceives",
            server_version="0.1.6.1",
            transport_mode="http",
            enable_javascript=False,
            use_random_user_agent=True,
            use_proxy=False,
            http_host="127.0.0.1",
            http_port=8082,
            http_path="/mcp",
            http_cors_origins="*",
            log_level="INFO",
        )

        app_calls = []

        def fake_run(**kwargs):
            app_calls.append(kwargs)

        monkeypatch.setattr(app_module, "settings", mock_settings)
        monkeypatch.setattr(app_module, "setup_logging", lambda level: None)
        monkeypatch.setattr(app_module.sys, "argv", ["negentropy-perceives"])

        mock_app = SimpleNamespace(run=fake_run)
        with patch.dict(
            "sys.modules", {"negentropy.perceives.tools": SimpleNamespace(app=mock_app)}
        ):
            # 清除已缓存的 tools 导入（若有），确保延迟导入使用 mock
            import sys

            for mod_name in list(sys.modules):
                if mod_name == "negentropy.perceives.tools":
                    sys.modules[mod_name] = SimpleNamespace(app=mock_app)

            with caplog.at_level(logging.INFO):
                app_module.main()

        assert "CLI entrypoint: negentropy-perceives" in caplog.text
        assert "server_name=negentropy-perceives" in caplog.text
        assert "port=8082" in caplog.text
        assert "Config sources:" in caplog.text

        # 验证 app.run() 调用参数包含 uvicorn_config
        assert len(app_calls) == 1
        call_kwargs = app_calls[0]
        assert call_kwargs["transport"] == "http"
        assert call_kwargs["host"] == "127.0.0.1"
        assert call_kwargs["port"] == 8082
        assert call_kwargs["path"] == "/mcp"
        assert "uvicorn_config" in call_kwargs
        assert "log_config" in call_kwargs["uvicorn_config"]
        assert call_kwargs["uvicorn_config"]["timeout_graceful_shutdown"] == 5
        assert call_kwargs.get("show_banner") is False

    def test_main_stdio_mode_no_uvicorn_config(self, caplog, monkeypatch):
        """STDIO 模式下不传入 uvicorn_config。"""
        mock_settings = SimpleNamespace(
            server_name="negentropy-perceives",
            server_version="0.2.0",
            transport_mode="stdio",
            enable_javascript=False,
            use_random_user_agent=True,
            use_proxy=False,
            http_host="localhost",
            http_port=2992,
            http_path="/mcp",
            http_cors_origins="*",
            log_level="INFO",
        )

        app_calls = []

        def fake_run(**kwargs):
            app_calls.append(kwargs)

        monkeypatch.setattr(app_module, "settings", mock_settings)
        monkeypatch.setattr(app_module, "setup_logging", lambda level: None)
        monkeypatch.setattr(app_module.sys, "argv", ["negentropy-perceives"])

        mock_app = SimpleNamespace(run=fake_run)
        with patch.dict(
            "sys.modules", {"negentropy.perceives.tools": SimpleNamespace(app=mock_app)}
        ):
            import sys

            for mod_name in list(sys.modules):
                if mod_name == "negentropy.perceives.tools":
                    sys.modules[mod_name] = SimpleNamespace(app=mock_app)

            with caplog.at_level(logging.INFO):
                app_module.main()

        assert "Starting STDIO server" in caplog.text
        assert len(app_calls) == 1
        # STDIO 模式下 app.run() 仅传 show_banner=False
        assert app_calls[0] == {"show_banner": False}
