"""
Sandbox MCP Integration
Provides utilities to expose the sandbox as an MCP Tool.
"""

try:
    from mcp import StdioServerParameters
except ImportError:
    # Use a dummy class/mock if mcp is not installed yet, to allow import
    class StdioServerParameters:
        def __init__(self, command, args, env):
            self.command = command
            self.args = args
            self.env = env


async def create_mcp_sandbox_tool():
    """
    Agent 通过 MCP 调用沙箱

    Returns:
        StdioServerParameters: MCP server connection parameters
    """
    # microsandbox 内置 MCP Server，可直接作为 Tool 调用
    # 这一步假设 'msb' 命令已在 PATH 中可用 (通过 pip install microsandbox 安装)
    server_params = StdioServerParameters(command="msb", args=["mcp", "serve"], env={})
    return server_params  # 注册到 ToolRegistry
