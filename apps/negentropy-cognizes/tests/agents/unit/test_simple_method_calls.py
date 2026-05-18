"""Test simple method calls for coverage."""


def test_simple_method_exists():
    """Test that simple methods exist and are callable."""
    from cognizes.agents.claude.batch_agent import BatchProcessingAgent

    agent = BatchProcessingAgent()

    # Test that validate method exists
    assert hasattr(agent, "validate_input")
    assert callable(agent.validate_input)

    # Test with valid input
    import asyncio

    result = asyncio.run(agent.validate_input({"test": "value"}))
    assert result is True  # dict input
