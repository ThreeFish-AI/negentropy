"""Test PDF agent for better coverage."""

from cognizes.agents.claude.pdf_agent import PDFProcessingAgent


def test_pdf_agent_methods():
    """Test PDFProcessingAgent has required methods."""
    agent = PDFProcessingAgent()

    # Test that agent has required methods
    assert hasattr(agent, "process")
    assert hasattr(agent, "extract_content")
    assert hasattr(agent, "validate_input")
    assert hasattr(agent, "batch_call_skill")
    assert callable(agent.process)
    assert callable(agent.extract_content)
    assert callable(agent.validate_input)
    assert callable(agent.batch_call_skill)


def test_pdf_agent_config():
    """Test PDFProcessingAgent configuration."""
    agent = PDFProcessingAgent()

    # Test default configuration
    assert hasattr(agent, "config")
    assert hasattr(agent, "default_options")
    assert agent.default_options["extract_images"] is True
    assert agent.default_options["extract_tables"] is True
    assert agent.default_options["extract_formulas"] is True
    assert agent.default_options["output_format"] == "markdown"


def test_pdf_agent_with_config():
    """Test PDFProcessingAgent with custom configuration."""
    config = {"timeout": 30, "retries": 3}
    agent = PDFProcessingAgent(config)

    assert agent.config == config
