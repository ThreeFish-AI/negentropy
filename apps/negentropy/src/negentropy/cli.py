"""
Negentropy CLI Entry Point.

Provides:
    uv run negentropy            Launch the ADK web server (default)
    uv run negentropy init       Initialize user configuration
    uv run negentropy -c path    Launch with custom config path
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def _cmd_init(args: argparse.Namespace) -> int:
    """Copy config.default.yaml to ~/.negentropy/config.yaml."""
    from negentropy.config.yaml_loader import USER_CONFIG_DIR, USER_CONFIG_FILE, get_default_config_path

    if USER_CONFIG_FILE.exists() and not args.force:
        print(f"配置文件已存在: {USER_CONFIG_FILE}")
        print("使用 --force 覆盖现有配置")
        return 1

    USER_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    default_path = get_default_config_path()
    shutil.copy2(default_path, USER_CONFIG_FILE)
    print(f"配置文件已初始化: {USER_CONFIG_FILE}")
    print("请编辑该文件以自定义配置。密钥类配置请通过环境变量设置。")
    return 0


def _cmd_serve(args: argparse.Namespace) -> int:
    """Launch the ADK web server (equivalent to ``adk web``)."""
    # Build environment for subprocess (inherit current + add NE_CONFIG_PATH)
    env = None
    if args.config:
        config_path = Path(args.config).resolve()
        if not config_path.is_file():
            print(f"错误: 配置文件不存在: {config_path}", file=sys.stderr)
            return 1
        import os

        env = os.environ.copy()
        env["NE_CONFIG_PATH"] = str(config_path)

    # Determine port and host
    port = args.port or 3292
    host = args.host or "0.0.0.0"

    # Build adk web command
    cmd = [
        sys.executable,
        "-m",
        "google.adk.cli",
        "web",
        "--port",
        str(port),
        "--host",
        host,
        "--reload_agents",
        "src/negentropy",
    ]

    return subprocess.call(cmd, env=env)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="negentropy",
        description="Negentropy — AI Agent 熵减系统",
    )
    parser.add_argument(
        "-c",
        "--config",
        help="自定义 YAML 配置文件路径",
        default=None,
    )

    subparsers = parser.add_subparsers(dest="command")

    # init subcommand
    init_parser = subparsers.add_parser("init", help="初始化用户配置文件")
    init_parser.add_argument("--force", action="store_true", help="覆盖现有配置")

    # serve subcommand
    serve_parser = subparsers.add_parser("serve", help="启动 ADK Web 服务器")
    serve_parser.add_argument("--port", type=int, default=3292, help="服务器端口 (默认: 3292)")
    serve_parser.add_argument("--host", default="0.0.0.0", help="绑定地址 (默认: 0.0.0.0)")
    serve_parser.add_argument("--no-reload", action="store_true", help="禁用热重载")

    args = parser.parse_args()

    if args.command == "init":
        sys.exit(_cmd_init(args))
    else:
        # Default: serve
        sys.exit(_cmd_serve(args))


if __name__ == "__main__":
    main()
