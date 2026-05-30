import sys
from unittest.mock import MagicMock, patch

# 需要临时 mock 的模块；仅为让 runner 工厂能在不拉起 ADK/LLM 的情况下导入。
# 关键修复（测试隔离）：原实现用 ``sys.modules[...] = MagicMock()`` 在 import 期
# 永久替换 ``negentropy.engine.factories.memory`` 等模块且从不还原，导致后续任何
# 测试 ``from ...factories.memory import get_association_service`` 拿到 MagicMock
# 属性（表现为 "object MagicMock can't be used in 'await' expression"）。
# 现改为：导入完成后立即还原被临时替换的真实模块，杜绝跨文件污染。
_MOCKED_MODULE_NAMES = (
    "negentropy.agents.agent",
    "negentropy.agents",
    "negentropy.engine.factories.memory",
    "negentropy.engine.factories.session",
    "google.adk.runners",
)


def _install_temp_mocks() -> dict[str, object]:
    """临时把若干模块替换为 MagicMock，返回被替换前的原始引用（可能不存在）。"""
    saved: dict[str, object] = {}
    for name in _MOCKED_MODULE_NAMES:
        saved[name] = sys.modules.get(name, None)
        if name == "negentropy.agents.agent":
            agent_mock = MagicMock()
            agent_mock.root_agent = MagicMock()
            sys.modules[name] = agent_mock
        else:
            sys.modules[name] = MagicMock()
    return saved


def _restore_modules(saved: dict[str, object]) -> None:
    """还原 ``_install_temp_mocks`` 替换前的 sys.modules 状态。"""
    for name, original in saved.items():
        if original is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = original


# 在临时 mock 环境下导入 runner 工厂，然后立即还原，避免污染全局 sys.modules。
_saved_modules = _install_temp_mocks()
try:
    from negentropy.engine.factories.runner import get_runner, reset_runner  # noqa: E402
finally:
    _restore_modules(_saved_modules)

# negentropy.engine.artifacts_factory is real


def test_runner_artifact_injection():
    print("Testing Runner Artifact Injection...")
    reset_runner()

    # Mock the Runner class to capture arguments
    MockRunner = MagicMock()
    # We must patch the Runner name reachable inside runner_factory
    with patch("negentropy.engine.factories.runner.Runner", MockRunner):
        # Mock get_artifact_service to return a specific mock
        mock_artifact_service = MagicMock()
        # We patch where it's imported in runner_factory
        with patch("negentropy.engine.factories.runner.get_artifact_service", return_value=mock_artifact_service):
            # agent= 显式传入，不会触发 root_agent 的延迟导入
            get_runner(app_name="test_app", agent=MagicMock())

            # Verify Runner was initialized with artifact_service
            print(f"Runner call args: {MockRunner.call_args}")
            if MockRunner.call_args is None:
                raise AssertionError("Runner was not called!")
            _, kwargs = MockRunner.call_args

            if "artifact_service" in kwargs:
                print("SUCCESS: artifact_service passed to Runner.")
                assert kwargs["artifact_service"] == mock_artifact_service
            else:
                print("FAILED: artifact_service NOT passed to Runner.")
                raise AssertionError("artifact_service missing in Runner init")


if __name__ == "__main__":
    test_runner_artifact_injection()
