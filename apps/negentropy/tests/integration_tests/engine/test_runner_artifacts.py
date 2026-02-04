import sys
from unittest.mock import MagicMock, patch


# Helper to mock modules before they are imported
def mock_modules():
    # Mock the agent module to prevent it from importing ADK agents and LLMs
    if "negentropy.agents.agent" not in sys.modules:
        agent_mock = MagicMock()
        agent_mock.root_agent = MagicMock()
        sys.modules["negentropy.agents.agent"] = agent_mock

    if "negentropy.agents" not in sys.modules:
        sys.modules["negentropy.agents"] = MagicMock()

    # Also mock session/memory factories to allow simple import
    sys.modules["negentropy.engine.factories.memory"] = MagicMock()
    sys.modules["negentropy.engine.factories.session"] = MagicMock()

    # Mock ADK dependencies that might be hit
    sys.modules["google.adk.runners"] = MagicMock()


mock_modules()

from negentropy.engine.factories.runner import get_runner, reset_runner
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
            # We also need to patch root_agent since we default to it
            with patch("negentropy.engine.factories.runner.root_agent", MagicMock()):
                runner = get_runner(app_name="test_app", agent=MagicMock())

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
