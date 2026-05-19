"""Pipeline 编排配置模型。

定义 YAML Pipeline 配置的 Pydantic 数据结构，
供 ``config.py`` 的 ``NegentropyPerceivesSettings.pipeline`` 字段使用。
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class CompetitionJudgeConfig(BaseModel):
    """竞争模式 LLM 评审配置。"""

    enabled: bool = True
    strategy: str = "best_of"  # "best_of" | "merge" | "weighted"
    model: Optional[str] = None  # null = 继承全局 llm.model
    temperature: float = 0.1
    max_tokens: int = 2048


class CompetitionConfig(BaseModel):
    """Stage 竞争模式配置。"""

    max_concurrent: int = 2
    timeout: int = 120
    judge: CompetitionJudgeConfig = CompetitionJudgeConfig()


class StageToolConfig(BaseModel):
    """Stage 内单个工具的配置。"""

    name: str
    rank: int = 1
    enabled: bool = True


class StageConfig(BaseModel):
    """单个 Stage 的配置。"""

    name: str
    description: str = ""
    tools: List[StageToolConfig] = []
    competition_mode: bool = False
    competition: Optional[CompetitionConfig] = None
    input_from: Optional[str] = None
    """可选：引用前序 Stage 名称，取其 ``StageResult.output`` 作为本 Stage 输入。

    未设置时保留 "上一 Stage 输出即下一 Stage 输入" 的链式语义（向后兼容）。
    """
    input_builder: Optional[str] = None
    """可选：引用 Pipeline 注册的复合输入构造器 key。

    构造器签名 ``(results: Dict[str, StageResult], initial_input) -> Any``，
    用于由多个前序 Stage 结果聚合出非链式输入（如 ``AssemblyInput``）。
    """


class PipelineBranchConfig(BaseModel):
    """单条管线（PDF 或 WebPage）的配置。"""

    stages: List[StageConfig] = []


class PipelineDefaultsConfig(BaseModel):
    """Pipeline 全局默认配置。"""

    competition: CompetitionConfig = CompetitionConfig()


class PipelineConfig(BaseModel):
    """完整 Pipeline 配置。"""

    pdf: PipelineBranchConfig = PipelineBranchConfig()
    webpage: PipelineBranchConfig = PipelineBranchConfig()
    defaults: PipelineDefaultsConfig = PipelineDefaultsConfig()
