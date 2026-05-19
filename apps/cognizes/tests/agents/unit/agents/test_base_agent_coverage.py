"""Test base agent for better coverage."""

from unittest.mock import AsyncMock

import pytest

from cognizes.agents.claude.batch_agent import BatchProcessingAgent


@pytest.mark.unit
class TestBaseAgentCoverage:
    """Test cases for BaseAgent to improve coverage."""

    @pytest.fixture
    def agent(self):
        """Create a BatchProcessingAgent instance for testing."""
        return BatchProcessingAgent()

    @pytest.mark.asyncio
    async def test_batch_call_skill_with_unexpected_result_type(self, agent):
        """Test batch_call_skill with unexpected result type."""
        # Mock call_skill to return different types
        agent.call_skill = AsyncMock(
            side_effect=[
                {"success": True},  # dict
                Exception("Error"),  # exception
                "string_result",  # unexpected type (string)
            ]
        )

        calls = [
            {"skill": "skill1", "params": {}},
            {"skill": "skill2", "params": {}},
            {"skill": "skill3", "params": {}},
        ]

        results = await agent.batch_call_skill(calls)

        assert len(results) == 3
        assert results[0]["success"] is True  # dict result
        assert results[1]["success"] is False  # exception result
        assert "Error" in results[1]["error"]
        assert results[2]["success"] is False  # unexpected type result
        assert "Unexpected result type" in results[2]["error"]
