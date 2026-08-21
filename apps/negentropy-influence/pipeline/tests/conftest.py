"""pipeline 测试公共夹具。

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
EPISODES = Path(__file__).resolve().parents[2] / "episodes"
sys.path.insert(0, str(PIPELINE_SCRIPTS))

#: 剪掉的都是 gitignored 产物目录（体积大，且与「受版本控制」无关）
_PRUNE = {"node_modules", "out", "audio", "__pycache__"}


def _episode_tree() -> dict[str, tuple[int, int]]:
    """→ {路径: (字节数, mtime_ns)}。实测 138 文件 / 3ms。"""
    snap: dict[str, tuple[int, int]] = {}
    stack = [EPISODES] if EPISODES.is_dir() else []
    while stack:
        for p in stack.pop().iterdir():
            if p.is_dir():
                if p.name not in _PRUNE:
                    stack.append(p)
                continue
            st = p.stat()
            snap[str(p)] = (st.st_size, st.st_mtime_ns)
    return snap


@pytest.fixture(scope="session", autouse=True)
def _episodes_stay_pristine():
    """真集工程树完整性守卫：本套用例**不得**改动 `episodes/` 下的真文件。

    由来：`test_missing_config_announces_skipped_gate` 初版删掉真集的
    `pipeline.toml` 再 `finally` 放回 —— pytest 被 Ctrl-C 或进程被杀就把某集
    **唯一的可执行参数源**留在删除态。同一教训已写在 test_skeleton.py 文件头
    （正控一律在 tmp_path 镜像上做，见其 `mirror()`）。

    用**运行期快照**而非静态扫描：原违规的路径构造与 `unlink()` 分处两行，
    单行正则必漏，而漏报的门等于没门；快照对任何改动机制（含 subprocess 写盘、
    误传真路径的脚手架）一律有效，且 mtime 参与比对 ⇒ 「删掉再原样写回」也会红。
    """
    before = _episode_tree()
    yield
    after = _episode_tree()
    diff = sorted(p for p in {*before, *after} if before.get(p) != after.get(p))
    assert not diff, (
        "用例改动了真集工程文件（请改用 tmp_path 镜像，见 test_skeleton.py::mirror）：\n  "
        + "\n  ".join(Path(p).relative_to(EPISODES).as_posix() for p in diff)
    )


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
