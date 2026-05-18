"""Test utils for better coverage."""

from cognizes.agents.utils import format_file_size, get_category_from_path


def test_format_file_size():
    """Test format_file_size function."""
    # Test PB
    size = format_file_size(1024 * 1024 * 1024 * 1024 * 1024)
    assert "PB" in size

    # Test TB
    size = format_file_size(1024 * 1024 * 1024 * 1024)
    assert "TB" in size

    # Test GB
    size = format_file_size(1024 * 1024 * 1024)
    assert "GB" in size

    # Test MB
    size = format_file_size(1024 * 1024)
    assert "MB" in size

    # Test KB
    size = format_file_size(1024)
    assert "KB" in size

    # Test bytes
    size = format_file_size(512)
    assert "B" in size


def test_get_category_from_path():
    """Test get_category_from_path function."""
    # Test with known categories
    file_path = "/path/multi-agent-systems/paper.pdf"
    category = get_category_from_path(file_path)
    assert category == "multi-agent"

    file_path = "/path/llm-agents-research/paper.pdf"
    category = get_category_from_path(file_path)
    assert category == "llm-agents"

    file_path = "/path/context-engineering/paper.pdf"
    category = get_category_from_path(file_path)
    assert category == "context-engineering"

    file_path = "/path/knowledge-graphs/paper.pdf"
    category = get_category_from_path(file_path)
    assert category == "knowledge-graphs"

    file_path = "/path/reasoning-systems/paper.pdf"
    category = get_category_from_path(file_path)
    assert category == "reasoning"

    file_path = "/path/planning-algorithms/paper.pdf"
    category = get_category_from_path(file_path)
    assert category == "planning"

    # Test unknown category
    file_path = "/path/unknown-category/paper.pdf"
    category = get_category_from_path(file_path)
    assert category == "general"
