"""技能定义包。导入此包触发所有技能的 @register_skill 注册。"""

from .web_audit import WebAuditSkill  # noqa: F401

__all__ = ["WebAuditSkill"]
