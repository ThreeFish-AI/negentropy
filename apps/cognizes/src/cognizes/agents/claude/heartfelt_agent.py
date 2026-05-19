"""Heartfelt Agent - 封装深度分析和感悟生成功能."""

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from cognizes.agents.utils import get_category_from_paper_id

from .base import BaseAgent

logger = logging.getLogger(__name__)


class HeartfeltAgent(BaseAgent):
    """深度分析专用 Agent."""

    def __init__(self, config: dict[str, Any] | None = None):
        """初始化 HeartfeltAgent.

        Args:
            config: 配置参数
        """
        super().__init__("heartfelt", config)
        self.papers_dir = Path(config.get("papers_dir", "papers") if config else "papers")
        self.default_options = {
            "generate_summary": True,
            "generate_insights": True,
            "generate_reflections": True,
            "analyze_structure": True,
            "extract_key_points": True,
        }

    async def process(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """处理深度分析请求.

        Args:
            input_data: 包含 content 和相关选项

        Returns:
            分析结果
        """
        content = input_data.get("content")
        translation = input_data.get("translation")
        options = {**self.default_options, **input_data.get("options", {})}

        if not content:
            return {"success": False, "error": "No content provided"}

        return await self.analyze(
            {
                "content": content,
                "translation": translation,
                "paper_id": input_data.get("paper_id"),
                "options": options,
            }
        )

    async def analyze(self, params: dict[str, Any]) -> dict[str, Any]:
        """深度分析文档内容.

        Args:
            params: 分析参数

        Returns:
            分析结果
        """
        content = params.get("content", "")
        translation = params.get("translation")
        paper_id = params.get("paper_id")
        options = params.get("options", {})

        try:
            # 准备 heartfelt skill 的参数
            skill_params = {
                "content": content,
            }

            # 如果有翻译内容，也包含进去
            if translation:
                skill_params["translation"] = translation

            # 添加分析选项
            if options.get("generate_summary"):
                skill_params["generate_summary"] = True
            if options.get("generate_insights"):
                skill_params["generate_insights"] = True
            if options.get("generate_reflections"):
                skill_params["generate_reflections"] = True
            if options.get("analyze_structure"):
                skill_params["analyze_structure"] = True
            if options.get("extract_key_points"):
                skill_params["extract_key_points"] = True

            # 调用 heartfelt skill
            result = await self.call_skill("heartfelt", skill_params)

            if result["success"]:
                # 处理分析结果
                analysis_data = self._process_analysis_result(result["data"], content)

                # 保存分析结果
                if paper_id:
                    await self._save_analysis(paper_id, analysis_data)

                return {"success": True, "data": analysis_data}
            else:
                return result

        except Exception as e:
            logger.error(f"Error in heartfelt analysis: {str(e)}")
            return {"success": False, "error": str(e)}

    def _process_analysis_result(self, data: dict[str, Any], original_content: str) -> dict[str, Any]:
        """处理分析结果.

        Args:
            data: 原始分析数据
            original_content: 原始内容

        Returns:
            处理后的分析数据
        """
        processed_data = {
            "content": data.get("content", ""),
            "analysis_timestamp": datetime.now().isoformat(),
        }

        # 提取摘要
        if "summary" in data:
            processed_data["summary"] = data["summary"]

        # 提取要点
        if "key_points" in data:
            processed_data["key_points"] = data["key_points"]

        # 提取洞察
        if "insights" in data:
            processed_data["insights"] = data["insights"]

        # 提取感悟
        if "reflections" in data:
            processed_data["reflections"] = data["reflections"]

        # 结构分析
        if "structure" in data:
            processed_data["structure"] = data["structure"]

        # 添加统计信息
        processed_data["stats"] = {
            "original_word_count": len(original_content.split()),
            "analysis_word_count": len(data.get("content", "").split()),
            "key_points_count": len(data.get("key_points", [])),
            "insights_count": len(data.get("insights", [])),
        }

        return processed_data

    async def _save_analysis(self, paper_id: str, data: dict[str, Any]) -> None:
        """保存分析结果.

        Args:
            paper_id: 论文ID
            data: 分析数据
        """
        try:
            category = get_category_from_paper_id(paper_id)
            output_dir = self.papers_dir / "heartfelt" / category
            output_dir.mkdir(parents=True, exist_ok=True)

            # 保存主分析内容
            output_file = output_dir / f"{paper_id}.md"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(data["content"])

            # 保存结构化数据（JSON格式）
            import json

            structured_file = output_dir / f"{paper_id}_analysis.json"
            structured_data = {
                "paper_id": paper_id,
                "analysis_timestamp": data["analysis_timestamp"],
                "summary": data.get("summary", ""),
                "key_points": data.get("key_points", []),
                "insights": data.get("insights", []),
                "reflections": data.get("reflections", []),
                "structure": data.get("structure", {}),
                "stats": data.get("stats", {}),
            }

            with open(structured_file, "w", encoding="utf-8") as f:
                json.dump(structured_data, f, ensure_ascii=False, indent=2)

            logger.info(f"Analysis saved to {output_file}")
            logger.info(f"Structured data saved to {structured_file}")

        except Exception as e:
            logger.error(f"Error saving analysis: {str(e)}")

    async def generate_reading_report(self, paper_id: str) -> dict[str, Any]:
        """生成阅读报告.

        Args:
            paper_id: 论文ID

        Returns:
            阅读报告
        """
        try:
            category = get_category_from_paper_id(paper_id)
            analysis_file = self.papers_dir / "heartfelt" / category / f"{paper_id}_analysis.json"

            if not analysis_file.exists():
                return {"success": False, "error": "Analysis not found"}

            # 读取分析数据
            import json

            with open(analysis_file, encoding="utf-8") as f:
                analysis_data = json.load(f)

            # 生成报告
            report = self._generate_report_content(analysis_data)

            # 保存报告
            report_file = self.papers_dir / "heartfelt" / category / f"{paper_id}_report.md"
            with open(report_file, "w", encoding="utf-8") as f:
                f.write(report)

            return {
                "success": True,
                "data": {
                    "report_content": report,
                    "report_file": str(report_file),
                    "stats": analysis_data.get("stats", {}),
                },
            }

        except Exception as e:
            logger.error(f"Error generating reading report: {str(e)}")
            return {"success": False, "error": str(e)}

    def _generate_report_content(self, analysis_data: dict[str, Any]) -> str:
        """生成报告内容.

        Args:
            analysis_data: 分析数据

        Returns:
            报告内容
        """
        report_lines = [
            "# 论文深度阅读报告\n",
            f"**论文ID**: {analysis_data['paper_id']}\n",
            f"**分析时间**: {analysis_data['analysis_timestamp']}\n",
        ]

        # 添加摘要
        if analysis_data.get("summary"):
            report_lines.extend(
                [
                    "\n## 📝 内容摘要\n",
                    analysis_data["summary"],
                ]
            )

        # 添加要点
        if analysis_data.get("key_points"):
            report_lines.extend(
                [
                    "\n## 🔑 核心要点\n",
                ]
            )
            for i, point in enumerate(analysis_data["key_points"], 1):
                report_lines.append(f"{i}. {point}")

        # 添加洞察
        if analysis_data.get("insights"):
            report_lines.extend(
                [
                    "\n## 💡 深度洞察\n",
                ]
            )
            for i, insight in enumerate(analysis_data["insights"], 1):
                report_lines.append(f"{i}. {insight}")

        # 添加感悟
        if analysis_data.get("reflections"):
            report_lines.extend(
                [
                    "\n## 🤔 读后感悟\n",
                ]
            )
            for i, reflection in enumerate(analysis_data["reflections"], 1):
                report_lines.append(f"{i}. {reflection}")

        # 添加统计信息
        if analysis_data.get("stats"):
            stats = analysis_data["stats"]
            report_lines.extend(
                [
                    "\n## 📊 阅读统计\n",
                    f"- 原文词数: {stats.get('original_word_count', 0)}\n",
                    f"- 分析词数: {stats.get('analysis_word_count', 0)}\n",
                    f"- 要点数量: {stats.get('key_points_count', 0)}\n",
                    f"- 洞察数量: {stats.get('insights_count', 0)}\n",
                ]
            )

        # 添加结构分析
        if analysis_data.get("structure"):
            structure = analysis_data["structure"]
            report_lines.extend(
                [
                    "\n## 📚 文章结构\n",
                ]
            )
            for section, info in structure.items():
                report_lines.append(f"- **{section}**: {info}")

        report_lines.append("\n---\n*由 AI 深度分析生成*")

        return "\n".join(report_lines)
