"""media/pipeline 测试公共夹具。

落位说明：仓库根无 tests/；apps/negentropy 的 tests/conftest.py 是 session 级
autouse 建 Postgres 夹具，pytest 只加载 rootdir→测试文件路径上的 conftest，
本目录不在那条祖先链上——结构上不可能被拉起 DB。全部用例无网络、无 TTS、
无 ffmpeg、无 Postgres，总时长秒级。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

PIPELINE_SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(PIPELINE_SCRIPTS))


@pytest.fixture()
def constants() -> dict:
    return json.loads((FIXTURES / "timing.json").read_text(encoding="utf-8"))


@pytest.fixture()
def manifest_items() -> list[dict]:
    return json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))


@pytest.fixture()
def project(tmp_path: Path) -> Path:
    """最小工程骨架：fixtures 内容铺进临时目录（check/captions 等按真实布局消费）。"""
    root = tmp_path / "fixture-video"
    (root / "script").mkdir(parents=True)
    (root / "video" / "public" / "audio").mkdir(parents=True)
    (root / "video" / "src").mkdir(parents=True)
    for name in ("narration.md", "narration.json", "storyboard.md"):
        (root / "script" / name).write_bytes((FIXTURES / name).read_bytes())
    (root / "video" / "src" / "timing.json").write_bytes(
        (FIXTURES / "timing.json").read_bytes()
    )
    (root / "video" / "src" / "design").mkdir()
    (root / "video" / "src" / "design" / "theme.ts").write_bytes(
        (FIXTURES / "theme.ts").read_bytes()
    )
    (root / "video" / "public" / "audio" / "manifest.json").write_bytes(
        (FIXTURES / "manifest.json").read_bytes()
    )
    return root
