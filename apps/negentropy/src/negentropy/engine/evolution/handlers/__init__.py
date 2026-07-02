"""evolution handlers —— 按 target_kind 分派的进化面子包。

- ``base.TargetHandler``：抽象基类（advance_shadow/advance_canary/rollback/maybe_spawn）。
- ``retrieval.RetrievalConfigHandler``：retrieval_config 面（原 orchestrator retrieval 逻辑迁入）。

第二面（skill_template）接入时新增 handler 子类即可，零改动 orchestrator。
"""

from __future__ import annotations

from .base import TargetHandler
from .retrieval import RetrievalConfigHandler
from .skill import SkillProposalDraft, SkillProposer, SkillTemplateHandler

__all__ = [
    "TargetHandler",
    "RetrievalConfigHandler",
    "SkillTemplateHandler",
    "SkillProposer",
    "SkillProposalDraft",
]
