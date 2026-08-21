#!/usr/bin/env python3
"""pipeline.toml 的 schema、默认值与校验——单一事实源。

## 此前的问题

schema 是「pipeline.py 与 check_script.py 里 `.get()` 调用的并集」：无处可查、
无法校验、键名 typo 静默生效。且两方对「缺文件」的处置**相反**——pipeline.py
硬退出，check_script.py 返回 `{}`。后者才是真问题：`{}` 让 `target_minutes`
时长预算门**静默跳过**，一个「你以为开着其实关着的门」比 fatal 和 soft 都糟。

## 为什么不引 pydantic

全部脚本走 `uv run --no-project`，运行期依赖靠各调用点 `--with` 逐个声明；而
三个薄包装用 `sys.executable` 再 exec，继承调用方的 uv 环境。新增一个运行期
依赖要同步 pipeline.py 所有 `uv_no_project` 调用点 + 3 个薄包装的调用契约 +
4 份 README。为 20 行 schema 付这个代价违反最小干预。纯声明式 dict 足够。

## 默认值放在代码、toml 只写偏离

这**就是**原本 `.get(k, default)` 的行为，此处只是把默认值集中并文档化，零新机制。
删哪些键的判据是正交的一条线：**删机制常数，留策略声明**。
  - 机制常数（chars_per_min / lang / draft_scale / draft_jpeg_quality）四集零差异、
    没有「本集为何选它」可讲 → 从 toml 删除，默认值在此。
  - 策略声明（engine）有可见替代项（edge），且 `.engine` 音色签名护栏让它语义
    承重 → **保留在 toml**，它是一条决策记录而非默认值。
  - 机器属性（server）→ 只给默认值 + 环境变量覆盖，永不写进受版本控制的 toml
    （沿用 skills/09 对并发度已立的同一原则）。

发现性由 `pipeline.py doctor` 打印带来源标记的配置表补偿（`git config --list
--show-origin` 的标准做法），而不是靠把默认值抄回每个 toml。
"""

from __future__ import annotations

import os
import tomllib
from pathlib import Path

#: (点分键路径, 类型, 默认值, 必填条件, 说明)
#: 必填条件：True = 恒必填；str = 条件表达式（当前只支持 "engine==indextts"）；False = 可选
SCHEMA: tuple[tuple[str, type, object, object, str], ...] = (
    ("episode.slug", str, None, True, "须等于工程目录名，且能在 series.json 中命中"),
    ("narration.target_minutes", list, None, True, "[下限, 上限] 两元素，单位分钟"),
    ("narration.chars_per_min", int, 280, False, "机制常数：含停顿的等效口径"),
    ("tts.engine", str, "indextts", False, "策略声明：indextts | edge"),
    ("tts.ref", str, None, "engine==indextts", "参考样本，**子项目根相对**"),
    ("tts.ref_sha1", str, None, "engine==indextts", "12 位，同 tts.py 口径"),
    ("tts.style", str, None, "engine==indextts", "STYLE_PRESETS 中的档名"),
    ("tts.lang", str, "ZH", False, "机制常数"),
    (
        "tts.server",
        str,
        "http://127.0.0.1:8766",
        False,
        "机器属性；可用 INDEXTTS_SERVER 覆盖",
    ),
    ("render.draft_scale", float, 0.5, False, "机制常数；qa --scale 推断依赖它"),
    ("render.draft_jpeg_quality", int, 60, False, "机制常数"),
)

#: 环境变量覆盖：仅限「机器属性」类键，不进受版本控制的 toml
ENV_OVERRIDES = {"tts.server": "INDEXTTS_SERVER"}

_KNOWN = {k for k, *_ in SCHEMA}
_SECTIONS = {k.split(".")[0] for k in _KNOWN}


def _get(cfg: dict, dotted: str):
    sec, key = dotted.split(".", 1)
    body = cfg.get(sec, {})
    # 节可能是标量/列表（toml 把节写成非表）：按「键不存在」处理，判定归 validate()
    return body.get(key) if isinstance(body, dict) else None


def _set(cfg: dict, dotted: str, value) -> None:
    sec, key = dotted.split(".", 1)
    cfg.setdefault(sec, {})[key] = value


def _nearest(name: str, pool: set[str]) -> str | None:
    """给键名 typo 一个最近邻建议——typo 是最真实的失效模式。

    cutoff 定在 0.8：实测 0.7 会把「同节的另一个合法键」误判成 typo
    （`episode.title` → 建议 `episode.slug`），而真 typo（`tts.styl`）在 0.8
    仍能命中。一个乱指的建议比没有建议更容易把人带偏。
    """
    import difflib

    hit = difflib.get_close_matches(name, sorted(pool), n=1, cutoff=0.8)
    return hit[0] if hit else None


def resolve(raw: dict) -> tuple[dict, dict[str, str]]:
    """填默认值 + 应用环境变量覆盖 → (完整配置, {键: 来源})。

    来源取值：pipeline.toml | default | env:<VAR>，供 doctor 打印。
    已知节被写成非表（如 `episode = "slug"`）时以空表进入 cfg——「应为表」的
    FAIL 判定归 validate()，此处若崩溃则该分支永远不可达，且 status/doctor
    这类「配置有病也必须能跑」的诊断命令会一并死掉。
    """
    cfg = {s: dict(raw[s]) if isinstance(raw.get(s), dict) else {} for s in _SECTIONS}
    origin: dict[str, str] = {}
    for dotted, _t, default, _req, _note in SCHEMA:
        if (env := ENV_OVERRIDES.get(dotted)) and os.environ.get(env):
            _set(cfg, dotted, os.environ[env])
            origin[dotted] = f"env:{env}"
        elif _get(raw, dotted) is not None:
            origin[dotted] = "pipeline.toml"
        elif default is not None:
            _set(cfg, dotted, default)
            origin[dotted] = "default"
        else:
            origin[dotted] = "缺失"
    return cfg, origin


def validate(
    cfg: dict, raw: dict, root: Path, scope: set[str] | None = None
) -> tuple[list[str], list[str]]:
    """→ (FAIL 消息, WARN 消息)。不退出——由调用方决定退出语义。

    `scope` = 需要执法**必填性与取值域**的节名集合，None = 全部。边界管理：
    每个消费者只校验自己消费的东西。内容门（check_script）不该因为「还没挑配音
    样本」而拒绝检查分镜覆盖性——那是把 TTS 的前置条件强加给 ④⑤ 阶段。
    未知键 WARN 始终全局报告：typo 检测对谁都有用，且只是 WARN。
    """
    fails: list[str] = []
    warns: list[str] = []
    engine = _get(cfg, "tts.engine")

    # 未知键 → WARN（保留前向兼容）+ 最近邻建议
    for sec, body in raw.items():
        if sec not in _SECTIONS:
            warns.append(f"未知配置节 [{sec}]")
            continue
        if not isinstance(body, dict):
            fails.append(f"[{sec}] 应为表（table），实际 {type(body).__name__}")
            continue
        for key in body:
            dotted = f"{sec}.{key}"
            if dotted not in _KNOWN:
                tip = _nearest(dotted, _KNOWN)
                warns.append(
                    f"未知键 {dotted}（无人读取）"
                    + (f"，是否想写 {tip}？" if tip else "")
                )

    for dotted, typ, _default, required, _note in SCHEMA:
        if scope is not None and dotted.split(".")[0] not in scope:
            continue
        val = _get(cfg, dotted)
        need = required is True or (
            isinstance(required, str)
            and required == "engine==indextts"
            and engine == "indextts"
        )
        if val is None:
            if need:
                fails.append(f"缺少必填键 {dotted}")
            continue
        if typ is float and isinstance(val, int):
            val = float(val)  # TOML 的 1 与 1.0 是不同类型，此处不苛求
        if not isinstance(val, typ):
            fails.append(f"{dotted} 类型应为 {typ.__name__}，实际 {type(val).__name__}")

    # 取值域（同样只在 scope 内）
    def in_scope(dotted: str) -> bool:
        return scope is None or dotted.split(".")[0] in scope

    tm = _get(cfg, "narration.target_minutes") if in_scope("narration.x") else None
    if isinstance(tm, list) and (
        len(tm) != 2
        or not all(isinstance(x, (int, float)) for x in tm)
        or tm[0] > tm[1]
    ):
        fails.append(
            f"narration.target_minutes 应为 [下限, 上限] 且下限 ≤ 上限，实际 {tm}"
        )
    ds = _get(cfg, "render.draft_scale") if in_scope("render.x") else None
    if isinstance(ds, (int, float)) and not (0 < ds <= 1):
        fails.append(f"render.draft_scale 应落在 (0, 1]，实际 {ds}")
    sha = _get(cfg, "tts.ref_sha1") if in_scope("tts.x") else None
    if isinstance(sha, str) and len(sha) != 12:
        fails.append(f"tts.ref_sha1 应为 12 位（同 tts.py 口径），实际 {len(sha)} 位")

    # 跨源身份校验：把一份「无人读取的死数据」变成两个 SSOT 之间的连接件。
    # 它防的不是运行期 bug（没人读 slug），而是 `cp -r` 出来的陈旧 toml
    # 看起来很权威 —— 而现行脚手架恰恰就是 cp -r。
    slug = _get(cfg, "episode.slug") if in_scope("episode.x") else None
    if slug and slug != root.name:
        fails.append(f"episode.slug={slug!r} 与工程目录名 {root.name!r} 不一致")
    return fails, warns


def load(
    root: Path, *, required: bool, scope: set[str] | None = None
) -> tuple[dict, dict[str, str], list[str], list[str]]:
    """读 + 填默认 + 校验 → (cfg, origin, fails, warns)。

    `required=False` 时缺文件不是错误，但**必须**由调用方对受影响的门发出点名
    WARN（见 check_script.py）——静默跳过的门是本模块存在的首要原因。
    """
    path = root / "pipeline.toml"
    if not path.is_file():
        if required:
            return {}, {}, [f"缺少分集配置: {path}（字段表见 pipeline/README.md）"], []
        return {}, {}, [], [f"无 pipeline.toml：以默认值运行（{path}）"]
    raw = tomllib.loads(path.read_text(encoding="utf-8"))
    cfg, origin = resolve(raw)
    fails, warns = validate(cfg, raw, root, scope)
    return cfg, origin, fails, warns


def format_table(cfg: dict, origin: dict[str, str]) -> list[str]:
    """带来源标记的配置表（`git config --list --show-origin` 的同类做法）。

    默认值集中到代码后，单看 toml 不再自证全貌——这张表就是发现性补偿。
    """
    out = []
    for dotted, *_ in SCHEMA:
        val = _get(cfg, dotted)
        src = origin.get(dotted, "?")
        out.append(f"     {dotted:<28} = {val!r:<26} ({src})")
    return out
