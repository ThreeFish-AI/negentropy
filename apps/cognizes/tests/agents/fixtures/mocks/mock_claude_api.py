"""Mock configurations for Claude API and Claude Skills."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock


class MockClaudeAPI:
    """Mock Claude API client for testing."""

    def __init__(self):
        self.messages = MagicMock()
        self.messages.create = AsyncMock()
        self._setup_default_responses()

    def _setup_default_responses(self):
        """Setup default mock responses."""
        # Default translation response
        self.translation_response = {
            "content": [
                {
                    "text": "这是翻译后的测试内容。This is the translated test content.",
                    "type": "text",
                }
            ],
            "model": "claude-3-opus-20240229",
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 100, "output_tokens": 50},
        }

        # Default heartfelt analysis response
        self.heartfelt_response = {
            "content": [
                {
                    "text": """## 论文深度解读

### 核心贡献
1. 提出了一种创新的AI Agent通信协议
2. 设计了一套完整的评估框架
3. 实现了在多个基准测试上的显著提升

### 技术洞见
- Agent架构采用了分层设计模式
- 通过注意力机制优化了决策过程
- 引入了元学习以适应新环境

### 实际应用
- 可应用于自动驾驶决策系统
- 适用于智能助手开发
- 在游戏AI中有巨大潜力

### 相关工作
- Smith et al., 2023 - Multi-Agent Reinforcement Learning
- Jones et al., 2023 - Communication Protocols for AI Agents

### 未来方向
- 探索更高效的训练方法
- 扩展到多模态输入场景
- 研究Agent的可解释性问题""",
                    "type": "text",
                }
            ],
            "model": "claude-3-opus-20240229",
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 200, "output_tokens": 300},
        }

        # Configure default behavior
        self.messages.create.return_value = self.translation_response

    def set_translation_response(self, response: dict[str, Any] | None = None):
        """Set the response for translation requests."""
        if response:
            self.translation_response = response
        self.messages.create.return_value = self.translation_response

    def set_heartfelt_response(self, response: dict[str, Any] | None = None):
        """Set the response for heartfelt analysis requests."""
        if response:
            self.heartfelt_response = response
        self.messages.create.return_value = self.heartfelt_response

    async def translate(self, text: str, style: str = "academic") -> dict[str, Any]:
        """Mock translation method."""
        return {
            "translated_text": self.translation_response["content"][0]["text"],
            "style": style,
            "confidence": 0.95,
            "usage": self.translation_response["usage"],
        }

    async def analyze(self, text: str, depth: str = "standard") -> dict[str, Any]:
        """Mock heartfelt analysis method."""
        return {
            "analysis": self.heartfelt_response["content"][0]["text"],
            "depth": depth,
            "insights": ["Key insight 1", "Key insight 2", "Key insight 3"],
            "usage": self.heartfelt_response["usage"],
        }


class MockClaudeSkills:
    """Mock Claude Skills for testing."""

    def __init__(self):
        self.skills = {}
        self._setup_skills()

    def _setup_skills(self):
        """Setup mock skills."""
        # PDF Reader Skill
        self.skills["pdf-reader"] = AsyncMock()
        self.skills["pdf-reader"].return_value = {
            "content": "Extracted PDF content here...",
            "metadata": {
                "pages": 10,
                "title": "Test Paper: A Study on AI Agents",
                "authors": ["John Doe", "Jane Smith"],
                "year": 2024,
                "venue": "Conference on AI",
            },
            "images": [
                {
                    "path": "image1.png",
                    "caption": "Figure 1: Agent Architecture",
                    "position": 1,
                },
                {
                    "path": "image2.png",
                    "caption": "Figure 2: Performance Comparison",
                    "position": 5,
                },
            ],
            "formulas": [
                {"latex": "Q(s,a) = r + \\gamma \\max_{a'} Q(s',a')", "position": 3},
                {
                    "latex": "\\nabla_\\theta J(\\theta) = \\mathbb{E}[\\nabla_\\theta \\log \\pi_\\theta(a|s) Q^{\\pi}(s,a)]",
                    "position": 7,
                },
            ],
            "tables": [
                {
                    "caption": "Table 1: Experimental Results",
                    "position": 2,
                    "data": [
                        ["Method", "Accuracy", "Speed"],
                        ["Baseline", "85%", "1.0x"],
                        ["Our Method", "92%", "1.2x"],
                    ],
                }
            ],
            "word_count": 5000,
            "section_headers": [
                "Abstract",
                "Introduction",
                "Related Work",
                "Methodology",
                "Experiments",
                "Conclusion",
            ],
        }

        # Chinese Translator Skill
        self.skills["zh-translator"] = AsyncMock()
        self.skills["zh-translator"].return_value = {
            "translated_content": """# AI Agent研究：一种新的通信协议

## 摘要
本文提出了一种创新的AI Agent通信协议，通过分层设计模式优化了多Agent系统的协作效率。

## 主要贡献
1. **通信协议设计**：提出了一种基于注意力机制的通信协议，显著提升了Agent间的信息传递效率。
2. **评估框架**：设计了一套完整的Agent性能评估框架，包含多个维度的评价指标。
3. **实验验证**：在多个基准测试中取得了显著的性能提升。

## 技术要点
- **分层架构**：采用分层设计模式，实现了决策过程的模块化
- **注意力机制**：通过自注意力机制优化Agent的信息选择能力
- **元学习**：引入元学习算法，使Agent能够快速适应新环境

## 实验结果
在多个测试场景中，我们提出的方法相比基线方法提升了15-30%的性能。
""",
            "preserved_elements": {
                "formulas": 2,
                "images": 2,
                "tables": 1,
                "references": 25,
            },
            "translation_quality": {
                "overall": 0.95,
                "technical_accuracy": 0.98,
                "readability": 0.92,
                "cultural_adaptation": 0.94,
            },
            "statistics": {
                "source_words": 5000,
                "target_words": 4800,
                "translation_time": 12.5,
            },
        }

        # Heartfelt Skill
        self.skills["heartfelt"] = AsyncMock()
        self.skills["heartfelt"].return_value = {
            "summary": """这篇论文提出了一种新的AI Agent通信协议，通过创新的分层设计和注意力机制，显著提升了多Agent系统的协作效率。研究者在多个基准测试中验证了该方法的有效性，相比传统方法取得了15-30%的性能提升。""",
            "core_contributions": [
                "提出了基于注意力机制的Agent通信协议",
                "设计了多维度的Agent性能评估框架",
                "实现了在复杂环境下的高效协作",
            ],
            "technical_insights": [
                "分层架构设计使决策过程更加模块化和可解释",
                "自注意力机制有效解决了信息过载问题",
                "元学习策略大幅提升了Agent的适应能力",
            ],
            "practical_applications": [
                "自动驾驶系统中的多车协作决策",
                "智能客服系统的任务分配优化",
                "游戏AI中的团队策略制定",
            ],
            "related_works": [
                "Smith et al., 2023 - Multi-Agent Reinforcement Learning",
                "Jones et al., 2023 - Communication Protocols for AI Agents",
                "Brown et al., 2022 - Attention in Multi-Agent Systems",
            ],
            "future_directions": [
                "探索跨模态的Agent通信机制",
                "研究大规模Agent系统的可扩展性问题",
                "开发更智能的任务动态分配算法",
            ],
            "limitations": [
                "当前方法在超大规模系统中的计算开销较大",
                "对通信延迟较为敏感",
                "需要更多实际场景的验证",
            ],
            "impact_assessment": {
                "innovation": "High",
                "practicality": "Medium",
                "reproducibility": "High",
            },
        }

        # Markdown Formatter Skill
        self.skills["markdown-formatter"] = AsyncMock()
        self.skills["markdown-formatter"].return_value = {
            "formatted_content": """# AI Agent研究：一种新的通信协议

## 摘要

本文提出了一种创新的AI Agent通信协议...

## 1. 引言

随着多Agent系统的广泛应用...

## 2. 相关工作

...""",
            "formatting_applied": [
                "header_levels",
                "list_indentation",
                "code_blocks",
                "table_formatting",
            ],
            "validation": {
                "markdown_compliant": True,
                "rendering_safe": True,
                "accessibility_score": 0.95,
            },
        }

        # Doc Translator Skill (workflow coordinator)
        self.skills["doc-translator"] = AsyncMock()
        self.skills["doc-translator"].return_value = {
            "workflow_id": "workflow_123",
            "status": "completed",
            "output_files": {
                "extracted": "output/paper_extracted.json",
                "translated": "output/paper_translated.md",
                "formatted": "output/paper_final.md",
            },
            "statistics": {
                "total_processing_time": 45.2,
                "stages": {"extraction": 10.5, "translation": 25.3, "formatting": 9.4},
            },
        }

        # Batch Processor Skill
        self.skills["batch-processor"] = AsyncMock()
        self.skills["batch-processor"].return_value = {
            "batch_id": "batch_456",
            "total_items": 10,
            "processed": 10,
            "successful": 9,
            "failed": 1,
            "results": [
                {
                    "item_id": f"paper_{i}",
                    "status": "success" if i < 9 else "failed",
                    "output_file": f"output/paper_{i}_translated.md" if i < 9 else None,
                    "error": None if i < 9 else "Processing timeout",
                }
                for i in range(10)
            ],
            "summary": {
                "success_rate": 0.9,
                "average_processing_time": 23.4,
                "total_time": 234.5,
            },
        }

        # Web Translator Skill
        self.skills["web-translator"] = AsyncMock()
        self.skills["web-translator"].return_value = {
            "url": "https://example.com/paper",
            "title": "AI Agent Research Paper",
            "content": "Extracted web content...",
            "translated_content": "翻译后的网页内容...",
            "metadata": {"word_count": 3000, "images": 5, "links": 25},
        }

    def get_skill(self, skill_name: str) -> AsyncMock:
        """Get a mock skill by name."""
        if skill_name not in self.skills:
            # Create a default skill for unknown names
            self.skills[skill_name] = AsyncMock()
            self.skills[skill_name].return_value = {
                "result": f"Mock response for {skill_name}",
                "success": True,
            }
        return self.skills[skill_name]

    def set_skill_response(self, skill_name: str, response: dict[str, Any]):
        """Set custom response for a skill."""
        if skill_name not in self.skills:
            self.skills[skill_name] = AsyncMock()
        self.skills[skill_name].return_value = response

    def set_skill_error(self, skill_name: str, error_message: str):
        """Set error response for a skill."""
        if skill_name not in self.skills:
            self.skills[skill_name] = AsyncMock()
        self.skills[skill_name].side_effect = Exception(error_message)


# Global mock instances
mock_claude_api = MockClaudeAPI()
mock_claude_skills = MockClaudeSkills()


def get_mock_claude_api() -> MockClaudeAPI:
    """Get the global mock Claude API instance."""
    return mock_claude_api


def get_mock_claude_skills() -> MockClaudeSkills:
    """Get the global mock Claude skills instance."""
    return mock_claude_skills


# Decorator for using mocks in tests
def with_mocks(test_func):
    """Decorator to automatically apply mocks to test functions."""

    def wrapper(*args, **kwargs):
        # Mock the Skill class
        from unittest.mock import patch

        with patch("claude_agent_sdk.tools.Skill") as mock_skill_class:

            def skill_side_effect(skill_name, **kwargs):
                return mock_claude_skills.get_skill(skill_name)

            mock_skill_class.side_effect = skill_side_effect

            # Mock Anthropic client
            with patch("anthropic.Anthropic") as mock_anthropic:
                mock_anthropic.return_value = mock_claude_api

                return test_func(*args, **kwargs)

    return wrapper
