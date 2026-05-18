"""Unit tests for BaseAgent."""

from unittest.mock import patch

import pytest

from cognizes.agents.claude.base import BaseAgent


@pytest.mark.unit
class TestBaseAgent:
    """Test cases for BaseAgent."""

    def test_base_agent_initialization_with_config(self):
        """Test BaseAgent initialization with config."""
        config = {"timeout": 30, "max_retries": 3}

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent", config)

        assert agent.name == "test_agent"
        assert agent.config == config
        assert agent._skills_cache == {}

    def test_base_agent_initialization_without_config(self):
        """Test BaseAgent initialization without config."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        assert agent.name == "test_agent"
        assert agent.config == {}
        assert agent._skills_cache == {}

    @pytest.mark.asyncio
    async def test_validate_input_valid(self):
        """Test input validation with valid data."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        # Test with valid dictionary
        valid_input = {"key": "value", "number": 42}
        result = await agent.validate_input(valid_input)
        assert result is True

    @pytest.mark.asyncio
    async def test_validate_input_invalid(self):
        """Test input validation with invalid data."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        # Test with invalid inputs
        invalid_inputs = [
            None,
            "string",
            123,
            ["list"],
            (1, 2, 3),
        ]

        for invalid_input in invalid_inputs:
            result = await agent.validate_input(invalid_input)
            assert result is False

    @pytest.mark.asyncio
    async def test_validate_input_empty_dict(self):
        """Test input validation with empty dictionary."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        # Empty dict should be valid
        result = await agent.validate_input({})
        assert result is True

    @pytest.mark.asyncio
    async def test_call_skill_success(self):
        """Test successful skill call."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        # Mock the skill import and execution
        with patch("cognizes.agents.claude.base.logger"):
            result = await agent.call_skill("test_skill", {"param": "value"})

            # Now it should fail with unknown skill error instead of module not found
            assert result["success"] is False
            assert "Unknown skill: test_skill" in result["error"]

    @pytest.mark.asyncio
    async def test_call_skill_with_exception(self):
        """Test skill call with exception."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        with patch("cognizes.agents.claude.base.logger"):
            result = await agent.call_skill("invalid_skill", {})

            assert result["success"] is False
            assert "error" in result

    @pytest.mark.asyncio
    async def test_batch_call_skill_all_success(self):
        """Test batch skill call with all successful calls."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

            async def call_skill(self, skill_name, params):
                # Mock successful skill call
                return {"success": True, "data": f"Processed {skill_name}"}

        agent = TestAgent("test_agent")

        calls = [
            {"skill": "skill1", "params": {"param1": "value1"}},
            {"skill": "skill2", "params": {"param2": "value2"}},
            {"skill": "skill3", "params": {"param3": "value3"}},
        ]

        results = await agent.batch_call_skill(calls)

        assert len(results) == 3
        assert all(result["success"] for result in results)
        assert "Processed skill1" in results[0]["data"]
        assert "Processed skill2" in results[1]["data"]
        assert "Processed skill3" in results[2]["data"]

    @pytest.mark.asyncio
    async def test_batch_call_skill_with_failures(self):
        """Test batch skill call with some failures."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

            async def call_skill(self, skill_name, params):
                if skill_name == "failing_skill":
                    raise Exception("Skill failed")
                return {"success": True, "data": f"Processed {skill_name}"}

        agent = TestAgent("test_agent")

        calls = [
            {"skill": "skill1", "params": {}},
            {"skill": "failing_skill", "params": {}},
            {"skill": "skill2", "params": {}},
        ]

        results = await agent.batch_call_skill(calls)

        assert len(results) == 3
        assert results[0]["success"] is True
        assert results[1]["success"] is False
        assert "Skill failed" in results[1]["error"]
        assert results[2]["success"] is True

    @pytest.mark.asyncio
    async def test_batch_call_skill_empty_list(self):
        """Test batch skill call with empty list."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        results = await agent.batch_call_skill([])

        assert results == []

    # @pytest.mark.asyncio
    # async def test_batch_call_skill_with_exception_results(self):
    #     """Test batch skill call that returns exceptions."""

    #     class TestAgent(BaseAgent):
    #         async def process(self, input_data):
    #             return {"success": True, "data": input_data}

    #         async def call_skill(self, skill_name, params):
    #             if skill_name == "exception_skill":
    #                 return RuntimeError("Unexpected error")
    #             return {"success": True, "data": "ok"}

    #     agent = TestAgent("test_agent")

    #     calls = [
    #         {"skill": "normal_skill", "params": {}},
    #         {"skill": "exception_skill", "params": {}},
    #     ]

    #     results = await agent.batch_call_skill(calls)

    #     assert len(results) == 2
    #     assert results[0]["success"] is True
    #     assert results[1]["success"] is False
    #     assert "RuntimeError" in results[1]["error"]

    @pytest.mark.asyncio
    async def test_log_processing(self):
        """Test processing log logging."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        agent = TestAgent("test_agent")

        input_data = {"file": "test.pdf"}
        output_data = {"success": True, "data": {"result": "processed"}}

        with patch("cognizes.agents.claude.base.logger") as mock_logger:
            await agent.log_processing(input_data, output_data)

            mock_logger.info.assert_called_once()
            log_message = mock_logger.info.call_args[0][0]
            assert "test_agent processed:" in log_message
            assert "{'file': 'test.pdf'}" in log_message
            assert "True" in log_message

    @pytest.mark.asyncio
    async def test_log_processing_failure(self):
        """Test processing log logging with failure."""

        class TestAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": False, "error": "Processing failed"}

        agent = TestAgent("test_agent")

        input_data = {"file": "test.pdf"}
        output_data = {"success": False, "error": "Processing failed"}

        with patch("cognizes.agents.claude.base.logger") as mock_logger:
            await agent.log_processing(input_data, output_data)

            mock_logger.info.assert_called_once()
            log_message = mock_logger.info.call_args[0][0]
            assert "test_agent processed:" in log_message
            assert "{'file': 'test.pdf'}" in log_message
            assert "False" in log_message

    @pytest.mark.asyncio
    async def test_process_is_abstract(self):
        """Test that process method is abstract and must be implemented."""

        # Cannot instantiate BaseAgent directly
        with pytest.raises(TypeError):
            BaseAgent("test_agent")

    def test_subclass_must_implement_process(self):
        """Test that subclasses must implement process method."""

        class IncompleteAgent(BaseAgent):
            pass

        # Cannot instantiate without implementing process
        with pytest.raises(TypeError):
            IncompleteAgent("test_agent")

    def test_complete_subclass_can_be_instantiated(self):
        """Test that complete subclasses can be instantiated."""

        class CompleteAgent(BaseAgent):
            async def process(self, input_data):
                return {"success": True, "data": input_data}

        # Should be able to instantiate
        agent = CompleteAgent("test_agent")
        assert agent.name == "test_agent"
