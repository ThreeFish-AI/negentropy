"""check_archify_coverage 的覆盖度 / 丰富度 / 匹配度判定。

夹具在 tmp_path 铺最小工程（narration 含后缀句与跳号、storyboard 带规范标注、
views/manifest/scenes cue 齐备），真集目录由 conftest 的 `_episodes_stay_pristine`
快照守卫。CLI 门测试断言 (returncode, 输出子串)，同 test_check_script 范式。
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_archify_coverage.py"

NARRATION = [
    {"id": "p0-01", "scene": "P0", "text": "甲"},
    {"id": "p0-02", "scene": "P0", "text": "乙"},
    {"id": "p1-01", "scene": "P1", "text": "丙"},
    {"id": "p1-01a", "scene": "P1", "text": "丁"},  # 后缀句
    {"id": "p1-03", "scene": "P1", "text": "戊"},  # 跳号：p1-02 不存在
]

VIEWS_DEMO = [
    {"id": "ch1", "label": "首章", "focus": ["n1"], "note": "一"},
    {"id": "ch2", "label": "次章", "focus": ["n2"], "note": "二"},
    {"id": "ch3", "label": "三章", "focus": ["n3"], "note": "三"},
]
VIEWS_OTHER = [{"id": "o1", "label": "他章", "focus": ["m1"], "note": "他"}]

MANIFEST_OK = (
    'export const ARCHIFY = {"demo": {"chapters": '
    '[{"id": "ch1"}, {"id": "ch2"}, {"id": "ch3"}]}} as const;\n'
)

BOARD_OK = """# 分镜
## P0
| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 0-A | p0-01..02 | **主装置**：x ·**archify inset**：演示图 章 `ch1`+`ch2` | `@stagger` |
## P1
| 镜 | 句区间 | 画面 | 动效 |
|---|---|---|---|
| 1-A | p1-01..03 | y ·**archify inset**：章 `三章` | z |
"""

SCENE_P0 = """export const P0X = () => (
  <ArchifyRecap
    slug="demo"
    caption="演示"
    variant="inset"
    cues={[
      {chapterId: 'ch1', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},
      {chapterId: 'ch2', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},
    ]}
  />
);
"""
SCENE_P1 = """export const P1X = () => (
  <ArchifyRecap
    slug="demo"
    caption="演示"
    variant="inset"
    cues={[
      {chapterId: 'ch3', at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a')},
    ]}
  />
);
"""
SCENE_EMPTY = "export const P1X = () => null;\n"

TOML_OK = "[narration]\ntarget_minutes = [0.0, 99.0]\n"


def build(
    tmp_path: Path,
    *,
    board: str = BOARD_OK,
    scenes: dict[str, str] | None = None,
    toml: str | None = TOML_OK,
    views_files: dict[str, list] | str | None = "default",
    manifest: str | None = MANIFEST_OK,
    sidecar: bool = False,
    audio: bool = False,
    name: str = "fixture-archify",
) -> Path:
    root = tmp_path / name
    (root / "script").mkdir(parents=True)
    (root / "script" / "narration.json").write_text(
        json.dumps(NARRATION, ensure_ascii=False), encoding="utf-8"
    )
    (root / "script" / "storyboard.md").write_text(board, encoding="utf-8")
    arch = root / "video" / "public" / "archify"
    if views_files == "default":
        views_files = {"demo.json": VIEWS_DEMO}
    if views_files is not None:
        vd = arch / "views"
        vd.mkdir(parents=True)
        for fname, data in views_files.items():
            (vd / fname).write_text(
                json.dumps(data, ensure_ascii=False), encoding="utf-8"
            )
    if sidecar:
        arch.mkdir(parents=True, exist_ok=True)
        (arch / "demo.json").write_text(
            '{"schema": 2, "mode": "story"}', encoding="utf-8"
        )
    src = root / "video" / "src"
    src.mkdir(parents=True)
    if audio:
        # 5 句 × 6s 纯语音 + 常数 → 总时长 ~0.55min（cue 密度门的可复现基数）
        aud = root / "video" / "public" / "audio"
        aud.mkdir(parents=True)
        (aud / "manifest.json").write_text(
            json.dumps(
                [{**it, "durationSec": 6.0} for it in NARRATION], ensure_ascii=False
            ),
            encoding="utf-8",
        )
        (src / "timing.json").write_text(
            json.dumps(
                {
                    "fps": 30,
                    "sentenceGapSec": 0.32,
                    "sceneGapSec": 0.9,
                    "leadInSec": 0.6,
                    "tailSec": 2.0,
                    "sceneCrossFadeSec": 0.4,
                }
            ),
            encoding="utf-8",
        )
    if manifest is not None:
        (src / "archify.manifest.ts").write_text(manifest, encoding="utf-8")
    sc = src / "scenes"
    sc.mkdir(parents=True)
    for fname, text in (scenes or {"P0X.tsx": SCENE_P0, "P1X.tsx": SCENE_P1}).items():
        (sc / fname).write_text(text, encoding="utf-8")
    if toml is not None:
        (root / "pipeline.toml").write_text(toml, encoding="utf-8")
    return root


def run_gate(root: Path) -> tuple[int, str]:
    r = subprocess.run(
        [sys.executable, str(SCRIPT), "--project", str(root)],
        capture_output=True,
        text=True,
        check=False,
    )
    return r.returncode, r.stdout + r.stderr


# ---------------- 满配绿基线 ----------------


def test_all_green(tmp_path):
    root = build(tmp_path)
    rc, out = run_gate(root)
    assert rc == 0, out
    assert "锚定 3/5" in out and "P0 2/2 · P1 1/3" in out
    assert "FAIL 0" in out and "WARN 0" in out, out


def test_id_gaps_and_suffixes_counted(tmp_path):
    """跳号（p1-02 不存在）与后缀句（p1-01a 被锚）不影响统计口径。"""
    root = build(tmp_path)
    rc, out = run_gate(root)
    assert rc == 0, out
    assert "3/5（60.0%）" in out
    assert "Traceback" not in out


# ---------------- 覆盖度 ----------------


def test_anchor_ratio_floor_fails(tmp_path):
    root = build(tmp_path, toml=TOML_OK + "\n[archify]\nmin_anchor_ratio = 0.9\n")
    rc, out = run_gate(root)
    assert rc == 1
    assert "锚定率" in out and "还差" in out


def test_zero_anchor_scene_fails_then_exempted(tmp_path):
    board = BOARD_OK.replace(" ·**archify inset**：章 `三章`", "")
    root = build(
        tmp_path, board=board, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": SCENE_EMPTY}
    )
    rc, out = run_gate(root)
    assert rc == 1
    assert "P1：整幕" in out and "豁免须在" in out

    root2 = build(
        tmp_path,
        name="fixture-archify-exempt",
        board=board,
        scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": SCENE_EMPTY},
        toml=TOML_OK + '\n[archify]\nexempt_scenes = ["P1"]\n',
    )
    rc2, out2 = run_gate(root2)
    assert rc2 == 0, out2
    assert "P1 豁免零锚判定" in out2
    assert not [
        ln for ln in out2.splitlines() if "整幕" in ln and ln.startswith("  FAIL")
    ]


def test_declared_beat_range_zero_anchor_fails(tmp_path):
    """镜声明了 archify 但句区间零锚（ISSUE-188：按句统计，不按镜统计）。"""
    board = BOARD_OK.replace("章 `三章`", "章 `三章`").replace(
        "| 1-A | p1-01..03 | y ·**archify inset**：章 `三章` | z |",
        "| 1-A | p1-01..03 | y ·**archify inset**：章 `三章` | z |\n| 1-B | p1-03 | w ·**archify inset**：章 `首章` | v |",
    )
    # 1-B 区间只有 p1-03，无锚句（p1-01a 在 1-A）→ 声明镜零锚 FAIL
    root = build(tmp_path, board=board)
    rc, out = run_gate(root)
    assert rc == 1
    assert "镜 1-B" in out and "句区间零锚" in out


# ---------------- 匹配度 ----------------


def test_unresolvable_token_fails(tmp_path):
    board = BOARD_OK.replace("章 `ch1`+`ch2`", "章 `symptoms`")
    root = build(tmp_path, board=board)
    rc, out = run_gate(root)
    assert rc == 1
    assert "无法解析" in out and "`symptoms`" in out


def test_declared_chapter_not_implemented_fails(tmp_path):
    board = BOARD_OK.replace(
        "| 0-A | p0-01..02 | **主装置**：x ·**archify inset**：演示图 章 `ch1`+`ch2` |",
        "| 0-A | p0-01..02 | **主装置**：x ·**archify inset**：演示图 章 `ch1`+`ch2`+`三章` |",
    )
    board = board.replace(" ·**archify inset**：章 `三章`", "")
    root = build(
        tmp_path, board=board, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": SCENE_EMPTY}
    )
    rc, out = run_gate(root)
    assert rc == 1
    assert "未在任何 cue 实现" in out and "三章" in out


def test_undeclared_cue_warns_not_fails(tmp_path):
    board = BOARD_OK.replace("章 `ch1`+`ch2`", "章 `ch1`")
    root = build(tmp_path, board=board)
    rc, out = run_gate(root)
    assert rc == 0
    assert "未在分镜声明" in out and "ch2" in out


def test_label_token_resolves(tmp_path):
    """章 token 写 label（三章）同样可对账——分镜用中文 label 是既有惯例。"""
    root = build(tmp_path)
    rc, out = run_gate(root)
    assert rc == 0, out
    assert "三章" not in [ln for ln in out.splitlines() if "无法解析" in ln]


def test_chapter_monotonicity_warns(tmp_path):
    scene = SCENE_P0.replace(
        "{chapterId: 'ch1', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},",
        "{chapterId: 'ch2', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},",
    ).replace(
        "{chapterId: 'ch2', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},",
        "{chapterId: 'ch1', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},",
    )
    root = build(tmp_path, scenes={"P0X.tsx": scene, "P1X.tsx": SCENE_P1})
    rc, out = run_gate(root)
    assert rc == 0  # 合法叙事重组 → WARN 不判死
    assert "逆序" in out and "ch2" in out and "ch1" in out


def test_chapter_not_in_views_fails(tmp_path):
    scene = SCENE_P1.replace("chapterId: 'ch3'", "chapterId: 'chX'")
    board = BOARD_OK.replace("章 `三章`", "章 `chX`")
    root = build(tmp_path, board=board, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": scene})
    rc, out = run_gate(root)
    assert rc == 1
    assert "views 里不存在的章节" in out


def test_cue_at_form_assertion(tmp_path):
    """`at: 0` 形态的 cue 硬失败（少算不报错等于门形同虚设）。"""
    scene = SCENE_P1.replace(
        "at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a')",
        "at: 0, durationInFrames: 60",
    )
    root = build(tmp_path, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": scene})
    rc, out = run_gate(root)
    assert rc != 0
    assert "未识别出" in out and "at('句id')" in out


def test_cue_count_assertion(tmp_path):
    """ArchifyRecap 块外的 `chapterId:` 字面量 → 计数断言硬失败。"""
    scene = SCENE_P1 + "const stray = {chapterId: 'ch9'};\n"
    root = build(tmp_path, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": scene})
    rc, out = run_gate(root)
    assert rc != 0
    assert "只识别出" in out


# ---------------- skip 语义 ----------------


def test_legacy_sidecar_only_skips_with_warn(tmp_path):
    root = build(tmp_path, views_files=None, manifest=None, sidecar=True)
    rc, out = run_gate(root)
    assert rc == 0
    assert "旧形态" in out


def test_no_assets_skips_clean(tmp_path):
    root = build(tmp_path, views_files=None, manifest=None)
    rc, out = run_gate(root)
    assert rc == 0
    assert "无 archify 资产" in out
    assert "WARN" not in out  # 没打算用 archify 不是债——干净跳过不是 WARN


def test_missing_manifest_degrades_but_crosscheck_runs(tmp_path):
    board = BOARD_OK.replace("章 `ch1`+`ch2`", "章 `symptoms`")
    root = build(tmp_path, board=board, manifest=None)
    rc, out = run_gate(root)
    assert rc == 1  # 章口径 WARN 跳过，但对账 FAIL 照报
    assert "跳过章" in out and "无法解析" in out


def test_storyboard_without_annotations_degrades(tmp_path):
    board = "# 分镜\n## P0\n| 镜 | 句区间 | 画面 | 动效 |\n|---|---|---|---|\n| 0-A | p0-01..02 | x | y |\n"
    root = build(tmp_path, board=board)
    rc, out = run_gate(root)
    assert rc == 0
    assert "分镜无任何 archify 标注" in out
    assert "未在分镜声明" not in out  # 降级为单条 WARN，不逐 cue 刷屏


def test_scenes_missing_skips_reconciliation(tmp_path):
    """scenes 未写时对账/零锚随 WARN 一并跳过——说了跳过就不能照样判死（评审反例）。"""
    import shutil

    root = build(tmp_path)
    shutil.rmtree(root / "video" / "src" / "scenes")
    rc, out = run_gate(root)
    assert rc == 0, out  # 默认宽松地板不红；「白录」是点名 WARN 不是 FAIL
    assert "跳过锚定率/对账/单调性" in out
    assert "未在任何 cue 实现" not in out
    assert "句区间零锚" not in out


def test_scenes_dir_missing_warns_richness_still_fails(tmp_path):
    import shutil

    root = build(tmp_path, toml=TOML_OK + "\n[archify]\nmin_diagrams = 5\n")
    shutil.rmtree(root / "video" / "src" / "scenes")
    rc, out = run_gate(root)
    assert rc == 1  # 丰富度 FAIL 照报
    assert "scenes 不存在" in out and "图数 1 < 下限 5" in out


# ---------------- 丰富度 ----------------


def test_min_diagrams_floor(tmp_path):
    manifest = (
        'export const ARCHIFY = {"demo": {"chapters": '
        '[{"id": "ch1"}, {"id": "ch2"}, {"id": "ch3"}]}, '
        '"other": {"chapters": [{"id": "o1"}]}} as const;\n'
    )
    root = build(
        tmp_path,
        views_files={"demo.json": VIEWS_DEMO, "other.json": VIEWS_OTHER},
        manifest=manifest,
        toml=TOML_OK + "\n[archify]\nmin_diagrams = 3\n",
    )
    rc, out = run_gate(root)
    assert rc == 1
    assert "图数 2 < 下限 3" in out
    assert "白录" in out  # other 图未引用 → WARN


# ---------------- v4 新维度：run / 分幕比率 / 密度 / 图型 / inset / 排他 ----------------


def test_max_unanchored_run_fails(tmp_path):
    """最长连续无锚 run 超限 → FAIL 并给出起点句（幕边界不重置）。"""
    # 只锚 p0-01：p0-02 → p1-01 连续 2 句无锚（跨幕），上限 1 → FAIL
    scene = SCENE_P0.replace(
        "{chapterId: 'ch2', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},\n",
        "",
    )
    board = BOARD_OK.replace(" 章 `ch1`+`ch2`", " 章 `ch1`")
    root = build(
        tmp_path,
        board=board,
        scenes={"P0X.tsx": scene, "P1X.tsx": SCENE_P1},
        toml=TOML_OK + "\n[archify]\nmax_unanchored_run = 1\n",
    )
    rc, out = run_gate(root)
    assert rc == 1
    assert "最长连续无锚 2 句（p0-02 起）> 上限 1" in out


def test_scene_anchor_ratio_floor_fails_then_exempted(tmp_path):
    """分幕锚定率下限：P1 1/3 < 0.9 → FAIL；豁免后 ℹ️ 放行。"""
    toml = TOML_OK + "\n[archify]\nmin_scene_anchor_ratio = 0.9\n"
    root = build(tmp_path, toml=toml)
    rc, out = run_gate(root)
    assert rc == 1
    assert "分幕锚定率" in out and "P1" in out

    root2 = build(
        tmp_path,
        name="fixture-archify-ratio-exempt",
        toml=toml + '\nexempt_scenes = ["P1"]\n',
    )
    rc2, out2 = run_gate(root2)
    assert rc2 == 0, out2
    assert "P1 豁免分幕锚定率判定" in out2


def test_cues_per_minute_skips_without_audio(tmp_path):
    """audio/timing 缺失 → WARN 点名跳过（不造第二时长真相源），rc 0。"""
    root = build(tmp_path, toml=TOML_OK + "\n[archify]\nmin_cues_per_minute = 99.0\n")
    rc, out = run_gate(root)
    assert rc == 0, out
    assert "跳过 cue 密度门" in out


def test_cues_per_minute_floor_fails_with_audio(tmp_path):
    """带 audio：3 cue / ~0.55min ≈ 5.5/分钟 < 99 → FAIL。"""
    root = build(
        tmp_path,
        audio=True,
        toml=TOML_OK + "\n[archify]\nmin_cues_per_minute = 99.0\n",
    )
    rc, out = run_gate(root)
    assert rc == 1
    assert "cue 密度" in out and "99.0/分钟" in out


def test_min_diagram_types_with_backfill(tmp_path):
    """sidecar 带 type 才计多样性；untyped 归 1 种过默认地板。"""
    root = build(
        tmp_path,
        sidecar=True,
        toml=TOML_OK + "\n[archify]\nmin_diagram_types = 2\n",
    )
    rc, out = run_gate(root)
    # demo.json sidecar 无 type → untyped 1 种 < 2 → FAIL + 回填 WARN
    assert rc == 1
    assert "图型多样性 1 种" in out and "缺 type 字段" in out

    import json as _json

    sidecar = root / "video" / "public" / "archify" / "demo.json"
    d = _json.loads(sidecar.read_text(encoding="utf-8"))
    d["type"] = "workflow"
    sidecar.write_text(_json.dumps(d), encoding="utf-8")
    rc2, out2 = run_gate(root)
    assert rc2 == 1  # 单一 workflow 种 < 2，仍 FAIL（但回填 WARN 消失）
    assert "图型多样性 1 种" in out2 and "缺 type 字段" not in out2

    (root / "video" / "public" / "archify" / "other.json").write_text(
        '{"slug": "other", "type": "sequence", "chapters": []}', encoding="utf-8"
    )
    rc3, out3 = run_gate(root)
    assert rc3 == 0, out3
    assert "图型 2 种" in out3


def test_forbid_inset_scene_and_board_fails(tmp_path):
    """forbid_inset=true：场景 variant 残留与分镜 inset 标注双向 FAIL。"""
    root = build(tmp_path, toml=TOML_OK + "\n[archify]\nforbid_inset = true\n")
    rc, out = run_gate(root)
    assert rc == 1
    assert 'variant="inset"' in out and "P0X.tsx" in out
    assert "分镜标注 archify inset" in out and "镜 0-A" in out


def test_forbid_inset_clean_passes(tmp_path):
    board = BOARD_OK.replace("**archify inset**", "**archify full**")
    scenes = {"P0X.tsx": SCENE_P0.replace('variant="inset"\n', ""), "P1X.tsx": SCENE_P1}
    root = build(
        tmp_path,
        board=board,
        scenes={
            "P0X.tsx": scenes["P0X.tsx"],
            "P1X.tsx": scenes["P1X.tsx"].replace('variant="inset"\n', ""),
        },
        toml=TOML_OK + "\n[archify]\nforbid_inset = true\n",
    )
    rc, out = run_gate(root)
    assert rc == 0, out


def test_duplicate_anchor_sentence_fails(tmp_path):
    """同句双 cue → FAIL（全屏独占下一句一图）。"""
    scene = SCENE_P1.replace(
        "{chapterId: 'ch3', at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a')},",
        "{chapterId: 'ch3', at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a')},\n"
        "      {chapterId: 'ch1', at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a')},",
    )
    root = build(tmp_path, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": scene})
    rc, out = run_gate(root)
    assert rc == 1
    assert "同锚句双 cue" in out and "p1-01a" in out


def test_multi_sentence_duration_form_fails(tmp_path):
    """dur('a','b') 多句窗形态 → SystemExit 形态断言（会与邻句 cue 真重叠）。"""
    scene = SCENE_P1.replace(
        "at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a')",
        "at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a', 'p1-03')",
    )
    root = build(tmp_path, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": scene})
    rc, out = run_gate(root)
    assert rc != 0
    assert "单参时长" in out


def test_mismatched_at_dur_sentence_fails(tmp_path):
    """锚句与时长句分家 → SystemExit（静默错窗）。"""
    scene = SCENE_P1.replace(
        "at: at('p1-01a') - bA.from, durationInFrames: dur('p1-01a')",
        "at: at('p1-01a') - bA.from, durationInFrames: dur('p1-03')",
    )
    root = build(tmp_path, scenes={"P0X.tsx": SCENE_P0, "P1X.tsx": scene})
    rc, out = run_gate(root)
    assert rc != 0
    assert "不一致" in out
