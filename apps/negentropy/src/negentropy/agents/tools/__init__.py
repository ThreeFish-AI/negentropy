"""
Faculty Tools - 系部工具集

导出所有系部专用工具。

各模块说明:
- common: 通用工具（日志等）
- perception: 感知系部工具（搜索、检索）
- internalization: 内化系部工具（记忆、知识图谱）
- contemplation: 沉思系部工具（分析、规划）
- action: 行动系部工具（执行、文件操作）
- influence: 影响系部工具（发布、通知）
- skill_registry: Skills Layer 2 触发器（expand_skill / list_available_skills）
- skill_resources: Skills Layer 3 资源懒加载（fetch_skill_resource）
- paper_hunter: arXiv 论文采集（fetch_papers）
"""

# 系部专用工具
from .action import execute_code, read_file, write_file
from .common import log_activity
from .contemplation import analyze_context, create_plan
from .influence import publish_content, send_notification
from .internalization import save_to_memory, update_knowledge_graph
from .paper_hunter import fetch_papers
from .perception import search_knowledge_base, search_web
from .skill_registry import expand_skill, list_available_skills
from .skill_resources import fetch_skill_resource

__all__ = [
    # 通用工具
    "log_activity",
    # 感知工具
    "search_knowledge_base",
    "search_web",
    # 内化工具
    "save_to_memory",
    "update_knowledge_graph",
    # 沉思工具
    "analyze_context",
    "create_plan",
    # 行动工具
    "execute_code",
    "read_file",
    "write_file",
    # 影响工具
    "publish_content",
    "send_notification",
    # Skills 触发器（Layer 2）
    "expand_skill",
    "list_available_skills",
    # Skills 资源（Layer 3）
    "fetch_skill_resource",
    # 论文采集（Paper Hunter）
    "fetch_papers",
]
