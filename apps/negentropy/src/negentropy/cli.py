"""
Negentropy CLI Entry Point.

Provides:
    uv run negentropy            Launch the ADK web server (default)
    uv run negentropy init       Initialize user configuration
    uv run negentropy -c path    Launch with custom config path

Implementation note (graceful shutdown):
    本入口曾通过 ``subprocess.call("python -m google.adk.cli web …")`` 间接拉起
    ADK CLI，导致我们无法在子进程的 uvicorn 启动前注入 patch。ADK 调用
    ``uvicorn.Config(app, host, port, reload=reload)`` 不显式设置
    ``timeout_graceful_shutdown``，uvicorn 默认值为 ``None`` —— 表示「无限等待
    现存连接关闭」。在有任意 SSE / 长连接客户端未主动断开时，``lifespan.shutdown``
    永远不会被触发，业务侧 ``@app.on_event("shutdown")`` 永不执行，调度任务无法
    被取消（这就是日志中 ``title_inspector_tick_started`` 在 Ctrl+C 之后仍继续
    出现的直接原因）。

    现在改为**同进程**通过 ``runpy``/``click`` API 调起 ADK CLI，在 import 前
    安装 :func:`_install_uvicorn_graceful_shutdown_patch`，使
    ``timeout_graceful_shutdown`` 缺省值落到
    ``NEGENTROPY_SHUTDOWN_TIMEOUT_SECONDS``（默认 25s）。显式传值不被覆盖。

参考文献：
[1] R. McMillan et al., "Graceful shutdown patterns for long-running asyncio
    services," IEEE Software, vol. 38, no. 6, pp. 56-63, 2021.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import traceback
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


# F4 Presidio 默认引擎所需 spaCy NER 模型（独立下载产物，非 pip 依赖）。
# en_core_web_lg 是 Presidio 英文默认模型；zh_core_web_sm 支撑中文 NER + CN 自定义识别器。
_PII_SPACY_MODELS = ("en_core_web_lg", "zh_core_web_sm")


def _cmd_bootstrap_pii_models(args: argparse.Namespace) -> int:
    """下载 Presidio PII 引擎所需的 spaCy NER 模型。

    模型是独立下载产物（非 pip 依赖），故单独提供 bootstrap 命令。缺失时
    PII 引擎按 ``memory.pii.allow_engine_fallback`` 降级回 regex，不阻断启动。
    """
    import importlib.util
    import subprocess

    models = _PII_SPACY_MODELS
    failed: list[str] = []
    for model in models:
        if importlib.util.find_spec(model) is not None and not args.force:
            print(f"✔ {model} 已安装，跳过（--force 可强制重装）")
            continue
        print(f"↓ 下载 spaCy 模型 {model} …")
        ret = subprocess.call([sys.executable, "-m", "spacy", "download", model])
        if ret != 0:
            print(f"✘ {model} 下载失败（exit={ret}）")
            failed.append(model)
        else:
            print(f"✔ {model} 安装成功")
    if failed:
        print(f"\n以下模型未能安装: {', '.join(failed)}。")
        print("PII 引擎将按 memory.pii.allow_engine_fallback 降级回 regex；可经 /memory/health 观测实际引擎。")
        return 1
    print("\n全部 PII 模型就绪，可将 memory.pii.engine 设为 presidio。")
    return 0


_UVICORN_PATCH_INSTALLED = False
_DEFAULT_SHUTDOWN_TIMEOUT_SECONDS = 25


def _resolve_shutdown_timeout() -> int | None:
    """Read ``NEGENTROPY_SHUTDOWN_TIMEOUT_SECONDS`` (default 25). 0 / 负值 → 不注入。"""
    raw = os.environ.get("NEGENTROPY_SHUTDOWN_TIMEOUT_SECONDS")
    if raw is None:
        return _DEFAULT_SHUTDOWN_TIMEOUT_SECONDS
    try:
        v = int(float(raw))
    except ValueError:
        return _DEFAULT_SHUTDOWN_TIMEOUT_SECONDS
    return v if v > 0 else None


def _install_uvicorn_graceful_shutdown_patch() -> None:
    """Patch ``uvicorn.Config.__init__`` 让 ``timeout_graceful_shutdown`` 缺省走环境变量。

    幂等：重复调用不会嵌套 patch。显式传 ``timeout_graceful_shutdown`` 的调用方
    （任何值，包括 ``None``）不被覆盖——`None` 仍可主动选择「无限等待」回退现状。
    """
    global _UVICORN_PATCH_INSTALLED
    if _UVICORN_PATCH_INSTALLED:
        return

    import uvicorn  # 延迟 import 保留 init 路径开销最小

    if getattr(uvicorn.Config.__init__, "_negentropy_patched", False):
        _UVICORN_PATCH_INSTALLED = True
        return

    timeout_default = _resolve_shutdown_timeout()
    original_init = uvicorn.Config.__init__

    def _patched_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        if "timeout_graceful_shutdown" not in kwargs and timeout_default is not None:
            kwargs["timeout_graceful_shutdown"] = timeout_default
        return original_init(self, *args, **kwargs)

    _patched_init._negentropy_patched = True  # type: ignore[attr-defined]
    _patched_init._negentropy_default_timeout = timeout_default  # type: ignore[attr-defined]
    uvicorn.Config.__init__ = _patched_init  # type: ignore[method-assign]
    _UVICORN_PATCH_INSTALLED = True


def _cmd_serve(args: argparse.Namespace) -> int:
    """Launch the ADK web server **in-process** (equivalent to ``adk web``).

    与 ``subprocess.call`` 不同，同进程执行允许：
    1. 在 import ``google.adk.cli`` 前 patch ``uvicorn.Config`` 默认参数；
    2. 直接观察 SIGINT 信号在 Python 进程内的传导路径；
    3. 后续 P0-2 在 ``bootstrap.py`` 中借由 ``AdkWebServer.get_fast_api_app``
       的 ``lifespan`` 参数注入业务关停逻辑。
    """
    if args.config:
        config_path = Path(args.config).resolve()
        if not config_path.is_file():
            print(f"错误: 配置文件不存在: {config_path}", file=sys.stderr)
            return 1
        # 同进程化后 env 直接落到 os.environ；ADK / bootstrap 后续读取无差别。
        os.environ["NE_CONFIG_PATH"] = str(config_path)

    port = args.port or 3292
    host = args.host or "0.0.0.0"

    # `apps/negentropy/src` 才是 ADK 的 agents_dir：ADK 会把它加入 sys.path 后
    # `import services`（src/services.py），并按 app_name="negentropy" 解析到
    # `src/negentropy/`。用 __file__ 推导绝对路径，避免依赖启动 cwd——否则一旦
    # 从其它目录执行 `uv run negentropy`，ADK 会以错位 cwd 解析 "src"，复现
    # 「src/negentropy/negentropy」双重段错误。
    agents_dir = (Path(__file__).resolve().parent.parent.parent / "src").resolve()

    # 1) 先安装 uvicorn graceful timeout patch（必须早于任何 import 触发的 uvicorn.Config 调用）
    _install_uvicorn_graceful_shutdown_patch()

    # 2) 通过 click 编程接口直接调起 ADK CLI 的 web 子命令
    from google.adk.cli.cli_tools_click import main as adk_main

    argv = [
        "web",
        "--port",
        str(port),
        "--host",
        host,
        "--reload_agents",
        str(agents_dir),
    ]

    try:
        # standalone_mode=False 让 click 在异常时 raise 而非 sys.exit，便于上层捕获
        adk_main.main(args=argv, standalone_mode=False)
        return 0
    except KeyboardInterrupt:
        # 优雅关停的常态出口：uvicorn 捕获 SIGINT 后传播 KeyboardInterrupt
        return 0
    except SystemExit as exc:
        # click 在某些路径仍可能 raise SystemExit；透传退出码
        return int(exc.code) if isinstance(exc.code, int) else (0 if exc.code is None else 1)
    except BaseException as exc:  # noqa: BLE001 — 顶层兜底
        # click 在 ``standalone_mode=False`` 下，SIGINT 路径抛 ``click.Abort``（视为正常退出），
        # 而 ``click.exceptions.Exit`` 是 click 用来携带退出码的标准机制——任何非 0 的
        # ``exit_code`` 都必须透传，避免把 ADK 通过 Exit 上抛的失败状态吞成 0。
        try:
            import click as _click

            if isinstance(exc, _click.exceptions.Abort):
                return 0
            if isinstance(exc, _click.exceptions.Exit):
                exit_code = getattr(exc, "exit_code", 0)
                try:
                    return int(exit_code)
                except (TypeError, ValueError):  # pragma: no cover — 防御性
                    return 1
        except Exception:  # pragma: no cover
            pass
        # 真实异常（导入失败、配置错误等）才打印
        print(f"错误: ADK 启动失败: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1


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

    # bootstrap-pii-models subcommand（F4 Presidio spaCy NER 模型）
    pii_parser = subparsers.add_parser("bootstrap-pii-models", help="下载 Presidio PII 引擎所需 spaCy NER 模型")
    pii_parser.add_argument("--force", action="store_true", help="即使已安装也强制重新下载")

    args = parser.parse_args()

    if args.command == "init":
        sys.exit(_cmd_init(args))
    elif args.command == "bootstrap-pii-models":
        sys.exit(_cmd_bootstrap_pii_models(args))
    else:
        # Default: serve
        sys.exit(_cmd_serve(args))


if __name__ == "__main__":
    main()
