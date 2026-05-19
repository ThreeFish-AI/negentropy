"""LLM 竞态评审器：利用 LLM 对多个引擎输出进行质量评估并择优。

在 Pipeline 竞争模式中，当多个引擎同时产出了成功结果时，
本模块通过 LLM 从准确性、结构完整性、格式规范性三个维度进行评分，
返回最优结果的索引。

降级策略：当 LLM 不可用时，回退到基于质量信号的启发式评分。
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from .base import StageResult
from ..core.pipeline_config import CompetitionJudgeConfig

logger = logging.getLogger(__name__)

# 评审 Prompt 模板
_JUDGE_PROMPT = """\
你是一个 PDF 文档解析质量评审专家。请对比以下 {n} 个引擎对同一 PDF 页面的解析结果，
从以下三个维度进行评分（1-10），并选出最优结果。

评分维度：
1. **准确性**：文本内容是否准确还原了原始 PDF 的信息，有无丢失或错误
2. **结构完整性**：标题层级、段落划分、表格结构、公式格式是否正确
3. **格式规范性**：Markdown 语法是否正确，有无格式错误（如误识别的表格）

{candidates}

请以 JSON 格式返回评审结果：
```json
{{
  "evaluations": [
    {{"index": 0, "accuracy": <1-10>, "structure": <1-10>, "format": <1-10>, "total": <sum>, "reason": "<brief>"}},
    ...
  ],
  "best_index": <0-based index of the best result>,
  "reason": "<one sentence explaining why this result is best>"
}}
```"""


class LLMCompetitionJudge:
    """LLM 竞态评审器。

    特性：
    * 延迟初始化 LLMClient，不影响无 LLM 场景的启动
    * JSON 输出解析容错（容忍 markdown 围栏）
    * LLM 不可用时回退到启发式评分
    """

    def __init__(
        self,
        config: Optional[CompetitionJudgeConfig] = None,
        api_key: Optional[str] = None,
        api_base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        self._config = config or CompetitionJudgeConfig()
        self._api_key = api_key
        self._api_base_url = api_base_url
        self._model = model or self._config.model
        self._client: Optional[Any] = None

    def is_available(self) -> bool:
        """检查 LLM 依赖和配置是否就绪。"""
        try:
            from ..pdf.llm.client import LLMClient

            return LLMClient.is_available()
        except ImportError:
            return False

    def _get_client(self):
        """延迟初始化 LLM 客户端。"""
        if self._client is not None:
            return self._client

        from ..pdf.llm.client import LLMClient

        kwargs: Dict[str, Any] = {
            "temperature": self._config.temperature,
            "max_tokens": self._config.max_tokens,
        }
        if self._model:
            kwargs["model"] = self._model
        if self._api_key:
            kwargs["api_key"] = self._api_key
        if self._api_base_url:
            kwargs["api_base_url"] = self._api_base_url

        self._client = LLMClient(**kwargs)
        return self._client

    async def judge(
        self,
        stage_name: str,
        candidates: List[StageResult],
    ) -> int:
        """对比多个候选结果，返回最优结果的索引。

        Args:
            stage_name: Stage 名称（用于日志）
            candidates: 成功的候选结果列表

        Returns:
            最优结果的索引（0-based）
        """
        if not candidates:
            return 0
        if len(candidates) == 1:
            return 0

        # 尝试 LLM 评审
        if self.is_available():
            try:
                return await self._llm_judge(stage_name, candidates)
            except Exception as e:
                logger.warning(
                    "LLM 评审失败，回退到启发式评分 stage=%s error=%s",
                    stage_name,
                    e,
                )

        # 回退到启发式评分
        return self._heuristic_judge(candidates)

    async def _llm_judge(
        self,
        stage_name: str,
        candidates: List[StageResult],
    ) -> int:
        """使用 LLM 进行评审。"""
        client = self._get_client()

        # 构建候选内容（转义三反引号防止 prompt 注入）
        candidate_parts = []
        for i, result in enumerate(candidates):
            engine = getattr(result, "engine_used", f"engine_{i}")
            output = result.output
            content = ""
            if output is not None and hasattr(output, "markdown"):
                content = output.markdown[:2000]  # 截断避免过长
            elif output is not None and hasattr(output, "text"):
                content = output.text[:2000]
            elif isinstance(output, str):
                content = output[:2000]
            # 转义三反引号，防止候选内容中的 ``` 终止代码围栏
            safe_content = content.replace("```", "` ` `")
            candidate_parts.append(
                f"---\n**引擎 {i} ({engine})**:\n```\n{safe_content}\n```"
            )

        prompt = _JUDGE_PROMPT.format(
            n=len(candidates),
            candidates="\n".join(candidate_parts),
        )

        messages = [
            {
                "role": "system",
                "content": "你是一个专业的文档解析质量评审专家，输出必须是合法 JSON。",
            },
            {"role": "user", "content": prompt},
        ]

        response = await client.acompletion(
            messages, response_format={"type": "json_object"}
        )

        from ..pdf.llm.client import LLMClient

        parsed = LLMClient.parse_json_response(response)

        best_index = parsed.get("best_index", 0)
        reason = parsed.get("reason", "")
        logger.info(
            "LLM 评审完成 stage=%s best=%d/%d reason=%s",
            stage_name,
            best_index,
            len(candidates),
            reason,
        )

        # 安全检查索引范围
        if (
            not isinstance(best_index, int)
            or best_index < 0
            or best_index >= len(candidates)
        ):
            logger.warning("LLM 评审返回无效索引 %d，回退到启发式评分", best_index)
            return self._heuristic_judge(candidates)

        return best_index

    @staticmethod
    def _heuristic_judge(candidates: List[StageResult]) -> int:
        """启发式评分：基于输出内容的质量信号进行评分。"""
        best_idx = 0
        best_score = -1.0

        for i, result in enumerate(candidates):
            output = result.output
            content = ""
            if output is not None and hasattr(output, "markdown"):
                content = output.markdown
            elif output is not None and hasattr(output, "text"):
                content = output.text
            elif isinstance(output, str):
                content = output

            if not content:
                continue

            score = _heuristic_score(content)
            engine_priority = 0
            engine = getattr(result, "engine_used", "")
            if "docling" in engine:
                engine_priority = 10
            elif "mineru" in engine:
                engine_priority = 8
            elif "marker" in engine:
                engine_priority = 6
            elif "pymupdf" in engine:
                engine_priority = 4

            total = score + engine_priority * 2
            if total > best_score:
                best_score = total
                best_idx = i

        return best_idx


def _heuristic_score(content: str) -> float:
    """基于内容质量信号的启发式评分。"""
    import re as _re

    lines = content.split("\n")
    heading_count = sum(1 for line in lines if _re.match(r"^#{1,6}\s+", line))
    table_pipe_count = sum(
        1 for line in lines if "|" in line and line.strip().startswith("|")
    )
    formula_block_count = len(_re.findall(r"\$\$[\s\S]+?\$\$", content))
    formula_inline_count = len(_re.findall(r"(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)", content))
    code_fence_count = len(_re.findall(r"```", content)) // 2
    image_count = len(_re.findall(r"!\[.*?\]\(.*?\)", content))

    return (
        len(content.split()) * 0.001
        + heading_count * 5
        + table_pipe_count * 3
        + formula_block_count * 10
        + formula_inline_count * 2
        + code_fence_count * 5
        + image_count * 3
    )
