"""``negentropy doctor`` —— 首启自检（preflight health check）。

在**启动期**即对「配置就绪度」给出 PASS/WARN/FAIL 报告，把「首次发消息才暴露的静默失败」
（如缺 LLM Key、缺 pgvector、迁移未应用）前移到部署自检，兑现 Evidence-Based 的
「可观测反馈闭环」与 Proactive Navigation 的「消除认知摩擦」。

设计要点：
- 每项检查相互隔离，单项失败不中断其余检查。
- 仅 **FAIL** 导致非 0 退出码；**WARN** 对应既有的 graceful degradation，不阻断。
- 网络/DB 检查硬超时 2s，全命令 <5s，守项目 <3min 测试预算。
- DB 不可达时，DB 相关检查各自报 FAIL 并附原因，非 DB 检查（LLM Key/搜索/Langfuse）仍执行。

退出码：存在任一 FAIL → 1；否则 0。

参考文献：
[1] C. Majors, L. Fong-Jones, and G. Miranda, "Observability Engineering,"
    O'Reilly Media, 2022, ch. 7（探针三分模型：依赖检查不进 liveness）。
"""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from sqlalchemy import text

Status = Literal["PASS", "WARN", "FAIL"]

_PROBE_TIMEOUT = 2.0  # 网络/DB 探针硬超时（秒）
_LLM_KEY_ENVS = ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY")
_OLLAMA_GUIDE = "docs/concepts/local-llm-ollama.md"
_RESET = "\033[0m"
_STATUS_COLOR = {"PASS": "\033[32m", "WARN": "\033[33m", "FAIL": "\033[31m"}


@dataclass
class CheckResult:
    """单项检查结果。"""

    name: str
    status: Status
    detail: str


def _color(status: Status) -> str:
    return f"{_STATUS_COLOR[status]}{status}{_RESET}"


# ── DB 相关检查 ──────────────────────────────────────────────────────────────
async def check_db() -> CheckResult:
    from negentropy.db import AsyncSessionLocal

    try:
        async with (
            asyncio.timeout(_PROBE_TIMEOUT),
            AsyncSessionLocal() as session,
        ):
            await session.execute(text("SELECT 1"))
        return CheckResult("database", "PASS", "可达（SELECT 1）")
    except TimeoutError:
        return CheckResult("database", "FAIL", f"连接超时（>{_PROBE_TIMEOUT:.0f}s）")
    except Exception as exc:  # noqa: BLE001 — 聚合所有 DB 连接异常
        return CheckResult("database", "FAIL", f"{type(exc).__name__}: {exc}")


async def _check_extension(name: str) -> CheckResult:
    from negentropy.db import AsyncSessionLocal

    try:
        async with asyncio.timeout(_PROBE_TIMEOUT), AsyncSessionLocal() as session:
            row = (
                await session.execute(
                    text("SELECT extversion FROM pg_extension WHERE extname = :n"),
                    {"n": name},
                )
            ).first()
        if row is None:
            return CheckResult(name, "FAIL", "扩展未安装")
        return CheckResult(name, "PASS", f"已安装（{row.extversion}）")
    except TimeoutError:
        return CheckResult(name, "FAIL", f"查询超时（>{_PROBE_TIMEOUT:.0f}s）")
    except Exception as exc:  # noqa: BLE001
        return CheckResult(name, "FAIL", f"查询失败: {type(exc).__name__}: {exc}")


async def check_pgvector() -> CheckResult:
    return await _check_extension("vector")


async def check_uuid_ossp() -> CheckResult:
    return await _check_extension("uuid-ossp")


def _alembic_heads() -> set[str]:
    """读取迁移脚本目录的 head（不触达 DB）。"""
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    # cli_doctor.py 位于 src/negentropy/，parents[2] = apps/negentropy/（alembic.ini 所在）
    ini = Path(__file__).resolve().parents[2] / "alembic.ini"
    cfg = Config(str(ini))
    return set(ScriptDirectory.from_config(cfg).get_heads())


async def check_alembic() -> CheckResult:
    """比对 DB 当前版本与脚本 head。"""
    from negentropy.db import AsyncSessionLocal

    try:
        heads = _alembic_heads()
    except Exception as exc:  # noqa: BLE001
        return CheckResult("alembic", "WARN", f"无法读取迁移脚本目录: {type(exc).__name__}: {exc}")

    try:
        async with asyncio.timeout(_PROBE_TIMEOUT), AsyncSessionLocal() as session:
            row = (await session.execute(text("SELECT version_num FROM negentropy.alembic_version LIMIT 1"))).first()
    except TimeoutError:
        return CheckResult("alembic", "FAIL", f"查询超时（>{_PROBE_TIMEOUT:.0f}s）")
    except Exception as exc:  # noqa: BLE001
        return CheckResult("alembic", "FAIL", f"无法读取版本表: {type(exc).__name__}: {exc}")

    if row is None:
        return CheckResult("alembic", "FAIL", "版本表为空：迁移未应用，请执行 `uv run alembic upgrade head`")
    current = row.version_num
    if current in heads:
        return CheckResult("alembic", "PASS", f"已至 head（{current}）")
    if len(heads) > 1:
        return CheckResult("alembic", "WARN", f"迁移存在多 head（分支）{sorted(heads)}；当前 {current}")
    return CheckResult(
        "alembic", "WARN", f"落后于 head：当前 {current}，head {sorted(heads)}（请 alembic upgrade head）"
    )


# ── 非 DB 检查 ───────────────────────────────────────────────────────────────
def check_llm_key() -> CheckResult:
    """LLM Key：核心激活项。无 Key 即 FAIL（启动期暴露，而非首条消息）。"""
    present = [k for k in _LLM_KEY_ENVS if os.getenv(k)]
    if present:
        return CheckResult("llm_key", "PASS", f"已配置 {', '.join(present)}（LiteLLM 原生直读）")
    return CheckResult(
        "llm_key",
        "FAIL",
        f"未配置任何 LLM Key。请在 .env.docker.local 填入 {' / '.join(_LLM_KEY_ENVS)} 至少一个；"
        f"或配置本地 Ollama 零 Key 方案（见 {_OLLAMA_GUIDE}）。",
    )


def check_embedding() -> CheckResult:
    """嵌入：默认 gemini/text-embedding-004（需 GEMINI key）。无则向量降级关键词。"""
    if os.getenv("GEMINI_API_KEY"):
        return CheckResult("embedding", "PASS", "GEMINI_API_KEY 可用（默认 gemini/text-embedding-004，1536 维）")
    return CheckResult(
        "embedding",
        "WARN",
        "未配置 GEMINI_API_KEY：向量检索/语义记忆降级为关键词匹配（对话不受影响）。完整 RAG 需 1536 维云嵌入。",
    )


def check_search() -> CheckResult:
    from negentropy.config import settings

    if settings.search.is_google_configured():
        return CheckResult("search", "PASS", "Google Programmable Search 已配置")
    return CheckResult("search", "WARN", "Web 搜索未配置（search_web 工具将 no-op）")


def check_langfuse() -> CheckResult:
    from negentropy.config import settings

    obs = settings.observability
    if not obs.langfuse_enabled:
        return CheckResult("langfuse", "PASS", "已关闭（本地默认，不外发）")
    has_keys = bool(obs.langfuse_public_key) and bool(obs.langfuse_secret_key)
    if has_keys:
        return CheckResult("langfuse", "PASS", "已启用且密钥就绪")
    return CheckResult("langfuse", "WARN", "已启用但缺密钥（warn-and-continue，不上报）")


async def check_ollama() -> CheckResult | None:
    """仅当已登记 ollama vendor_config 时探活；否则返回 None（跳过）。"""
    import httpx

    from negentropy.db import AsyncSessionLocal

    try:
        async with asyncio.timeout(_PROBE_TIMEOUT), AsyncSessionLocal() as session:
            row = (
                await session.execute(text("SELECT 1 FROM negentropy.vendor_configs WHERE vendor = 'ollama' LIMIT 1"))
            ).first()
    except Exception:  # noqa: BLE001 — DB 异常/超时时静默跳过该可选检查
        return None
    if row is None:
        return None  # 未登记 ollama：跳过

    try:
        async with httpx.AsyncClient(timeout=_PROBE_TIMEOUT) as client:
            resp = await client.get("http://localhost:11434/api/tags")
        if resp.status_code < 400:
            return CheckResult("ollama", "PASS", "可达（:11434，零 Key 本地 LLM）")
        return CheckResult("ollama", "WARN", f"响应异常 HTTP {resp.status_code}")
    except Exception as exc:  # noqa: BLE001
        return CheckResult(
            "ollama", "WARN", f"未运行或不可达（已登记 vendor_config 但 :11434 探活失败: {type(exc).__name__}）"
        )


# ── 运行器 ───────────────────────────────────────────────────────────────────
_CHECKS = (
    check_db,
    check_pgvector,
    check_uuid_ossp,
    check_alembic,
    check_llm_key,
    check_embedding,
    check_search,
    check_langfuse,
    check_ollama,
)


def _short_name(fn) -> str:  # type: ignore[no-untyped-def]
    return getattr(fn, "__name__", "check").removeprefix("check_")


async def run_doctor() -> int:
    """执行全部检查，打印报告，返回退出码（有 FAIL → 1）。"""
    results: list[CheckResult] = []
    for fn in _CHECKS:
        try:
            res = await fn() if asyncio.iscoroutinefunction(fn) else fn()
        except Exception as exc:  # noqa: BLE001 — 单项检查异常不致命
            res = CheckResult(_short_name(fn), "FAIL", f"检查异常: {type(exc).__name__}: {exc}")
        if res is not None:
            results.append(res)

    name_w = max((len(r.name) for r in results), default=8)
    print("\nNegentropy 首启自检（doctor）\n" + "-" * 40)
    for r in results:
        print(f"  {_color(r.status)}  {r.name.ljust(name_w)}  {r.detail}")
    print("-" * 40)

    n_pass = sum(1 for r in results if r.status == "PASS")
    n_warn = sum(1 for r in results if r.status == "WARN")
    n_fail = sum(1 for r in results if r.status == "FAIL")
    print(f"  合计：{n_pass} PASS · {n_warn} WARN · {n_fail} FAIL\n")
    return 1 if n_fail else 0


def run_doctor_sync() -> int:
    """同步入口：供 cli.py 直接 sys.exit 调用。"""
    return asyncio.run(run_doctor())
