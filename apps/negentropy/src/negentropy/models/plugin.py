"""Plugin 模型兼容层 -- 保持向后兼容，所有符号从子模块 re-export。

实际定义已按正交职责迁移至:
- plugin_common.py: 枚举与权限 (PluginVisibility, PluginPermissionType, PluginPermission)
- builtin_tool.py: 内置工具配置 (BuiltinTool)
- mcp.py: MCP Server / Tool / ResourceTemplate 定义 (McpServer, McpTool, McpResourceTemplate)
- mcp_runtime.py: MCP 执行记录 (McpToolRun, McpToolRunEvent, McpTrialAsset)
- skill.py: 技能定义 (Skill)
- agent.py: Agent 配置 (Agent)
"""

from .agent import Agent  # noqa: F401
from .builtin_tool import BuiltinTool, ensure_dict  # noqa: F401
from .mcp import McpResourceTemplate, McpServer, McpTool  # noqa: F401
from .mcp_runtime import McpToolRun, McpToolRunEvent, McpTrialAsset  # noqa: F401
from .plugin_common import PluginPermission, PluginPermissionType, PluginVisibility  # noqa: F401
from .skill import Skill, SkillSchedule, SkillVersion  # noqa: F401
