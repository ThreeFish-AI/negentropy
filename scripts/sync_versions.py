# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "tomlkit>=0.12",
#   "packaging>=24",
# ]
# ///
"""全局版本号单一事实源（SSOT）同步 / 校验脚本。

SSOT 为仓库根 ``VERSION`` 文件（单行 PEP440 / SemVer 字符串，如 ``0.0.1-rc.1``）。
本脚本将其「投射」到主栈 6 个清单（4 package.json + 2 pyproject.toml），
并刷新受影响 Python app 的 ``uv.lock``。

设计要点（贴合 AGENTS.md「单一事实源 + 最小干预 + 正交分解」）：

* **管辖清单显式列出** —— 不用 glob 扫描，避免误纳入独立项目（cognizes / cognizes-ui）。
* **保格式写入** —— pyproject 经 tomlkit（保留注释 / 缩进 / 行序 / 行内注释），
  package.json 经行级正则替换首个顶层 ``"version"`` 行（保留缩进 / 引号风格），
  两者写回均经 tomllib / json 复验语法合法。
* **规范化比对** —— ``packaging.version.parse`` 归一后比较，使 ``0.0.1-rc.1`` ≡ ``0.0.1rc1``，
  避免 ``uv.lock`` 被 uv 自动规范化为 ``0.0.1rc1`` 时误报漂移。
* **幂等** —— 值（清单为字面、lock 为规范化）已等于 SSOT 则不写，重复 sync 零 diff。

用法::

    uv run scripts/sync_versions.py sync   # 写回清单 + uv lock 刷新受影响 app
    uv run scripts/sync_versions.py check  # 只读校验，任一漂移则 exit 1（供 pre-commit / CI）
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

import tomlkit
from packaging.version import InvalidVersion, Version, parse as parse_version

# ── 路径定位 ────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = REPO_ROOT / "VERSION"

# ── 主栈管辖清单（cognizes / cognizes-ui 为独立项目，刻意排除）─────────────
JS_TARGETS: list[str] = [
    "package.json",  # monorepo root
    "apps/negentropy-ui/package.json",
    "apps/negentropy-wiki/package.json",
    "packages/agents-chat-core/package.json",
]
PY_TARGETS: list[str] = [
    "apps/negentropy/pyproject.toml",
    "apps/negentropy-perceives/pyproject.toml",
]
# pyproject 相对路径 -> (项目分发名, 对应 uv.lock 相对路径)
PY_PROJECT_INFO: dict[str, tuple[str, str]] = {
    "apps/negentropy/pyproject.toml": ("negentropy", "apps/negentropy/uv.lock"),
    "apps/negentropy-perceives/pyproject.toml": ("negentropy-perceives", "apps/negentropy-perceives/uv.lock"),
}


# ── 工具函数 ────────────────────────────────────────────────────────────────
def read_ssot() -> str:
    """读取 VERSION 文件，strip 后返回。"""
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def norm(value: str) -> str:
    """PEP440 规范化；无法解析时原样返回（比对时自然不等，触发 drift）。"""
    try:
        return str(parse_version(value))
    except InvalidVersion:
        return value


def parse_or_none(value: str | None) -> Version | None:
    if value is None:
        return None
    try:
        return parse_version(value)
    except InvalidVersion:
        return None


# ── JS package.json（行级正则，保格式）──────────────────────────────────────
# 匹配首个顶层 "version": "..." 行；package.json 的 dependencies 无 "version" key，
# 故首个命中必为顶层 version。保留前缀缩进与引号风格。
_JS_VERSION_RE = re.compile(r'^(\s*"version"\s*:\s*")([^"]*)(".*)$', re.MULTILINE)


def js_get_version(path: Path) -> str | None:
    match = _JS_VERSION_RE.search(path.read_text(encoding="utf-8"))
    return match.group(2) if match else None


def js_set_version(path: Path, value: str) -> bool:
    """写回 package.json 顶层 version；值已相等或无匹配则返回 False（未改动）。"""
    text = path.read_text(encoding="utf-8")
    match = _JS_VERSION_RE.search(text)
    if match is None or match.group(2) == value:
        return False
    new_text = _JS_VERSION_RE.sub(lambda m: f"{m.group(1)}{value}{m.group(3)}", text, count=1)
    json.loads(new_text)  # 复验 JSON 合法性，非法则抛错中止
    path.write_text(new_text, encoding="utf-8")
    return True


# ── PY pyproject.toml（tomlkit 保格式）──────────────────────────────────────
def py_get_version(path: Path) -> str | None:
    doc = tomlkit.parse(path.read_text(encoding="utf-8"))
    project = doc.get("project")
    if not isinstance(project, dict):
        return None
    value = project.get("version")
    return str(value) if value is not None else None


def py_set_version(path: Path, value: str) -> bool:
    """写回 pyproject [project] version（tomlkit 保留注释 / 格式）；已相等则返回 False。"""
    doc = tomlkit.parse(path.read_text(encoding="utf-8"))
    project = doc.get("project")
    if not isinstance(project, dict) or "version" not in project:
        return False
    if str(project["version"]) == value:
        return False
    project["version"] = value
    new_text = tomlkit.dumps(doc)
    tomllib.loads(new_text)  # 复验 TOML 合法性，非法则抛错中止
    path.write_text(new_text, encoding="utf-8")
    return True


# ── uv.lock（只读：提取项目自身 version）─────────────────────────────────────
def lock_get_project_version(lock_path: Path, project_name: str) -> str | None:
    """从 uv.lock 的 [[package]] 数组中取 name == project_name 的 version。"""
    doc = tomllib.loads(lock_path.read_text(encoding="utf-8"))
    for pkg in doc.get("package", []):
        if pkg.get("name") == project_name:
            ver = pkg.get("version")
            return str(ver) if ver is not None else None
    return None


# ── 子命令：sync ────────────────────────────────────────────────────────────
def cmd_sync() -> int:
    ssot = read_ssot()
    if parse_or_none(ssot) is None:
        print(f"[version] ✗ SSOT {ssot!r} 非合法 PEP440 版本号", file=sys.stderr)
        return 2

    print(f"[version] SSOT = {ssot!r}  (normalized: {norm(ssot)!r})")

    changed_py: list[str] = []

    for rel in JS_TARGETS:
        path = REPO_ROOT / rel
        if js_set_version(path, ssot):
            print(f"  ✓ JS  {rel}  -> {ssot}")
        else:
            print(f"  · JS  {rel}  (已是 {ssot}，跳过)")

    for rel in PY_TARGETS:
        path = REPO_ROOT / rel
        if py_set_version(path, ssot):
            print(f"  ✓ PY  {rel}  -> {ssot}")
            changed_py.append(rel)
        else:
            print(f"  · PY  {rel}  (已是 {ssot}，跳过)")

    # 仅对 version 真正改变的 Python app 刷新 uv.lock（默认 frozen，不升级依赖）
    for rel in changed_py:
        project_name, lock_rel = PY_PROJECT_INFO[rel]
        app_dir = (REPO_ROOT / rel).parent
        lock_path = REPO_ROOT / lock_rel
        print(f"  ⟳ LOCK {lock_rel}  (uv lock 刷新项目 version ...)")
        result = subprocess.run(["uv", "lock"], cwd=app_dir, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"    ✗ uv lock 失败:\n{result.stderr}", file=sys.stderr)
            return 1
        lock_ver = lock_get_project_version(lock_path, project_name)
        if lock_ver is None or norm(lock_ver) != norm(ssot):
            print(
                f"    ✗ lock 中 {project_name} version={lock_ver!r} 与 SSOT {ssot!r} 规范化不等",
                file=sys.stderr,
            )
            return 1
        print(f"    ✓ lock {project_name}  -> {lock_ver}")

    print("[version] sync 完成")
    return 0


# ── 子命令：check ───────────────────────────────────────────────────────────
def cmd_check() -> int:
    ssot = read_ssot()
    ssot_parsed = parse_or_none(ssot)
    if ssot_parsed is None:
        print(f"[version] ✗ SSOT {ssot!r} 非合法 PEP440 版本号", file=sys.stderr)
        return 2

    drift = False

    # 清单：字面必须 == SSOT（保证单一变量字面统一）
    for rel in JS_TARGETS:
        cur = js_get_version(REPO_ROOT / rel)
        if cur != ssot:
            print(f"  ✗ JS   {rel}  {cur!r} != {ssot!r}", file=sys.stderr)
            drift = True
    for rel in PY_TARGETS:
        cur = py_get_version(REPO_ROOT / rel)
        if cur != ssot:
            print(f"  ✗ PY   {rel}  {cur!r} != {ssot!r}", file=sys.stderr)
            drift = True

    # uv.lock：规范化比对（容忍 uv 对 0.0.1-rc.1 -> 0.0.1rc1 的自动规范化）
    for _rel, (project_name, lock_rel) in PY_PROJECT_INFO.items():
        lock_ver = lock_get_project_version(REPO_ROOT / lock_rel, project_name)
        if lock_ver is None or norm(lock_ver) != norm(ssot):
            print(
                f"  ✗ LOCK {lock_rel}  {project_name}={lock_ver!r} != {ssot!r} (normalized)",
                file=sys.stderr,
            )
            drift = True

    if drift:
        print(
            "\n[version] 检测到版本漂移。请运行:  uv run scripts/sync_versions.py sync",
            file=sys.stderr,
        )
        return 1

    print(f"[version] 全部清单与 SSOT {ssot!r} 一致 (lock normalized: {norm(ssot)!r})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="全局版本号单一事实源同步 / 校验")
    parser.add_argument("command", choices=["sync", "check"], help="sync 写回并刷新 lock；check 只读校验")
    args = parser.parse_args()
    return cmd_sync() if args.command == "sync" else cmd_check()


if __name__ == "__main__":
    sys.exit(main())
