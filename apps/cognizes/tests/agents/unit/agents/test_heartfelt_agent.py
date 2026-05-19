"""Unit tests for HeartfeltAgent."""

from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from cognizes.agents.claude.heartfelt_agent import HeartfeltAgent


@pytest.mark.unit
class TestHeartfeltAgent:
    """Test cases for HeartfeltAgent."""

    @pytest.fixture
    def heartfelt_agent(self):
        """Create a HeartfeltAgent instance for testing."""
        return HeartfeltAgent()

    @pytest.fixture
    def heartfelt_agent_with_config(self):
        """Create a HeartfeltAgent instance with custom config."""
        config = {"papers_dir": "custom_papers"}
        return HeartfeltAgent(config)

    def test_heartfelt_agent_initialization(self, heartfelt_agent):
        """Test HeartfeltAgent initialization."""
        assert heartfelt_agent.name == "heartfelt"
        assert heartfelt_agent.config == {}
        assert heartfelt_agent.papers_dir == Path("papers")
        assert heartfelt_agent.default_options["generate_summary"] is True
        assert heartfelt_agent.default_options["generate_insights"] is True
        assert heartfelt_agent.default_options["generate_reflections"] is True
        assert heartfelt_agent.default_options["analyze_structure"] is True
        assert heartfelt_agent.default_options["extract_key_points"] is True

    def test_heartfelt_agent_initialization_with_config(self, heartfelt_agent_with_config):
        """Test HeartfeltAgent initialization with config."""
        assert heartfelt_agent_with_config.name == "heartfelt"
        assert heartfelt_agent_with_config.config == {"papers_dir": "custom_papers"}
        assert heartfelt_agent_with_config.papers_dir == Path("custom_papers")

    @pytest.mark.asyncio
    async def test_process_no_content(self, heartfelt_agent):
        """Test process without content."""
        input_data = {"options": {"generate_summary": True}}

        result = await heartfelt_agent.process(input_data)

        assert result["success"] is False
        assert result["error"] == "No content provided"

    @pytest.mark.asyncio
    async def test_process_with_content(self, heartfelt_agent):
        """Test process with content."""
        content = "This is the paper content"
        input_data = {
            "content": content,
            "paper_id": "test_paper",
            "options": {"generate_summary": True},
        }

        # Mock the analyze method
        heartfelt_agent.analyze = AsyncMock(return_value={"success": True, "data": {"analysis": "result"}})

        result = await heartfelt_agent.process(input_data)

        assert result["success"] is True
        heartfelt_agent.analyze.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_with_translation(self, heartfelt_agent):
        """Test process with translation content."""
        content = "English content"
        translation = "中文翻译内容"
        input_data = {
            "content": content,
            "translation": translation,
            "paper_id": "test_paper",
            "options": {},
        }

        heartfelt_agent.analyze = AsyncMock(return_value={"success": True})

        await heartfelt_agent.process(input_data)

        call_args = heartfelt_agent.analyze.call_args[0][0]
        assert call_args["content"] == content
        assert call_args["translation"] == translation

    @pytest.mark.asyncio
    async def test_analyze_skill_call_success(self, heartfelt_agent):
        """Test successful skill call in analyze method."""
        params = {
            "content": "Test content",
            "paper_id": "test_paper",
            "options": {
                "generate_summary": True,
                "generate_insights": True,
                "generate_reflections": False,
                "analyze_structure": True,
                "extract_key_points": True,
            },
        }

        # Mock successful skill call
        heartfelt_agent.call_skill = AsyncMock(
            return_value={
                "success": True,
                "data": {
                    "content": "Analyzed content",
                    "summary": "Test summary",
                    "key_points": ["Point 1", "Point 2"],
                    "insights": ["Insight 1"],
                    "structure": {"Section 1": "Content"},
                },
            }
        )

        # Mock _save_analysis
        heartfelt_agent._save_analysis = AsyncMock()

        result = await heartfelt_agent.analyze(params)

        assert result["success"] is True
        assert "data" in result
        heartfelt_agent.call_skill.assert_called_once()

        # Check skill call parameters
        skill_params = heartfelt_agent.call_skill.call_args[0][1]
        assert skill_params["content"] == "Test content"
        # Only the options that are True should be included
        assert "generate_reflections" not in skill_params  # Not in options, so not included

    @pytest.mark.asyncio
    async def test_analyze_with_translation_content(self, heartfelt_agent):
        """Test analyze method with translation content."""
        params = {
            "content": "Original content",
            "translation": "Translated content",
            "options": {},
        }

        heartfelt_agent.call_skill = AsyncMock(return_value={"success": True})
        heartfelt_agent._save_analysis = AsyncMock()

        await heartfelt_agent.analyze(params)

        # Check that translation was included in skill call
        skill_params = heartfelt_agent.call_skill.call_args[0][1]
        assert skill_params["content"] == "Original content"
        assert skill_params["translation"] == "Translated content"

    @pytest.mark.asyncio
    async def test_analyze_skill_call_failure(self, heartfelt_agent):
        """Test skill call failure in analyze method."""
        params = {"content": "Test content"}

        # Mock failed skill call
        heartfelt_agent.call_skill = AsyncMock(return_value={"success": False, "error": "Skill failed"})

        result = await heartfelt_agent.analyze(params)

        assert result["success"] is False
        assert result["error"] == "Skill failed"

    @pytest.mark.asyncio
    async def test_analyze_exception_handling(self, heartfelt_agent):
        """Test exception handling in analyze method."""
        params = {"content": "Test content"}

        # Mock exception
        heartfelt_agent.call_skill = AsyncMock(side_effect=Exception("Unexpected error"))

        result = await heartfelt_agent.analyze(params)

        assert result["success"] is False
        assert "Unexpected error" in result["error"]

    def test_process_analysis_result_full_data(self, heartfelt_agent):
        """Test _process_analysis_result with full data."""
        data = {
            "content": "Analyzed content",
            "summary": "Test summary",
            "key_points": ["Point 1", "Point 2", "Point 3"],
            "insights": ["Insight 1", "Insight 2"],
            "reflections": ["Reflection 1"],
            "structure": {"Section 1": "Description", "Section 2": "Description"},
        }
        original_content = "Original test content with multiple words"

        result = heartfelt_agent._process_analysis_result(data, original_content)

        assert result["content"] == "Analyzed content"
        assert "analysis_timestamp" in result
        assert result["summary"] == "Test summary"
        assert len(result["key_points"]) == 3
        assert len(result["insights"]) == 2
        assert len(result["reflections"]) == 1
        assert "structure" in result

        # Check stats
        assert result["stats"]["original_word_count"] == 6
        # "Analyzed content" has 2 words, not 3
        assert result["stats"]["analysis_word_count"] == 2
        assert result["stats"]["key_points_count"] == 3
        assert result["stats"]["insights_count"] == 2

    def test_process_analysis_result_minimal_data(self, heartfelt_agent):
        """Test _process_analysis_result with minimal data."""
        data = {"content": "Analyzed content"}
        original_content = "Single word"

        result = heartfelt_agent._process_analysis_result(data, original_content)

        assert result["content"] == "Analyzed content"
        assert "analysis_timestamp" in result
        assert "summary" not in result
        assert "key_points" not in result
        assert "insights" not in result
        assert "reflections" not in result
        assert "structure" not in result

        # Stats should still be present
        assert result["stats"]["original_word_count"] == 2  # "Single word" is actually 2 words
        assert result["stats"]["analysis_word_count"] == 2  # "Analyzed content" is 2 words
        assert result["stats"]["key_points_count"] == 0
        assert result["stats"]["insights_count"] == 0

    @pytest.mark.asyncio
    async def test_save_analysis_success(self, heartfelt_agent, tmp_path):
        """Test successful analysis saving."""
        heartfelt_agent.papers_dir = tmp_path
        paper_id = "ai-research_test_paper_20240115"
        data = {
            "content": "Analysis content",
            "analysis_timestamp": "2024-01-15T14:30:00",
            "summary": "Test summary",
            "key_points": ["Point 1"],
            "insights": ["Insight 1"],
            "reflections": ["Reflection 1"],
            "structure": {"Section": "Info"},
            "stats": {"count": 1},
        }

        await heartfelt_agent._save_analysis(paper_id, data)

        # Check files were created
        output_dir = tmp_path / "heartfelt" / "ai-research"
        assert output_dir.exists()
        assert (output_dir / f"{paper_id}.md").exists()
        assert (output_dir / f"{paper_id}_analysis.json").exists()

        # Check markdown file content
        with open(output_dir / f"{paper_id}.md", encoding="utf-8") as f:
            content = f.read()
            assert "Analysis content" in content

    @pytest.mark.asyncio
    async def test_save_analysis_invalid_paper_id(self, heartfelt_agent, tmp_path):
        """Test save analysis with invalid paper ID."""
        heartfelt_agent.papers_dir = tmp_path
        paper_id = "invalid_id"  # Has underscore, so "invalid" will be used as category
        data = {"content": "Content", "analysis_timestamp": "2024-01-15T14:30:00"}

        # Should not raise exception
        await heartfelt_agent._save_analysis(paper_id, data)

        # Should use "invalid" as category since paper_id is "invalid_id"
        output_dir = tmp_path / "heartfelt" / "invalid"
        assert output_dir.exists()
        # Also check that files were created
        assert (output_dir / f"{paper_id}.md").exists()
        assert (output_dir / f"{paper_id}_analysis.json").exists()

    @pytest.mark.asyncio
    async def test_generate_reading_report_success(self, heartfelt_agent, tmp_path):
        """Test successful reading report generation."""
        heartfelt_agent.papers_dir = tmp_path
        paper_id = "ai-research_test_paper"
        category = "ai-research"
        analysis_dir = tmp_path / "heartfelt" / category
        analysis_dir.mkdir(parents=True, exist_ok=True)

        # Create mock analysis file
        analysis_data = {
            "paper_id": paper_id,
            "analysis_timestamp": "2024-01-15T14:30:00",
            "summary": "Test summary",
            "key_points": ["Point 1", "Point 2"],
            "insights": ["Insight 1"],
            "reflections": ["Reflection 1"],
            "structure": {"Section": "Description"},
            "stats": {
                "original_word_count": 1000,
                "analysis_word_count": 500,
                "key_points_count": 2,
                "insights_count": 1,
            },
        }

        import json

        with open(analysis_dir / f"{paper_id}_analysis.json", "w", encoding="utf-8") as f:
            json.dump(analysis_data, f)

        result = await heartfelt_agent.generate_reading_report(paper_id)

        assert result["success"] is True
        assert "data" in result
        assert "report_content" in result["data"]
        assert "report_file" in result["data"]
        assert "stats" in result["data"]

        # Check report file was created
        report_file = analysis_dir / f"{paper_id}_report.md"
        assert report_file.exists()

        # Check report content
        with open(report_file, encoding="utf-8") as f:
            report_content = f.read()
            assert "# 论文深度阅读报告" in report_content
            assert paper_id in report_content
            assert "Test summary" in report_content
            assert "Point 1" in report_content
            assert "Insight 1" in report_content

    @pytest.mark.asyncio
    async def test_generate_reading_report_not_found(self, heartfelt_agent, tmp_path):
        """Test reading report generation when analysis not found."""
        heartfelt_agent.papers_dir = tmp_path
        paper_id = "nonexistent_paper"

        result = await heartfelt_agent.generate_reading_report(paper_id)

        assert result["success"] is False
        assert result["error"] == "Analysis not found"

    @pytest.mark.asyncio
    async def test_generate_reading_report_exception(self, heartfelt_agent, tmp_path):
        """Test reading report generation with exception."""
        heartfelt_agent.papers_dir = tmp_path
        paper_id = "test_paper"

        # Create directory but invalid JSON file
        category = "general"
        analysis_dir = tmp_path / "heartfelt" / category
        analysis_dir.mkdir(parents=True, exist_ok=True)
        with open(analysis_dir / f"{paper_id}_analysis.json", "w") as f:
            f.write("invalid json")

        result = await heartfelt_agent.generate_reading_report(paper_id)

        assert result["success"] is False
        assert "error" in result

    def test_generate_report_content_full_data(self, heartfelt_agent):
        """Test _generate_report_content with full data."""
        analysis_data = {
            "paper_id": "test_paper",
            "analysis_timestamp": "2024-01-15T14:30:00",
            "summary": "This is a test summary",
            "key_points": ["First key point", "Second key point"],
            "insights": ["Important insight"],
            "reflections": ["Deep reflection"],
            "structure": {
                "Introduction": "Paper intro",
                "Conclusion": "Paper conclusion",
            },
            "stats": {
                "original_word_count": 1000,
                "analysis_word_count": 500,
                "key_points_count": 2,
                "insights_count": 1,
            },
        }

        report = heartfelt_agent._generate_report_content(analysis_data)

        assert "# 论文深度阅读报告" in report
        assert "test_paper" in report
        assert "2024-01-15T14:30:00" in report
        assert "This is a test summary" in report
        assert "First key point" in report
        assert "Important insight" in report
        assert "Deep reflection" in report
        assert "Introduction" in report
        assert "原文词数: 1000" in report
        assert "分析词数: 500" in report
        assert "由 AI 深度分析生成" in report

    def test_generate_report_content_minimal_data(self, heartfelt_agent):
        """Test _generate_report_content with minimal data."""
        analysis_data = {
            "paper_id": "minimal_paper",
            "analysis_timestamp": "2024-01-15T14:30:00",
        }

        report = heartfelt_agent._generate_report_content(analysis_data)

        assert "# 论文深度阅读报告" in report
        assert "minimal_paper" in report
        assert "2024-01-15T14:30:00" in report
        assert "内容摘要" not in report
        assert "核心要点" not in report

    @pytest.mark.asyncio
    async def test_analyze_default_options(self, heartfelt_agent):
        """Test analyze method uses default options when none provided."""
        params = {"content": "Test content"}

        heartfelt_agent.call_skill = AsyncMock(return_value={"success": True})
        heartfelt_agent._save_analysis = AsyncMock()

        await heartfelt_agent.analyze(params)

        # Check that only content is present when no options provided
        skill_params = heartfelt_agent.call_skill.call_args[0][1]
        assert skill_params["content"] == "Test content"
        # No options provided, so no additional parameters
        assert "generate_summary" not in skill_params

    @pytest.mark.asyncio
    async def test_analyze_custom_options_override(self, heartfelt_agent):
        """Test analyze method with custom options overriding defaults."""
        params = {
            "content": "Test content",
            "options": {
                "generate_summary": False,  # Override default
                "extract_key_points": False,  # Override default
            },
        }

        heartfelt_agent.call_skill = AsyncMock(return_value={"success": True})
        heartfelt_agent._save_analysis = AsyncMock()

        await heartfelt_agent.analyze(params)

        # Check that custom options were applied
        skill_params = heartfelt_agent.call_skill.call_args[0][1]
        # False options should not be included
        assert "generate_summary" not in skill_params
        assert "extract_key_points" not in skill_params
