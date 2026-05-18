"""Translation Agent - 封装翻译功能."""

import logging
from pathlib import Path
from typing import Any

from .base import BaseAgent

logger = logging.getLogger(__name__)


class TranslationAgent(BaseAgent):
    """翻译处理专用 Agent."""

    def __init__(self, config: dict[str, Any] | None = None):
        """初始化 TranslationAgent.

        Args:
            config: 配置参数
        """
        super().__init__("translator", config)
        self.papers_dir = Path(config.get("papers_dir", "papers") if config else "papers")
        self.default_options: dict[str, Any] = {
            "target_language": "zh",
            "preserve_format": True,
            "preserve_code": True,
            "preserve_formulas": True,
            "batch_size": 5000,  # 每批处理的字符数
        }

    async def process(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """处理翻译请求.

        Args:
            input_data: 包含 content 和相关选项

        Returns:
            翻译结果
        """
        content = input_data.get("content")
        options = {**self.default_options, **input_data.get("options", {})}

        if not content:
            return {"success": False, "error": "No content provided"}

        return await self.translate(
            {
                "content": content,
                "target_language": options["target_language"],
                "preserve_format": options["preserve_format"],
                "preserve_code": options["preserve_code"],
                "preserve_formulas": options["preserve_formulas"],
                "paper_id": input_data.get("paper_id"),
            }
        )

    async def translate(self, params: dict[str, Any]) -> dict[str, Any]:
        """翻译文本内容.

        Args:
            params: 翻译参数

        Returns:
            翻译结果
        """
        content = params.get("content", "")
        target_language = params.get("target_language", "zh")
        preserve_format = params.get("preserve_format", True)
        preserve_code = params.get("preserve_code", True)
        preserve_formulas = params.get("preserve_formulas", True)
        paper_id = params.get("paper_id")

        try:
            # 检查内容长度，决定是否需要批处理
            content_length = len(content)
            batch_size = self.default_options["batch_size"]

            if content_length <= int(batch_size):
                # 单次翻译
                result = await self._translate_single(
                    {
                        "content": content,
                        "target_language": target_language,
                        "preserve_format": preserve_format,
                        "preserve_code": preserve_code,
                        "preserve_formulas": preserve_formulas,
                    }
                )

                if result["success"] and paper_id:
                    await self._save_translation(paper_id, result["data"]["content"])

                return result
            else:
                # 批量翻译
                return await self._translate_batch(
                    {
                        "content": content,
                        "target_language": target_language,
                        "preserve_format": preserve_format,
                        "preserve_code": preserve_code,
                        "preserve_formulas": preserve_formulas,
                        "batch_size": batch_size,
                        "paper_id": paper_id,
                    }
                )

        except Exception as e:
            logger.error(f"Error in translation: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _translate_single(self, params: dict[str, Any]) -> dict[str, Any]:
        """单次翻译.

        Args:
            params: 翻译参数

        Returns:
            翻译结果
        """
        skill_params = {
            "content": params["content"],
            "target_language": params["target_language"],
            "preserve_format": params["preserve_format"],
            "preserve_code_blocks": params["preserve_code"],
            "preserve_math_formulas": params["preserve_formulas"],
        }

        result = await self.call_skill("zh-translator", skill_params)

        if result["success"]:
            return {
                "success": True,
                "data": {
                    "content": result["data"],
                    "word_count": len(params["content"].split()),
                    "batch_count": 1,
                },
            }
        else:
            return result

    async def _translate_batch(self, params: dict[str, Any]) -> dict[str, Any]:
        """批量翻译.

        Args:
            params: 批量翻译参数

        Returns:
            翻译结果
        """
        content = params["content"]
        batch_size = params["batch_size"]
        paper_id = params.get("paper_id")

        # 分割内容
        batches = self._split_content(content, batch_size)

        logger.info(f"Splitting content into {len(batches)} batches for translation")

        # 准备批量调用
        calls = []
        for batch in batches:
            calls.append(
                {
                    "skill": "zh-translator",
                    "params": {
                        "content": batch,
                        "target_language": params["target_language"],
                        "preserve_format": params["preserve_format"],
                        "preserve_code_blocks": params["preserve_code"],
                        "preserve_math_formulas": params["preserve_formulas"],
                    },
                }
            )

        # 批量翻译
        results = await self.batch_call_skill(calls)

        # 合并结果
        translated_batches = []
        total_word_count = 0

        for i, result in enumerate(results):
            if isinstance(result, dict) and result.get("success"):
                translated_batches.append(result["data"])
                total_word_count += len(result["data"].split())
            else:
                logger.error(f"Batch {i} translation failed: {result}")
                # 使用原文作为后备
                translated_batches.append(batches[i])
                total_word_count += len(batches[i].split())

        # 合并翻译内容
        translated_content = "".join(translated_batches)

        # 保存翻译结果
        if paper_id:
            await self._save_translation(paper_id, translated_content)

        return {
            "success": True,
            "data": {
                "content": translated_content,
                "word_count": total_word_count,
                "batch_count": len(batches),
            },
        }

    def _split_content(self, content: str, batch_size: int) -> list[str]:
        """将内容分割成批次。

        Args:
            content: 内容
            batch_size: 批次大小（字符数）

        Returns:
            分割后的内容列表
        """
        batches = []
        current_batch = ""

        # 按段落分割，避免在句子中间分割
        paragraphs = content.split("\n\n")

        for paragraph in paragraphs:
            # 如果当前批次加上这个段落超过大小限制
            if len(current_batch) + len(paragraph) + 2 > batch_size:
                if current_batch:
                    batches.append(current_batch)
                    current_batch = ""

                # 如果单个段落就超过限制，强制分割
                if len(paragraph) > batch_size:
                    sentences = paragraph.split("。")
                    temp_batch = ""

                    for sentence in sentences:
                        if len(temp_batch) + len(sentence) + 1 > batch_size:
                            if temp_batch:
                                batches.append(temp_batch)
                                temp_batch = ""
                        temp_batch += sentence + "。"

                    if temp_batch:
                        current_batch = temp_batch
                else:
                    current_batch = paragraph
            else:
                if current_batch:
                    current_batch += "\n\n" + paragraph
                else:
                    current_batch = paragraph

        if current_batch:
            batches.append(current_batch)

        return batches

    async def _save_translation(self, paper_id: str, content: str) -> None:
        """保存翻译结果.

        Args:
            paper_id: 论文ID
            content: 翻译内容
        """
        try:
            category = paper_id.split("_")[0] if "_" in paper_id else "general"
            output_dir = self.papers_dir / "translation" / category
            output_dir.mkdir(parents=True, exist_ok=True)

            output_file = output_dir / f"{paper_id}.md"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(content)

            logger.info(f"Translation saved to {output_file}")
        except Exception as e:
            logger.error(f"Error saving translation: {str(e)}")

    async def validate_translation(self, original: str, translated: str) -> dict[str, Any]:
        """验证翻译质量.

        Args:
            original: 原文
            translated: 译文

        Returns:
            验证结果
        """
        # 简单的验证逻辑
        original_length = len(original)
        translated_length = len(translated)

        # 检查长度比例（中文字符通常会少一些）
        length_ratio = translated_length / original_length if original_length > 0 else 0

        # 检查是否保留了代码块
        code_blocks_original = self._count_code_blocks(original)
        code_blocks_translated = self._count_code_blocks(translated)

        # 检查是否保留了数学公式
        formula_blocks_original = self._count_formula_blocks(original)
        formula_blocks_translated = self._count_formula_blocks(translated)

        validation: dict[str, Any] = {
            "valid": True,
            "warnings": [],
            "stats": {
                "original_length": original_length,
                "translated_length": translated_length,
                "length_ratio": length_ratio,
                "code_blocks_preserved": code_blocks_original == code_blocks_translated,
                "formulas_preserved": formula_blocks_original == formula_blocks_translated,
            },
        }

        # 添加警告
        if length_ratio < 0.3 or length_ratio > 2.0:
            validation["warnings"].append("Translation length seems unusual")

        if code_blocks_original != code_blocks_translated:
            validation["warnings"].append("Code blocks may not be preserved correctly")

        if formula_blocks_original != formula_blocks_translated:
            validation["warnings"].append("Math formulas may not be preserved correctly")

        return validation

    def _count_code_blocks(self, content: str) -> int:
        """计算代码块数量.

        Args:
            content: 内容

        Returns:
            代码块数量
        """
        import re

        return len(re.findall(r"```.*?```", content, re.DOTALL))

    def _count_formula_blocks(self, content: str) -> int:
        """计算数学公式数量.

        Args:
            content: 内容

        Returns:
            数学公式数量
        """
        import re

        # LaTeX 公式
        return len(re.findall(r"\$\$.*?\$\$|\$.*?\$", content, re.DOTALL))
