"""Test batch agent for better coverage."""

from unittest.mock import AsyncMock

import pytest

from cognizes.agents.claude.batch_agent import BatchProcessingAgent


@pytest.mark.unit
class TestBatchProcessingAgentCoverage:
    """Test cases for BatchProcessingAgent to improve coverage."""

    @pytest.fixture
    def agent(self):
        """Create a BatchProcessingAgent instance for testing."""
        return BatchProcessingAgent()

    @pytest.mark.asyncio
    async def test_process_with_invalid_files(self, agent):
        """Test process with invalid files."""
        # Mock _validate_files to return failure
        agent._validate_files = AsyncMock(return_value={"success": False, "error": "Invalid files"})

        input_data = {"files": ["invalid1.pdf", "invalid2.pdf"], "options": {}}

        result = await agent.process(input_data)

        assert result["success"] is False
        assert "Invalid files" in result["error"]
