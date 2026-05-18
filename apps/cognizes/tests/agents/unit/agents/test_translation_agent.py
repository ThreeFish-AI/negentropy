"""Unit tests for TranslationAgent."""

from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from cognizes.agents.claude.translation_agent import TranslationAgent


@pytest.mark.unit
class TestTranslationAgent:
    """Test cases for TranslationAgent."""

    @pytest.fixture
    def translation_agent(self):
        """Create a TranslationAgent instance for testing."""
        return TranslationAgent()

    @pytest.fixture
    def translation_agent_with_config(self):
        """Create a TranslationAgent instance with custom config."""
        config = {"papers_dir": "custom_papers", "target_language": "en"}
        return TranslationAgent(config)

    def test_translation_agent_initialization(self, translation_agent):
        """Test TranslationAgent initialization."""
        assert translation_agent.name == "translator"
        assert translation_agent.config == {}
        assert translation_agent.papers_dir == Path("papers")
        assert translation_agent.default_options["target_language"] == "zh"
        assert translation_agent.default_options["preserve_format"] is True
        assert translation_agent.default_options["preserve_code"] is True
        assert translation_agent.default_options["preserve_formulas"] is True
        assert translation_agent.default_options["batch_size"] == 5000

    def test_translation_agent_initialization_with_config(self, translation_agent_with_config):
        """Test TranslationAgent initialization with config."""
        assert translation_agent_with_config.name == "translator"
        assert translation_agent_with_config.config == {
            "papers_dir": "custom_papers",
            "target_language": "en",
        }
        assert translation_agent_with_config.papers_dir == Path("custom_papers")

    @pytest.mark.asyncio
    async def test_process_no_content(self, translation_agent):
        """Test process without content."""
        input_data = {"options": {"target_language": "en"}}

        result = await translation_agent.process(input_data)

        assert result["success"] is False
        assert result["error"] == "No content provided"

    @pytest.mark.asyncio
    async def test_process_with_content(self, translation_agent):
        """Test process with content."""
        content = "This is the content to translate"
        input_data = {
            "content": content,
            "paper_id": "test_paper",
            "options": {"target_language": "zh"},
        }

        # Mock the translate method
        translation_agent.translate = AsyncMock(return_value={"success": True, "data": {"content": "翻译内容"}})

        result = await translation_agent.process(input_data)

        assert result["success"] is True
        translation_agent.translate.assert_called_once()

    @pytest.mark.asyncio
    async def test_translate_small_content(self, translation_agent):
        """Test translate with small content (single batch)."""
        content = "Short content"
        params = {
            "content": content,
            "target_language": "zh",
            "preserve_format": True,
            "preserve_code": True,
            "preserve_formulas": True,
            "paper_id": "test_paper",
        }

        # Mock _translate_single
        translation_agent._translate_single = AsyncMock(
            return_value={
                "success": True,
                "data": {"content": "翻译后的内容", "word_count": 4, "batch_count": 1},
            }
        )
        translation_agent._save_translation = AsyncMock()

        result = await translation_agent.translate(params)

        assert result["success"] is True
        translation_agent._translate_single.assert_called_once()
        translation_agent._save_translation.assert_called_once_with("test_paper", "翻译后的内容")

    @pytest.mark.asyncio
    async def test_translate_large_content(self, translation_agent):
        """Test translate with large content (multiple batches)."""
        # Create content larger than batch_size
        content = "x" * 6000
        params = {"content": content, "target_language": "zh", "paper_id": "test_paper"}

        # Mock _translate_batch
        translation_agent._translate_batch = AsyncMock(
            return_value={
                "success": True,
                "data": {
                    "content": "翻译后的大段内容",
                    "word_count": 100,
                    "batch_count": 2,
                },
            }
        )

        result = await translation_agent.translate(params)

        assert result["success"] is True
        translation_agent._translate_batch.assert_called_once()

    @pytest.mark.asyncio
    async def test_translate_exception_handling(self, translation_agent):
        """Test translate method exception handling."""
        params = {"content": "Test content"}

        # Mock exception
        translation_agent._translate_single = AsyncMock(side_effect=Exception("Translation error"))

        result = await translation_agent.translate(params)

        assert result["success"] is False
        assert "Translation error" in result["error"]

    @pytest.mark.asyncio
    async def test_translate_single_success(self, translation_agent):
        """Test successful single translation."""
        params = {
            "content": "Hello world",
            "target_language": "zh",
            "preserve_format": True,
            "preserve_code": True,
            "preserve_formulas": True,
        }

        # Mock skill call
        translation_agent.call_skill = AsyncMock(return_value={"success": True, "data": "你好世界"})

        result = await translation_agent._translate_single(params)

        assert result["success"] is True
        assert result["data"]["content"] == "你好世界"
        assert result["data"]["word_count"] == 2
        assert result["data"]["batch_count"] == 1

        # Check skill call parameters
        skill_params = translation_agent.call_skill.call_args[0][1]
        assert skill_params["content"] == "Hello world"
        assert skill_params["target_language"] == "zh"
        assert skill_params["preserve_format"] is True
        assert skill_params["preserve_code_blocks"] is True
        assert skill_params["preserve_math_formulas"] is True

    @pytest.mark.asyncio
    async def test_translate_single_failure(self, translation_agent):
        """Test single translation failure."""
        params = {
            "content": "Test content",
            "target_language": "zh",
            "preserve_format": True,
            "preserve_code": True,
            "preserve_formulas": True,
        }

        # Mock failed skill call
        translation_agent.call_skill = AsyncMock(return_value={"success": False, "error": "Translation service error"})

        result = await translation_agent._translate_single(params)

        assert result["success"] is False
        assert result["error"] == "Translation service error"

    @pytest.mark.asyncio
    async def test_translate_batch_success(self, translation_agent):
        """Test successful batch translation."""
        content = "Paragraph 1\n\nParagraph 2\n\nParagraph 3"
        params = {
            "content": content,
            "target_language": "zh",
            "batch_size": 20,  # Small batch size for testing
            "paper_id": "test_paper",
            "preserve_format": True,
            "preserve_code": True,
            "preserve_formulas": True,
        }

        # Mock batch_call_skill
        translation_agent.batch_call_skill = AsyncMock(
            return_value=[
                {"success": True, "data": "翻译段落1"},
                {"success": True, "data": "翻译段落2"},
                {"success": True, "data": "翻译段落3"},
            ]
        )
        translation_agent._save_translation = AsyncMock()

        result = await translation_agent._translate_batch(params)

        assert result["success"] is True
        assert result["data"]["content"] == "翻译段落1翻译段落2翻译段落3"
        assert result["data"]["word_count"] == 3  # Each has 1 word
        assert result["data"]["batch_count"] == 3

        # Check batch_call_skill was called
        translation_agent.batch_call_skill.assert_called_once()
        translation_agent._save_translation.assert_called_once()

    @pytest.mark.asyncio
    async def test_translate_batch_partial_failure(self, translation_agent):
        """Test batch translation with partial failures."""
        content = "First batch\n\nSecond batch"
        params = {
            "content": content,
            "target_language": "zh",
            "batch_size": 20,
            "paper_id": "test_paper",
            "preserve_format": True,
            "preserve_code": True,
            "preserve_formulas": True,
        }

        # Mock batch_call_skill with mixed results
        translation_agent.batch_call_skill = AsyncMock(
            return_value=[
                {"success": True, "data": "第一批翻译"},
                {"success": False, "error": "Batch failed"},
            ]
        )
        translation_agent._save_translation = AsyncMock()

        result = await translation_agent._translate_batch(params)

        assert result["success"] is True
        assert "第一批翻译" in result["data"]["content"]
        assert "Second batch" in result["data"]["content"]  # Original content as fallback

    @pytest.mark.asyncio
    async def test_save_translation_success(self, translation_agent, tmp_path):
        """Test successful translation saving."""
        translation_agent.papers_dir = tmp_path
        paper_id = "ai-research_test_paper_20240115"
        content = "# 翻译内容\n\n这是翻译后的论文内容。"

        await translation_agent._save_translation(paper_id, content)

        # Check file was created
        output_dir = tmp_path / "translation" / "ai-research"
        output_file = output_dir / f"{paper_id}.md"
        assert output_file.exists()

        # Check file content
        with open(output_file, encoding="utf-8") as f:
            saved_content = f.read()
            assert saved_content == content

    @pytest.mark.asyncio
    async def test_save_translation_invalid_paper_id(self, translation_agent, tmp_path):
        """Test save translation with invalid paper ID."""
        translation_agent.papers_dir = tmp_path
        paper_id = "invalid_id"  # Has underscore, so "invalid" will be used as category
        content = "翻译内容"

        # Should not raise exception
        await translation_agent._save_translation(paper_id, content)

        # Should use "invalid" as category since paper_id is "invalid_id"
        output_dir = tmp_path / "translation" / "invalid"
        assert output_dir.exists()

    def test_split_content_paragraphs(self, translation_agent):
        """Test content splitting by paragraphs."""
        content = "Paragraph 1\n\nParagraph 2\n\nParagraph 3"
        batch_size = 20  # Small batch size

        batches = translation_agent._split_content(content, batch_size)

        assert len(batches) == 3
        assert batches[0] == "Paragraph 1"
        assert batches[1] == "Paragraph 2"
        assert batches[2] == "Paragraph 3"

    def test_split_content_long_paragraph(self, translation_agent):
        """Test content splitting with long paragraph that needs sentence splitting."""
        content = "First sentence。Second sentence。Third sentence。Fourth sentence。"
        batch_size = 30  # Small batch size

        batches = translation_agent._split_content(content, batch_size)

        assert len(batches) > 1  # Should be split into multiple batches

    def test_split_content_empty(self, translation_agent):
        """Test content splitting with empty content."""
        batches = translation_agent._split_content("", 5000)
        assert batches == []

    def test_split_content_single_paragraph(self, translation_agent):
        """Test content splitting with single paragraph."""
        content = "Single paragraph"
        batch_size = 5000

        batches = translation_agent._split_content(content, batch_size)

        assert len(batches) == 1
        assert batches[0] == content

    @pytest.mark.asyncio
    async def test_validate_translation_good(self, translation_agent):
        """Test translation validation with good result."""
        original = "Hello ```python\nprint('Hello')\n``` World $E=mc^2$"
        translated = "你好 ```python\nprint('Hello')\n``` 世界 $E=mc^2$"

        result = await translation_agent.validate_translation(original, translated)

        assert result["valid"] is True
        assert len(result["warnings"]) == 0
        assert result["stats"]["original_length"] == len(original)
        assert result["stats"]["translated_length"] == len(translated)
        assert result["stats"]["code_blocks_preserved"] is True
        assert result["stats"]["formulas_preserved"] is True

    @pytest.mark.asyncio
    async def test_validate_translation_warnings(self, translation_agent):
        """Test translation validation with warnings."""
        original = "Hello World"
        translated = "H"  # Too short

        result = await translation_agent.validate_translation(original, translated)

        assert result["valid"] is True  # Still valid but with warnings
        assert len(result["warnings"]) > 0
        assert "Translation length seems unusual" in result["warnings"]

    @pytest.mark.asyncio
    async def test_validate_translation_missing_code_blocks(self, translation_agent):
        """Test translation validation with missing code blocks."""
        original = "Code: ```python\nprint('Hello')\n```"
        translated = "代码: print('Hello')"  # Code block removed

        result = await translation_agent.validate_translation(original, translated)

        assert result["valid"] is True
        assert "Code blocks may not be preserved correctly" in result["warnings"]
        assert result["stats"]["code_blocks_preserved"] is False

    @pytest.mark.asyncio
    async def test_validate_translation_missing_formulas(self, translation_agent):
        """Test translation validation with missing formulas."""
        original = "Formula: $E=mc^2$"
        translated = "公式: E=mc2"  # Formula notation changed

        result = await translation_agent.validate_translation(original, translated)

        assert result["valid"] is True
        assert "Math formulas may not be preserved correctly" in result["warnings"]
        assert result["stats"]["formulas_preserved"] is False

    @pytest.mark.asyncio
    async def test_validate_translation_empty_content(self, translation_agent):
        """Test translation validation with empty content."""
        original = ""
        translated = ""

        result = await translation_agent.validate_translation(original, translated)

        assert result["valid"] is True
        assert result["stats"]["length_ratio"] == 0

    def test_count_code_blocks(self, translation_agent):
        """Test code block counting."""
        content = "```python\nprint('Hello')\n``` Some text ```javascript\nconsole.log('World')\n```"
        count = translation_agent._count_code_blocks(content)
        assert count == 2

        # Test with no code blocks
        content = "Just plain text without code blocks"
        count = translation_agent._count_code_blocks(content)
        assert count == 0

    def test_count_formula_blocks(self, translation_agent):
        """Test formula block counting."""
        content = "Inline formula $E=mc^2$ and block formula $$\\int f(x)dx$$"
        count = translation_agent._count_formula_blocks(content)
        assert count == 2

        # Test with no formulas
        content = "Just plain text without formulas"
        count = translation_agent._count_formula_blocks(content)
        assert count == 0

    @pytest.mark.asyncio
    async def test_translate_default_options(self, translation_agent):
        """Test translate uses default options when none provided."""
        params = {"content": "Test content"}

        # Mock _translate_single
        translation_agent._translate_single = AsyncMock(
            return_value={
                "success": True,
                "data": {"content": "Translated", "word_count": 1, "batch_count": 1},
            }
        )

        await translation_agent.translate(params)

        # Check that default options were used in the call to _translate_single
        call_params = translation_agent._translate_single.call_args[0][0]
        assert call_params["target_language"] == "zh"  # Default
        assert call_params["preserve_format"] is True  # Default
        assert call_params["preserve_code"] is True  # Default
        assert call_params["preserve_formulas"] is True  # Default

    @pytest.mark.asyncio
    async def test_translate_custom_options(self, translation_agent):
        """Test translate with custom options."""
        params = {
            "content": "Test content",
            "target_language": "fr",  # Custom
            "preserve_format": False,  # Custom
            "preserve_code": False,  # Custom
            "preserve_formulas": False,  # Custom
        }

        # Mock _translate_single
        translation_agent._translate_single = AsyncMock(
            return_value={
                "success": True,
                "data": {"content": "Traduit", "word_count": 1, "batch_count": 1},
            }
        )

        await translation_agent.translate(params)

        # Check that custom options were used
        call_params = translation_agent._translate_single.call_args[0][0]
        assert call_params["target_language"] == "fr"
        assert call_params["preserve_format"] is False
        assert call_params["preserve_code"] is False
        assert call_params["preserve_formulas"] is False

    @pytest.mark.asyncio
    async def test_process_uses_default_options(self, translation_agent):
        """Test process uses default options when none provided."""
        content = "Test content"
        input_data = {"content": content, "paper_id": "test_paper"}

        translation_agent.translate = AsyncMock(return_value={"success": True})

        await translation_agent.process(input_data)

        # Check that default options were merged
        call_params = translation_agent.translate.call_args[0][0]
        assert call_params["target_language"] == "zh"  # Default
        assert call_params["preserve_format"] is True  # Default
        assert call_params["preserve_code"] is True  # Default
        assert call_params["preserve_formulas"] is True  # Default
