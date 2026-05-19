"""
单元测试：配置管理模块
测试 negentropy.perceives.config 模块的配置加载、验证和使用
"""

import os
from pathlib import Path
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from negentropy.perceives import __version__
from negentropy.perceives.config import (
    NegentropyPerceivesSettings,
    _flatten_nested_yaml,
    _get_user_config_path,
    _load_bundled_yaml,
    _load_yaml_file,
    build_settings,
    deep_merge,
    describe_config_sources,
    reload_settings,
    settings,
)


class TestNegentropyPerceivesSettings:
    """测试配置设置类"""

    def test_default_settings(self):
        """测试默认配置值"""
        config = NegentropyPerceivesSettings()

        # 测试默认值（考虑环境变量覆盖）
        assert config.server_name == "negentropy-perceives"
        assert config.server_version == __version__
        assert config.enable_javascript is False
        assert config.concurrent_requests == 16
        assert config.request_timeout == 30.0
        assert config.rate_limit_requests_per_minute == 60
        assert config.max_retries == 3
        assert config.retry_delay == 1.0
        assert config.browser_timeout == 30
        assert config.browser_headless is True

    def test_environment_variable_loading(self):
        """测试环境变量加载"""
        env_vars = {
            "NEGENTROPY_PERCEIVES_SERVER_NAME": "Custom Server",
            "NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT": "true",
            "NEGENTROPY_PERCEIVES_CONCURRENT_REQUESTS": "32",
            "NEGENTROPY_PERCEIVES_REQUEST_TIMEOUT": "60.0",
            "NEGENTROPY_PERCEIVES_RATE_LIMIT_REQUESTS_PER_MINUTE": "120",
            "NEGENTROPY_PERCEIVES_MAX_RETRIES": "5",
            "NEGENTROPY_PERCEIVES_BROWSER_HEADLESS": "false",
        }

        with patch.dict(os.environ, env_vars):
            config = NegentropyPerceivesSettings()

            assert config.server_name == "Custom Server"
            assert config.enable_javascript is True
            assert config.concurrent_requests == 32
            assert config.request_timeout == 60.0
            assert config.rate_limit_requests_per_minute == 120
            assert config.max_retries == 5
            assert config.browser_headless is False

    def test_boolean_environment_variables(self):
        """测试布尔型环境变量的解析"""
        # 测试各种布尔值表示
        boolean_test_cases = [
            ("true", True),
            ("True", True),
            ("TRUE", True),
            ("1", True),
            ("yes", True),
            ("false", False),
            ("False", False),
            ("FALSE", False),
            ("0", False),
            ("no", False),
        ]

        for env_value, expected_value in boolean_test_cases:
            with patch.dict(
                os.environ, {"NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT": env_value}
            ):
                config = NegentropyPerceivesSettings()
                assert config.enable_javascript is expected_value, (
                    f"Failed for {env_value}"
                )

    def test_numeric_validation(self):
        """测试数值型配置的验证"""
        # 测试有效的数值
        valid_configs = [
            {"concurrent_requests": 1},
            {"concurrent_requests": 100},
            {"request_timeout": 0.1},
            {"request_timeout": 300.0},
            {"rate_limit_requests_per_minute": 1},
            {"max_retries": 0},
            {"max_retries": 10},
        ]

        for config_data in valid_configs:
            config = NegentropyPerceivesSettings(**config_data)
            assert config is not None

        # 测试无效的数值
        invalid_configs = [
            {"concurrent_requests": 0},  # 必须大于0
            {"concurrent_requests": -1},  # 不能为负数
            {"request_timeout": -1.0},  # 不能为负数
            {"rate_limit_requests_per_minute": -1},  # 不能为负数
            {"max_retries": -1},  # 不能为负数
        ]

        for config_data in invalid_configs:
            with pytest.raises(ValidationError):
                NegentropyPerceivesSettings(**config_data)

    def test_proxy_configuration(self):
        """测试代理配置"""
        # 无代理配置
        config = NegentropyPerceivesSettings(use_proxy=False)
        assert config.use_proxy is False
        assert config.proxy_url is None

        # 有代理配置
        proxy_url = "http://proxy.example.com:8080"
        config = NegentropyPerceivesSettings(use_proxy=True, proxy_url=proxy_url)
        assert config.use_proxy is True
        assert config.proxy_url == proxy_url

    def test_user_agent_configuration(self):
        """测试User-Agent配置"""
        # 随机User-Agent
        config = NegentropyPerceivesSettings(use_random_user_agent=True)
        assert config.use_random_user_agent is True
        assert config.default_user_agent is not None

        # 固定User-Agent
        custom_ua = "Custom Bot 1.0"
        config = NegentropyPerceivesSettings(
            use_random_user_agent=False, default_user_agent=custom_ua
        )
        assert config.use_random_user_agent is False
        assert config.default_user_agent == custom_ua

    def test_logging_configuration(self):
        """测试日志配置"""
        config = NegentropyPerceivesSettings(
            log_level="DEBUG", log_requests=True, log_responses=False
        )

        assert config.log_level == "DEBUG"
        assert config.log_requests is True
        assert config.log_responses is False

    def test_browser_configuration(self):
        """测试浏览器配置"""
        config = NegentropyPerceivesSettings(
            browser_timeout=60, browser_headless=False, browser_window_size="1920x1080"
        )

        assert config.browser_timeout == 60
        assert config.browser_headless is False
        assert config.browser_window_size == "1920x1080"


class TestGlobalSettings:
    """测试全局设置实例"""

    def test_global_settings_instance(self):
        """测试全局settings实例"""
        assert settings is not None
        assert isinstance(settings, NegentropyPerceivesSettings)
        assert settings.server_name is not None
        assert settings.server_version is not None

    def test_settings_immutability(self):
        """测试设置的不可变性（一旦创建就固定）"""
        original_name = settings.server_name

        # 不应该能直接修改settings
        with pytest.raises(ValidationError):
            settings.server_name = "Modified Name"

        # 验证值没有被修改
        assert settings.server_name == original_name

    @patch.dict(os.environ, {"NEGENTROPY_PERCEIVES_SERVER_NAME": "Test Server"})
    def test_settings_environment_override(self):
        """测试环境变量覆盖设置"""
        # 重新导入以获取新的设置
        from importlib import reload

        import negentropy.perceives.config

        reload(negentropy.perceives.config)

        assert negentropy.perceives.config.settings.server_name == "Test Server"


class TestConfigurationValidation:
    """测试配置验证逻辑"""

    def test_timeout_validation(self):
        """测试超时配置验证"""
        # 有效超时配置
        valid_timeouts = [0.1, 1.0, 30.0, 300.0]
        for timeout in valid_timeouts:
            config = NegentropyPerceivesSettings(
                request_timeout=timeout, browser_timeout=int(timeout)
            )
            assert config.request_timeout == timeout

        # 无效超时配置
        with pytest.raises(ValidationError):
            NegentropyPerceivesSettings(request_timeout=-1.0)

        with pytest.raises(ValidationError):
            NegentropyPerceivesSettings(browser_timeout=-1)

    def test_concurrency_validation(self):
        """测试并发配置验证"""
        # 有效并发配置
        valid_values = [1, 8, 16, 32, 64]
        for value in valid_values:
            config = NegentropyPerceivesSettings(concurrent_requests=value)
            assert config.concurrent_requests == value

        # 无效并发配置
        invalid_values = [0, -1, -10]
        for value in invalid_values:
            with pytest.raises(ValidationError):
                NegentropyPerceivesSettings(concurrent_requests=value)

    def test_rate_limit_validation(self):
        """测试速率限制配置验证"""
        # 有效速率限制
        valid_rates = [1, 60, 120, 1000]
        for rate in valid_rates:
            config = NegentropyPerceivesSettings(rate_limit_requests_per_minute=rate)
            assert config.rate_limit_requests_per_minute == rate

        # 无效速率限制
        with pytest.raises(ValidationError):
            NegentropyPerceivesSettings(rate_limit_requests_per_minute=-1)

    def test_retry_configuration_validation(self):
        """测试重试配置验证"""
        # 有效重试配置
        config = NegentropyPerceivesSettings(max_retries=5, retry_delay=2.0)
        assert config.max_retries == 5
        assert config.retry_delay == 2.0

        # 边界情况
        config = NegentropyPerceivesSettings(max_retries=0)  # 0次重试应该有效
        assert config.max_retries == 0

        # 无效重试配置
        with pytest.raises(ValidationError):
            NegentropyPerceivesSettings(max_retries=-1)

        with pytest.raises(ValidationError):
            NegentropyPerceivesSettings(retry_delay=-1.0)


class TestConfigurationIntegration:
    """测试配置集成和实际使用"""

    def test_scrapy_settings_generation(self):
        """测试Scrapy设置生成"""
        config = NegentropyPerceivesSettings(
            concurrent_requests=32,
            request_timeout=60.0,
            use_random_user_agent=True,
            default_user_agent="Custom Bot",
        )

        # 验证配置可以用于Scrapy设置
        assert config.concurrent_requests > 0
        assert config.request_timeout > 0
        assert config.default_user_agent is not None

    def test_browser_settings_generation(self):
        """测试浏览器设置生成"""
        config = NegentropyPerceivesSettings(
            browser_timeout=45, browser_headless=True, browser_window_size="1366x768"
        )

        # 验证浏览器配置的有效性
        assert config.browser_timeout > 0
        assert isinstance(config.browser_headless, bool)
        assert "x" in config.browser_window_size  # 窗口尺寸格式

    def test_proxy_settings_integration(self):
        """测试代理设置集成"""
        config = NegentropyPerceivesSettings(
            use_proxy=True, proxy_url="http://proxy.example.com:8080"
        )

        if config.use_proxy:
            assert config.proxy_url is not None
            assert config.proxy_url.startswith("http")

    def test_logging_settings_integration(self):
        """测试日志设置集成"""
        valid_log_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

        for level in valid_log_levels:
            config = NegentropyPerceivesSettings(
                log_level=level, log_requests=True, log_responses=True
            )
            assert config.log_level == level
            assert isinstance(config.log_requests, bool)
            assert isinstance(config.log_responses, bool)


class TestConfigurationEdgeCases:
    """测试配置边界情况和异常处理"""

    def test_missing_environment_variables(self):
        """测试环境变量缺失时的处理"""
        # 清空相关环境变量
        _env_vars_to_clear = [
            "NEGENTROPY_PERCEIVES_SERVER_NAME",
            "NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT",
            "NEGENTROPY_PERCEIVES_CONCURRENT_REQUESTS",
        ]

        with patch.dict(os.environ, {}, clear=True):
            config = NegentropyPerceivesSettings()
            # 应该使用默认值
            assert config.server_name == "negentropy-perceives"
            assert config.enable_javascript is False
            assert config.concurrent_requests == 16

    def test_invalid_environment_variable_types(self):
        """测试无效环境变量类型处理"""
        invalid_env_vars = {
            "NEGENTROPY_PERCEIVES_CONCURRENT_REQUESTS": "not-a-number",
            "NEGENTROPY_PERCEIVES_REQUEST_TIMEOUT": "invalid-float",
            "NEGENTROPY_PERCEIVES_ENABLE_JAVASCRIPT": "maybe",
        }

        with patch.dict(os.environ, invalid_env_vars):
            # 应该处理无效值并使用默认值或抛出异常
            with pytest.raises((ValidationError, ValueError)):
                NegentropyPerceivesSettings()

    def test_extreme_configuration_values(self):
        """测试极端配置值"""
        # 最小值
        config = NegentropyPerceivesSettings(
            concurrent_requests=1,
            request_timeout=0.1,
            rate_limit_requests_per_minute=1,
            max_retries=0,
            retry_delay=0.1,
        )
        assert config is not None

        # 大值（但合理）
        config = NegentropyPerceivesSettings(
            concurrent_requests=1000,
            request_timeout=3600.0,
            rate_limit_requests_per_minute=10000,
            max_retries=100,
            retry_delay=60.0,
        )
        assert config is not None


class TestDescribeConfigSources:
    """测试启动诊断信息"""

    def test_describe_config_sources_returns_string(self):
        """诊断信息始终返回字符串"""
        result = describe_config_sources()
        assert isinstance(result, str)
        assert len(result) > 0

    def test_describe_config_sources_contains_bundled_default(self):
        """诊断信息应包含内置默认配置相关描述"""
        result = describe_config_sources()
        assert "bundled" in result.lower()  # 始终包含内置默认
        # 有用户配置时返回 "Loaded: ..."，无配置时提及 "environment"
        assert "loaded" in result.lower() or "environment" in result.lower()

    def test_describe_config_sources_with_custom_path(self):
        """显式指定配置路径时应在诊断信息中体现（跨平台路径规范化）"""
        expected_path = str(Path("/tmp/my-config.yaml").resolve())
        result = describe_config_sources(config_path="/tmp/my-config.yaml")
        assert "custom-config" in result
        assert expected_path in result


# ============================================================
# Deep Merge 工具函数测试
# ============================================================
class TestDeepMerge:
    """测试 deep_merge 工具函数。"""

    def test_scalar_override(self):
        """标量值覆盖：override 直接替换 base 的同名标量。"""
        base = {"a": 1, "b": 2}
        override = {"a": 10}
        result = deep_merge(base, override)
        assert result == {"a": 10, "b": 2}

    def test_nested_dict_merge(self):
        """嵌套字典递归合并：仅覆盖差异键，保留未提及的 base 键。"""
        base = {"server": {"host": "localhost", "port": 8080}, "debug": False}
        override = {"server": {"port": 9000}}
        result = deep_merge(base, override)
        assert result["server"]["host"] == "localhost"  # 来自 base
        assert result["server"]["port"] == 9000  # 来自 override
        assert result["debug"] is False  # 来自 base

    def test_list_replacement(self):
        """列表值整体替换：不逐元素合并。"""
        base = {"items": ["a", "b"]}
        override = {"items": ["c"]}
        result = deep_merge(base, override)
        assert result["items"] == ["c"]

    def test_none_skips_base(self):
        """override 中值为 None 的键：跳过，保留 base 原值。"""
        base = {"a": 1, "b": 2}
        override = {"a": None, "c": 3}
        result = deep_merge(base, override)
        assert result["a"] == 1  # base 值保留
        assert result["b"] == 2  # base 值保留
        assert result["c"] == 3  # 新增键正常

    def test_empty_override_returns_base_copy(self):
        """空 override 返回 base 的浅拷贝。"""
        base = {"a": 1, "b": 2}
        result = deep_merge(base, {})
        assert result == base
        assert result is not base  # 确保是拷贝

    def test_empty_base_with_override(self):
        """空 base 被 override 完全填充。"""
        result = deep_merge({}, {"a": 1, "nested": {"x": 2}})
        assert result == {"a": 1, "nested": {"x": 2}}

    def test_deeply_nested_structure(self):
        """三层以上嵌套结构的正确合并。"""
        base = {"level1": {"level2": {"level3_a": "old", "level3_b": "keep"}}}
        override = {"level1": {"level2": {"level3_a": "new"}}}
        result = deep_merge(base, override)
        assert result["level1"]["level2"]["level3_a"] == "new"
        assert result["level1"]["level2"]["level3_b"] == "keep"

    def test_new_keys_added(self):
        """override 中 base 不存在的键被添加到结果中。"""
        base = {"a": 1}
        override = {"b": 2, "c": 3}
        result = deep_merge(base, override)
        assert result == {"a": 1, "b": 2, "c": 3}

    def test_original_dicts_not_mutated(self):
        """deep_merge 不修改原始字典（纯函数语义）。"""
        base = {"a": {"b": 1}}
        override = {"a": {"c": 2}}
        _ = deep_merge(base, override)
        assert base == {"a": {"b": 1}}  # base 未变
        assert override == {"a": {"c": 2}}  # override 未变


# ============================================================
# YAML 配置加载测试
# ============================================================
class TestYamlConfigLoading:
    """测试 YAML 配置文件加载功能。"""

    def test_load_bundled_yaml_returns_dict(self):
        """内置默认 YAML 可正常加载并返回嵌套字典。"""
        data = _load_bundled_yaml()
        assert isinstance(data, dict)
        assert data["server"]["name"] == "negentropy-perceives"
        assert "server_version" not in data  # 版本号不在 YAML 中

    def test_load_bundled_yaml_contains_all_sections(self):
        """内置默认 YAML 包含所有主要嵌套分区。"""
        data = _load_bundled_yaml()
        # 验证嵌套顶层键存在
        expected_top_keys = [
            "server",
            "transport",
            "http",
            "autothrottle",
            "log",
            "browser",
            "llm",
            "accelerator",
            "docling",
            "mineru",
            "marker",
            "concurrent_requests",  # 扁平键
        ]
        for key in expected_top_keys:
            assert key in data, f"Missing top-level key: {key}"

    def test_load_missing_yaml_returns_none(self):
        """不存在的 YAML 文件返回 None。"""
        result = _load_yaml_file(Path("/nonexistent/path/config.yaml"))
        assert result is None

    def test_load_valid_yaml_file(self, tmp_path):
        """有效 YAML 文件可正确解析。"""
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text(
            "transport_mode: stdio\nhttp_port: 9999\n", encoding="utf-8"
        )
        result = _load_yaml_file(yaml_file)
        assert result is not None
        assert result["transport_mode"] == "stdio"
        assert result["http_port"] == 9999

    def test_load_invalid_yaml_returns_none(self, tmp_path):
        """无效 YAML 文件返回 None 并记录警告（不抛异常）。"""
        yaml_file = tmp_path / "broken.yaml"
        yaml_file.write_text("{invalid: [yaml: content:", encoding="utf-8")
        result = _load_yaml_file(yaml_file)
        assert result is None  # 解析失败时回退到 None

    def test_user_config_path_is_negentropy_home(self):
        """用户配置路径位于 ~/.negentropy/ 目录下。"""
        path = _get_user_config_path()
        assert path.name == "perceives.config.yaml"
        assert ".negentropy" in str(path)
        assert str(path).startswith(str(Path.home()))


# ============================================================
# build_settings 编排函数测试
# ============================================================
class TestBuildSettings:
    """测试 build_settings 配置构建函数。"""

    def test_build_with_defaults_only(self, tmp_path):
        """仅使用内置默认构建配置，所有字段有合理默认值。"""
        import negentropy.perceives.config as config_module

        # 隔离用户配置文件，确保仅 bundled 默认生效
        with patch.object(
            config_module,
            "_get_user_config_path",
            return_value=tmp_path / "nonexistent.yaml",
        ):
            with patch.dict(os.environ, {}, clear=True):
                cfg = build_settings()
                assert cfg.server_name == "negentropy-perceives"
                assert cfg.transport_mode == "http"
                assert cfg.http_port == 2992
                assert cfg.concurrent_requests == 16
                assert cfg.log_level == "INFO"

    def test_build_with_custom_yaml(self, tmp_path):
        """自定义 YAML 覆盖默认值（显式 -c 配置优先级高于环境变量）。"""
        yaml_content = "transport_mode: stdio\nhttp_port: 9999\n"
        yaml_file = tmp_path / "custom.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        cfg = build_settings(config_path=str(yaml_file))
        assert cfg.transport_mode == "stdio"
        assert cfg.http_port == 9999
        # 未覆盖的字段仍使用默认值
        assert cfg.server_name == "negentropy-perceives"
        assert cfg.concurrent_requests == 16

    def test_build_yaml_plus_env_var_priority(self, tmp_path):
        """-c 显式配置优先级高于环境变量。

        pydantic-settings 内部优先级：init_settings(-c 值) > env_settings。
        这确保 -c 配置始终能覆盖环境变量。
        """
        yaml_content = "transport_mode: sse\n"
        yaml_file = tmp_path / "custom.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        with patch.dict(os.environ, {"NEGENTROPY_PERCEIVES_TRANSPORT_MODE": "http"}):
            cfg = build_settings(config_path=str(yaml_file))
            # -c 值通过 init_settings 传入，优先级高于环境变量
            assert cfg.transport_mode == "sse"  # -c wins

    def test_build_deep_merge_partial_override(self, tmp_path):
        """深度合并：显式配置部分覆盖，未指定字段保持默认。"""
        # 仅覆盖并发请求数
        yaml_content = "concurrent_requests: 99\n"
        yaml_file = tmp_path / "partial.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        cfg = build_settings(config_path=str(yaml_file))
        assert cfg.concurrent_requests == 99
        # 未指定的抓取引擎字段保持默认
        assert cfg.download_delay == 1.0
        assert cfg.autothrottle_enabled is True

    def test_reload_settings_updates_global(self, tmp_path):
        """reload_settings 正确更新全局单例并通过模块属性可访问。"""
        import negentropy.perceives.config as config_module

        original_port = config_module.settings.http_port

        yaml_content = f"http_port: {original_port + 1}\n"
        yaml_file = tmp_path / "reload-test.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        new_cfg = reload_settings(config_path=str(yaml_file))
        assert new_cfg.http_port == original_port + 1
        # 通过模块属性访问（而非 from import 绑定）验证全局已更新
        assert config_module.settings.http_port == original_port + 1

        # 清理：恢复原始设置
        reload_settings()


# ============================================================
# CLI 参数解析集成测试
# ============================================================
class TestCliIntegration:
    """测试 CLI 参数与配置系统的集成。"""

    def test_parse_config_arg(self):
        """-c/--config 参数正确解析。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args(["--config", "/tmp/test.yaml"])
        assert args.config == "/tmp/test.yaml"

    def test_parse_short_config_arg(self):
        """-c 短参数正确解析。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args(["-c", "/tmp/test.yaml"])
        assert args.config == "/tmp/test.yaml"

    def test_parse_no_config_arg(self):
        """不带 -c 参数时 config_path 为 None。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args([])
        assert args.config is None

    def test_parse_init_config_flag(self):
        """--init-config flag 正确解析。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args(["--init-config"])
        assert args.init_config is True

    def test_parse_no_init_config_flag(self):
        """不带 --init-config 时 init_config 为 False。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args([])
        assert args.init_config is False

    def test_parse_combined_args(self):
        """同时使用 -c 和 --init-config。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args(["-c", "/tmp/x.yaml", "--init-config"])
        assert args.config == "/tmp/x.yaml"
        assert args.init_config is True

    def test_parse_force_flag(self):
        """--force 标志正确解析。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args(["--init-config", "--force"])
        assert args.init_config is True
        assert args.force is True

    def test_parse_no_force_flag(self):
        """不带 --force 时 force 为 False。"""
        from negentropy.perceives.apps.app import _parse_args

        args = _parse_args([])
        assert args.force is False

    def test_ensure_user_config_creates_template(self, tmp_path):
        """首次运行时生成最小化模板（非完整副本）。"""
        from negentropy.perceives.apps.app import _ensure_user_config

        config_path = tmp_path / ".negentropy" / "perceives.config.yaml"
        with patch(
            "negentropy.perceives.apps.app._get_user_config_path",
            return_value=config_path,
        ):
            _ensure_user_config()

        assert config_path.exists()
        content = config_path.read_text(encoding="utf-8")
        # 模板应包含注释引导
        assert "配置优先级" in content
        # 模板不应包含完整默认值（仅含注释示例）
        assert "port: 8081" not in content or content.strip().startswith("#")

    def test_ensure_user_config_force_creates_full_copy(self, tmp_path):
        """--force 模式生成完整的内置默认配置副本。"""
        from negentropy.perceives.apps.app import _ensure_user_config

        config_path = tmp_path / ".negentropy" / "perceives.config.yaml"
        with patch(
            "negentropy.perceives.apps.app._get_user_config_path",
            return_value=config_path,
        ):
            _ensure_user_config(force=True)

        assert config_path.exists()
        content = config_path.read_text(encoding="utf-8")
        # 完整副本应包含实际配置值
        assert "negentropy-perceives" in content

    def test_ensure_user_config_skips_existing(self, tmp_path):
        """已有配置文件时不覆盖。"""
        from negentropy.perceives.apps.app import _ensure_user_config

        config_path = tmp_path / ".negentropy" / "perceives.config.yaml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text("existing: config\n", encoding="utf-8")

        with patch(
            "negentropy.perceives.apps.app._get_user_config_path",
            return_value=config_path,
        ):
            _ensure_user_config()

        assert config_path.read_text(encoding="utf-8") == "existing: config\n"


# ============================================================
# MinerU 引擎配置字段验证
# ============================================================
class TestMinerUConfigFields:
    """测试 MinerU 引擎相关配置字段。"""

    def test_mineru_enabled_default(self):
        """MinerU 引擎默认启用（运行时 is_available() 真实决定是否参与调度）。"""
        config = NegentropyPerceivesSettings()
        assert config.mineru_enabled is True

    def test_mineru_enabled_env_override(self):
        """环境变量 NEGENTROPY_PERCEIVES_MINERU_ENABLED=true 应启用 MinerU。"""
        with patch.dict(os.environ, {"NEGENTROPY_PERCEIVES_MINERU_ENABLED": "true"}):
            config = NegentropyPerceivesSettings()
            assert config.mineru_enabled is True

    def test_mineru_device_default(self):
        """MinerU 推理设备默认为 auto。"""
        config = NegentropyPerceivesSettings()
        assert config.mineru_device == "auto"

    def test_mineru_device_valid_values(self):
        """MinerU 推理设备合法值。"""
        for device in ("auto", "cpu", "mlx", "cuda"):
            config = NegentropyPerceivesSettings(mineru_device=device)
            assert config.mineru_device == device

    def test_mineru_device_env_override(self):
        """环境变量覆盖 MinerU 推理设备。"""
        with patch.dict(os.environ, {"NEGENTROPY_PERCEIVES_MINERU_DEVICE": "mlx"}):
            config = NegentropyPerceivesSettings()
            assert config.mineru_device == "mlx"

    def test_mineru_backend_default(self):
        """MinerU 后端默认为 auto。"""
        config = NegentropyPerceivesSettings()
        assert config.mineru_backend == "auto"

    def test_mineru_backend_valid_values(self):
        """MinerU 后端合法值。"""
        for backend in ("auto", "pipeline", "vlm"):
            config = NegentropyPerceivesSettings(mineru_backend=backend)
            assert config.mineru_backend == backend

    def test_mineru_backend_env_override(self):
        """环境变量覆盖 MinerU 后端。"""
        with patch.dict(
            os.environ, {"NEGENTROPY_PERCEIVES_MINERU_BACKEND": "pipeline"}
        ):
            config = NegentropyPerceivesSettings()
            assert config.mineru_backend == "pipeline"


# ============================================================
# Marker 引擎配置字段验证
# ============================================================
class TestMarkerConfigFields:
    """测试 Marker 引擎相关配置字段。"""

    def test_marker_enabled_default(self):
        """Marker 引擎默认启用（运行时 is_available() 决定是否真实参与调度）。"""
        config = NegentropyPerceivesSettings()
        assert config.marker_enabled is True

    def test_marker_enabled_env_override(self):
        """环境变量覆盖 Marker 启用状态。"""
        with patch.dict(os.environ, {"NEGENTROPY_PERCEIVES_MARKER_ENABLED": "true"}):
            config = NegentropyPerceivesSettings()
            assert config.marker_enabled is True

    def test_marker_llm_enhanced_default(self):
        """Marker LLM 增强模式默认禁用。"""
        config = NegentropyPerceivesSettings()
        assert config.marker_llm_enhanced is False

    def test_marker_llm_enhanced_config(self):
        """Marker LLM 增强模式配置。"""
        config = NegentropyPerceivesSettings(
            marker_llm_enhanced=True,
            marker_license_acknowledged=True,
        )
        assert config.marker_llm_enhanced is True
        assert config.marker_license_acknowledged is True

    def test_marker_llm_enhanced_env_override(self):
        """环境变量覆盖 Marker LLM 增强模式。"""
        with patch.dict(
            os.environ,
            {
                "NEGENTROPY_PERCEIVES_MARKER_LLM_ENHANCED": "true",
                "NEGENTROPY_PERCEIVES_MARKER_LICENSE_ACKNOWLEDGED": "true",
            },
        ):
            config = NegentropyPerceivesSettings()
            assert config.marker_llm_enhanced is True
            assert config.marker_license_acknowledged is True

    def test_marker_license_acknowledged_default(self):
        """Marker GPL-3.0 许可证确认默认不确认。"""
        config = NegentropyPerceivesSettings()
        assert config.marker_license_acknowledged is False

    def test_marker_license_acknowledged_env_override(self):
        """环境变量覆盖 Marker 许可证确认。"""
        with patch.dict(
            os.environ,
            {"NEGENTROPY_PERCEIVES_MARKER_LICENSE_ACKNOWLEDGED": "true"},
        ):
            config = NegentropyPerceivesSettings()
            assert config.marker_license_acknowledged is True


# ============================================================
# 多引擎配置集成验证
# ============================================================
class TestMultiEngineConfigIntegration:
    """测试多引擎配置集成验证。"""

    def test_all_engine_configs_default(self):
        """Docling、MinerU、Marker 默认值验证。"""
        config = NegentropyPerceivesSettings()
        # 各引擎默认启用（运行时 is_available() 为单一事实源，未装依赖会自动跳过）
        assert config.docling_enabled is True
        assert config.mineru_enabled is True
        assert config.marker_enabled is True

    def test_all_engine_configs_enabled(self):
        """各引擎可独立启用。"""
        config = NegentropyPerceivesSettings(
            docling_enabled=True,
            mineru_enabled=True,
            marker_enabled=True,
        )
        assert config.docling_enabled is True
        assert config.mineru_enabled is True
        assert config.marker_enabled is True

    def test_all_engine_configs_env_override(self):
        """环境变量可同时启用所有引擎。"""
        with patch.dict(
            os.environ,
            {
                "NEGENTROPY_PERCEIVES_DOCLING_ENABLED": "true",
                "NEGENTROPY_PERCEIVES_MINERU_ENABLED": "true",
                "NEGENTROPY_PERCEIVES_MARKER_ENABLED": "true",
            },
        ):
            config = NegentropyPerceivesSettings()
            assert config.docling_enabled is True
            assert config.mineru_enabled is True
            assert config.marker_enabled is True

    def test_get_docling_settings_returns_dict(self):
        """get_docling_settings() 应返回正确的 Docling 配置。"""
        config = NegentropyPerceivesSettings(
            docling_enabled=True,
            docling_ocr_enabled=False,
            docling_table_extraction_enabled=False,
            docling_formula_extraction_enabled=True,
            accelerator_device="mps",
            accelerator_num_threads=8,
            accelerator_ocr_batch_size=2,
            accelerator_layout_batch_size=10,
            accelerator_table_batch_size=15,
        )
        ds = config.get_docling_settings()
        assert ds["device"] == "mps"
        assert ds["num_threads"] == 8
        assert ds["enable_ocr"] is False
        assert ds["enable_table_extraction"] is False
        assert ds["enable_formula_extraction"] is True
        assert ds["ocr_batch_size"] == 2
        assert ds["layout_batch_size"] == 10
        assert ds["table_batch_size"] == 15
        assert ds["mps_enrichment"] == "granite_mlx"

    def test_docling_mps_enrichment_default(self):
        """Apple Silicon MPS 下 Docling enrichment 默认使用 Granite MLX。"""
        config = NegentropyPerceivesSettings()
        assert config.pdf_docling_mps_enrichment == "granite_mlx"

    def test_docling_mps_enrichment_valid_values(self):
        """Docling MPS enrichment 策略合法值。"""
        for policy in ("granite_mlx", "disable"):
            config = NegentropyPerceivesSettings(pdf_docling_mps_enrichment=policy)
            assert config.pdf_docling_mps_enrichment == policy

    def test_docling_mps_enrichment_env_override(self):
        """环境变量可关闭 MPS code/formula enrichment。"""
        with patch.dict(
            os.environ,
            {"NEGENTROPY_PERCEIVES_PDF_DOCLING_MPS_ENRICHMENT": "disable"},
        ):
            config = NegentropyPerceivesSettings()
            assert config.pdf_docling_mps_enrichment == "disable"

    def test_docling_mps_enrichment_invalid_value(self):
        """未知策略应被 Pydantic 拒绝，避免静默落到 CPU。"""
        with pytest.raises(ValidationError):
            NegentropyPerceivesSettings(pdf_docling_mps_enrichment="auto")


# ============================================================
# 内置默认配置作为运行时默认值源验证
# ============================================================
class TestBundledDefaultAsSource:
    """验证 config.default.yaml 是运行时默认值源。"""

    def test_bundled_default_loaded_at_startup(self):
        """内置默认 YAML 可正常加载并包含嵌套配置结构。"""
        data = _load_bundled_yaml()
        assert isinstance(data, dict)
        assert data["server"]["name"] == "negentropy-perceives"
        assert "server_version" not in data  # 版本号不在 YAML 中

    def test_bundled_default_contains_all_sections(self):
        """内置默认 YAML 包含所有主要嵌套分区。"""
        data = _load_bundled_yaml()
        expected_top_keys = [
            "server",
            "transport",
            "http",
            "autothrottle",
            "log",
            "browser",
            "llm",
            "accelerator",
            "docling",
            "mineru",
            "marker",
            "concurrent_requests",  # 扁平键
        ]
        for key in expected_top_keys:
            assert key in data, f"Missing top-level key: {key}"

    def test_user_yaml_overrides_bundled_default(self, tmp_path):
        """用户 YAML 深度合并覆盖内置默认的差异项，未指定的保留内置默认。"""
        yaml_content = "transport_mode: stdio\nhttp_port: 9999\n"
        yaml_file = tmp_path / "override.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        cfg = build_settings(config_path=str(yaml_file))
        assert cfg.transport_mode == "stdio"  # 用户覆盖
        assert cfg.http_port == 9999  # 用户覆盖
        assert cfg.server_name == "negentropy-perceives"  # 内置默认保留
        assert cfg.concurrent_requests == 16  # 内置默认保留
        assert cfg.log_level == "INFO"  # 内置默认保留

    def test_env_var_overrides_merged_yaml(self, tmp_path):
        """环境变量优先于用户 YAML 配置（无 -c 时，使用 ~/.negentropy/ 路径）。

        无显式 config_path 时，通过 _UserYamlConfigSource 注入合并配置，
        此时 env_settings 优先级高于 _UserYamlConfigSource。
        """
        yaml_content = "http_port: 7777\n"
        yaml_file = tmp_path / "partial.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        # 模拟无 -c 场景：将 yaml_file 作为用户配置路径（非 -c 显式指定）
        import negentropy.perceives._config_loader as config_loader_module

        with patch.object(
            config_loader_module, "_get_user_config_path", return_value=yaml_file
        ):
            with patch.dict(
                os.environ,
                {"NEGENTROPY_PERCEIVES_HTTP_PORT": "9999"},
                clear=False,
            ):
                cfg = build_settings(config_path=None)
                # env_settings > _UserYamlConfigSource
                assert cfg.http_port == 9999  # 环境变量胜出

    def test_bundled_yaml_values_take_effect_without_c_flag(self, tmp_path):
        """核心回归：无 -c 参数时，bundled YAML 值通过 _UserYamlConfigSource 生效。

        验证修复 _UserYamlConfigSource.__call__() 返回空字典的 Bug 后，
        内置默认配置值不再被忽略，而是通过 pydantic-settings 优先级链正确注入。
        """
        import negentropy.perceives._config_loader as config_loader_module

        # 使用不存在的用户配置文件，确保仅 bundled 默认生效
        with patch.object(
            config_loader_module,
            "_get_user_config_path",
            return_value=tmp_path / "nonexistent.yaml",
        ):
            with patch.dict(os.environ, {}, clear=True):
                cfg = build_settings(config_path=None)
                # 验证 bundled YAML 中的默认值生效（而非 Pydantic Field 硬编码默认值）
                assert cfg.server_name == "negentropy-perceives"
                assert cfg.transport_mode == "http"
                assert cfg.http_port == 2992
                assert cfg.http_host == "localhost"
                assert cfg.concurrent_requests == 16
                assert cfg.log_level == "INFO"
                assert cfg.enable_caching is True
                assert cfg.max_retries == 3
                assert cfg.browser_headless is True
                assert cfg.docling_enabled is True
                assert cfg.mineru_enabled is True
                assert cfg.marker_enabled is True

    def test_user_yaml_overrides_bundled_without_c_flag(self, tmp_path):
        """无 -c 时，用户 YAML 差异项覆盖 bundled 默认（通过 _UserYamlConfigSource）。"""
        yaml_content = "http_port: 9090\nlog_level: DEBUG\n"
        yaml_file = tmp_path / "user.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        import negentropy.perceives._config_loader as config_loader_module

        with patch.object(
            config_loader_module, "_get_user_config_path", return_value=yaml_file
        ):
            with patch.dict(os.environ, {}, clear=True):
                cfg = build_settings(config_path=None)
                assert cfg.http_port == 9090  # 用户覆盖
                assert cfg.log_level == "DEBUG"  # 用户覆盖
                assert cfg.server_name == "negentropy-perceives"  # bundled 默认
                assert cfg.concurrent_requests == 16  # bundled 默认

    def test_c_flag_overrides_env_var(self, tmp_path):
        """-c 显式配置优先级高于环境变量（最高优先级）。"""
        yaml_content = "http_port: 5555\n"
        yaml_file = tmp_path / "highest.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        with patch.dict(os.environ, {"NEGENTROPY_PERCEIVES_HTTP_PORT": "9999"}):
            cfg = build_settings(config_path=str(yaml_file))
            # -c 值通过 init_settings 传入，高于 env_settings
            assert cfg.http_port == 5555  # -c 胜出

    def test_deep_merge_preserves_unspecified_fields(self, tmp_path):
        """深度合并：用户仅声明单项时，其余字段保持内置默认。"""
        yaml_content = "log_level: DEBUG\n"
        yaml_file = tmp_path / "minimal.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        cfg = build_settings(config_path=str(yaml_file))
        assert cfg.log_level == "DEBUG"  # 用户覆盖
        assert cfg.transport_mode == "http"  # 内置默认
        assert cfg.enable_caching is True  # 内置默认
        assert cfg.max_retries == 3  # 内置默认

    def test_bundled_yaml_keys_match_settings_fields(self):
        """展平后的内置 YAML 键名与 Settings 字段名完全对应（黄金回归守护）。"""
        data = _load_bundled_yaml()
        flattened = _flatten_nested_yaml(data)
        valid_fields = set(NegentropyPerceivesSettings.model_fields.keys())
        unknown_keys = set(flattened.keys()) - valid_fields
        assert unknown_keys == set(), (
            f"展平后存在未对应 Settings 字段的键: {sorted(unknown_keys)}"
        )


# ============================================================
# 嵌套 YAML 展平函数测试
# ============================================================
class TestFlattenNestedYaml:
    """测试 _flatten_nested_yaml 工具函数。"""

    def test_flat_dict_unchanged(self):
        """纯扁平字典通过展平函数后不变。"""
        data = {"server_name": "test", "http_port": 8081, "log_level": "INFO"}
        result = _flatten_nested_yaml(data)
        assert result == data

    def test_nested_to_flat(self):
        """嵌套字典正确展平为以 '_' 连接的扁平键。"""
        data = {"server": {"name": "test"}, "http": {"host": "localhost", "port": 8081}}
        result = _flatten_nested_yaml(data)
        assert result["server_name"] == "test"
        assert result["http_host"] == "localhost"
        assert result["http_port"] == 8081

    def test_mixed_flat_and_nested(self):
        """混合扁平与嵌套键均正确处理。"""
        data = {
            "server": {"name": "test"},
            "concurrent_requests": 16,
            "log": {"level": "DEBUG"},
        }
        result = _flatten_nested_yaml(data)
        assert result["server_name"] == "test"
        assert result["concurrent_requests"] == 16
        assert result["log_level"] == "DEBUG"

    def test_flat_key_wins_over_nested(self):
        """扁平键优先于嵌套展开产生的同名键（向后兼容核心保证）。"""
        data = {
            "http": {"port": 8081},  # 嵌套展开 → http_port=8081
            "http_port": 9999,  # 顶层扁平键 → http_port=9999
        }
        result = _flatten_nested_yaml(data)
        assert result["http_port"] == 9999  # 扁平键胜出

    def test_deeply_nested_three_levels(self):
        """三层嵌套结构正确展平。"""
        data = {"level1": {"level2": {"level3": "value"}}}
        result = _flatten_nested_yaml(data)
        assert result["level1_level2_level3"] == "value"

    def test_empty_dict_returns_empty(self):
        """空字典展平后仍为空字典。"""
        assert _flatten_nested_yaml({}) == {}

    def test_none_values_preserved(self):
        """None 值在展平过程中正确保留。"""
        data = {"llm": {"api_key": None}, "proxy_url": None}
        result = _flatten_nested_yaml(data)
        assert result["llm_api_key"] is None
        assert result["proxy_url"] is None

    def test_boolean_values_preserved(self):
        """布尔值在展平过程中类型不变。"""
        data = {"docling": {"enabled": False, "ocr_enabled": True}}
        result = _flatten_nested_yaml(data)
        assert result["docling_enabled"] is False
        assert result["docling_ocr_enabled"] is True


# ============================================================
# 嵌套 YAML 配置向后兼容集成测试
# ============================================================
class TestNestedYamlIntegration:
    """测试嵌套 YAML 配置与 build_settings 的端到端集成。"""

    def test_nested_yaml_loads_correctly(self, tmp_path):
        """嵌套 YAML 格式通过 build_settings 正确加载为合法配置。"""
        yaml_content = (
            "transport:\n  mode: stdio\nhttp:\n  port: 9999\nlog:\n  level: DEBUG\n"
        )
        yaml_file = tmp_path / "nested.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        cfg = build_settings(config_path=str(yaml_file))
        assert cfg.transport_mode == "stdio"
        assert cfg.http_port == 9999
        assert cfg.log_level == "DEBUG"
        # 未覆盖的字段保持内置默认
        assert cfg.server_name == "negentropy-perceives"
        assert cfg.concurrent_requests == 16

    def test_flat_yaml_backward_compatibility(self, tmp_path):
        """旧版扁平 YAML 格式仍然完全正常工作。"""
        yaml_content = "transport_mode: sse\nhttp_port: 7777\nlog_level: WARNING\n"
        yaml_file = tmp_path / "flat.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        cfg = build_settings(config_path=str(yaml_file))
        assert cfg.transport_mode == "sse"
        assert cfg.http_port == 7777
        assert cfg.log_level == "WARNING"
        assert cfg.server_name == "negentropy-perceives"

    def test_mixed_nested_and_flat_yaml(self, tmp_path):
        """混合嵌套与扁平格式的 YAML 正确处理，扁平键优先。"""
        yaml_content = (
            "http:\n"
            "  host: 0.0.0.0\n"
            "  port: 8081\n"
            "http_port: 9999\n"  # 扁平键应优先于嵌套展开
            "concurrent_requests: 32\n"
            "llm:\n"
            "  model: openai/gpt-4\n"
        )
        yaml_file = tmp_path / "mixed.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")

        cfg = build_settings(config_path=str(yaml_file))
        assert cfg.http_host == "0.0.0.0"
        assert cfg.http_port == 9999  # 扁平键胜出
        assert cfg.concurrent_requests == 32
        assert cfg.llm_model == "openai/gpt-4"


# ============================================================
# 防漂移守护测试：Field(default=...) 与 config.default.yaml 同步
# ============================================================
class TestFieldDefaultsMatchYaml:
    """守护测试：确保 config.py Field(default=...) 与 config.default.yaml 保持同步。

    当 config.default.yaml 中的默认值被修改后，如果忘记同步更新
    对应的 Field(default=...)，此测试将立即报红，防止配置漂移。
    """

    # 允许 Field 默认值与 YAML 不同的字段白名单
    _SKIP_FIELDS = frozenset(
        {
            "server_version",  # 版本号由 pyproject.toml 注入，非 YAML 配置
            "pipeline",  # 复杂嵌套对象，展平后不可直接对比
        }
    )

    def test_field_defaults_match_yaml_defaults(self):
        """Field(default=...) 必须与 config.default.yaml 展平后的值完全一致。"""
        yaml_data = _load_bundled_yaml()
        flattened = _flatten_nested_yaml(yaml_data)
        model_fields = NegentropyPerceivesSettings.model_fields

        mismatches = []
        for field_name, field_info in model_fields.items():
            if field_name in self._SKIP_FIELDS:
                continue
            if field_name not in flattened:
                continue
            yaml_val = flattened[field_name]
            field_default = field_info.default
            if yaml_val != field_default:
                mismatches.append(
                    f"  {field_name}: Field(default={field_default!r})"
                    f" != YAML({yaml_val!r})"
                )

        assert not mismatches, (
            "Field(default=...) 与 config.default.yaml 值不同步！\n"
            "请更新 config.py 中的 Field 默认值以匹配 YAML：\n" + "\n".join(mismatches)
        )
