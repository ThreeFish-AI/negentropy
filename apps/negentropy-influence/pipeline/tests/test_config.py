"""pipeline.toml 的 schema / 默认值 / 校验。

核心用例是 `test_real_episodes_resolve_identically_to_literal_values`：它把
「从 4 集 toml 删掉机制常数」这次删除钉成**可证明的等价变换**——解析并填默认后
的每一个 schema 已知键，必须仍等于删除前那些字面值。

另一条要点是 `test_missing_config_announces_skipped_gate`：此前缺 pipeline.toml
时时长预算门会静默退化为 [0, 999]，是个「你以为开着其实关着的门」。
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
INFLUENCE = PIPELINE.parent
SCRIPTS = PIPELINE / "scripts"
sys.path.insert(0, str(SCRIPTS))

import config  # noqa: E402

#: 删除前 4 集 toml 里逐字写着的值（机制常数）。删除后必须由默认值层还原出同一结果。
LITERALS_BEFORE_DELETION = {
    "narration.chars_per_min": 280,
    "tts.lang": "ZH",
    "render.draft_scale": 0.5,
    "render.draft_jpeg_quality": 60,
}


def episodes() -> list[Path]:
    return sorted(p for p in (INFLUENCE / "episodes").iterdir() if p.is_dir())


def get(cfg: dict, dotted: str):
    sec, key = dotted.split(".", 1)
    return cfg.get(sec, {}).get(key)


def test_real_episodes_validate_clean():
    """4 集真实配置必须零 FAIL —— 否则 schema 与现实脱节。"""
    for ep in episodes():
        cfg, _origin, fails, _warns = config.load(ep, required=True)
        assert not fails, f"{ep.name}: {fails}"


def test_real_episodes_resolve_identically_to_literal_values():
    """等价变换的证明：删掉的机制常数由默认值层原值还原。"""
    for ep in episodes():
        cfg, origin, _f, _w = config.load(ep, required=True)
        for dotted, want in LITERALS_BEFORE_DELETION.items():
            assert get(cfg, dotted) == want, f"{ep.name}.{dotted}"
            assert origin[dotted] == "default", (
                f"{ep.name}.{dotted} 应来自默认值层，实际 {origin[dotted]}"
                "（机制常数不该抄回 toml）"
            )


def test_policy_declaration_stays_in_toml():
    """engine 是策略声明（有可见替代项 + .engine 签名护栏），必须留在 toml。"""
    for ep in episodes():
        _cfg, origin, _f, _w = config.load(ep, required=True)
        assert origin["tts.engine"] == "pipeline.toml", (
            f"{ep.name}: tts.engine 退化成默认值 —— 它是决策记录，不是默认值"
        )


def test_machine_property_never_in_toml():
    """server 是机器属性：只能来自默认值或环境变量，永不入受版本控制的 toml。"""
    for ep in episodes():
        _cfg, origin, _f, _w = config.load(ep, required=True)
        assert origin["tts.server"] in {"default", "env:INDEXTTS_SERVER"}, (
            f"{ep.name}: tts.server 被写进了 toml（机器属性不进共享配置）"
        )


def test_env_override_applies(monkeypatch):
    monkeypatch.setenv("INDEXTTS_SERVER", "http://127.0.0.1:9999")
    cfg, origin, _f, _w = config.load(episodes()[0], required=True)
    assert get(cfg, "tts.server") == "http://127.0.0.1:9999"
    assert origin["tts.server"] == "env:INDEXTTS_SERVER"


def _write(tmp_path: Path, body: str) -> Path:
    root = tmp_path / "some-episode-video"
    root.mkdir()
    (root / "pipeline.toml").write_text(body, encoding="utf-8")
    return root


def test_slug_must_match_directory_name(tmp_path):
    """跨源身份校验：把无人读取的死数据变成两个 SSOT 之间的连接件。

    它防的是 `cp -r` 出来的陈旧 toml 看起来很权威 —— 而现行脚手架就是 cp -r。
    """
    root = _write(
        tmp_path,
        '[episode]\nslug = "wrong-name-video"\n[narration]\ntarget_minutes = [1.0, 2.0]\n[tts]\nengine = "edge"\n',
    )
    _cfg, _o, fails, _w = config.load(root, required=True)
    assert any("与工程目录名" in f for f in fails), fails


def test_unknown_key_warns_with_typo_hint(tmp_path):
    root = _write(
        tmp_path,
        '[episode]\nslug = "some-episode-video"\n[narration]\ntarget_minutes = [1.0, 2.0]\n[tts]\nengine = "edge"\nstyl = "sunny"\n',
    )
    _cfg, _o, fails, warns = config.load(root, required=True)
    assert not fails, fails
    assert any("tts.styl" in w and "tts.style" in w for w in warns), warns


def test_out_of_range_and_shape_are_fails(tmp_path):
    root = _write(
        tmp_path,
        '[episode]\nslug = "some-episode-video"\n[narration]\ntarget_minutes = [9.0, 2.0]\n[tts]\nengine = "edge"\n[render]\ndraft_scale = 3.0\n',
    )
    _cfg, _o, fails, _w = config.load(root, required=True)
    assert any("target_minutes" in f for f in fails), fails
    assert any("draft_scale" in f for f in fails), fails


def test_conditional_required_keys_for_indextts(tmp_path):
    """engine=indextts 时 ref/ref_sha1/style 变为必填；engine=edge 时不是。"""
    common = '[episode]\nslug = "some-episode-video"\n[narration]\ntarget_minutes = [1.0, 2.0]\n[tts]\n'
    root = _write(tmp_path, common + 'engine = "indextts"\n')
    _cfg, _o, fails, _w = config.load(root, required=True)
    for k in ("tts.ref", "tts.ref_sha1", "tts.style"):
        assert any(k in f for f in fails), f"{k} 应为条件必填：{fails}"

    root2 = tmp_path / "edge-episode-video"
    root2.mkdir()
    (root2 / "pipeline.toml").write_text(
        '[episode]\nslug = "edge-episode-video"\n[narration]\ntarget_minutes = [1.0, 2.0]\n[tts]\nengine = "edge"\n',
        encoding="utf-8",
    )
    _cfg, _o, fails2, _w = config.load(root2, required=True)
    assert not fails2, fails2


def test_ref_sha1_length_is_gated(tmp_path):
    root = _write(
        tmp_path,
        '[episode]\nslug = "some-episode-video"\n[narration]\ntarget_minutes = [1.0, 2.0]\n[tts]\nengine = "indextts"\nref = "pipeline/voices/x.wav"\nref_sha1 = "tooshort"\nstyle = "sunny"\n',
    )
    _cfg, _o, fails, _w = config.load(root, required=True)
    assert any("ref_sha1" in f for f in fails), fails


def test_scope_limits_required_key_enforcement(tmp_path):
    """边界管理：每个消费者只校验自己消费的东西。

    内容门（check_script，scope={"narration"}）**不得**因为「还没挑配音样本」
    就拒绝检查分镜覆盖性——那是把 TTS 的前置条件强加给 ④⑤ 阶段。
    这条曾经真的破过：全量校验让三个既有内容门用例直接变红。
    """
    root = _write(
        tmp_path,
        "[narration]\ntarget_minutes = [1.0, 2.0]\n",  # 无 episode.slug、无 tts.*
    )
    _cfg, _o, narrow, _w = config.load(root, required=True, scope={"narration"})
    assert not narrow, f"内容门范围内不该有 FAIL：{narrow}"

    _cfg, _o, full, _w = config.load(root, required=True)
    assert any("episode.slug" in f for f in full), full
    assert any("tts.ref" in f for f in full), full


def test_unknown_key_warning_is_global_regardless_of_scope(tmp_path):
    """typo 检测对谁都有用，且只是 WARN —— 故不受 scope 限制。"""
    root = _write(
        tmp_path,
        '[narration]\ntarget_minutes = [1.0, 2.0]\n[tts]\nstyl = "sunny"\n',
    )
    _cfg, _o, _f, warns = config.load(root, required=True, scope={"narration"})
    assert any("tts.styl" in w for w in warns), warns


def test_non_table_section_reports_fail_instead_of_crashing(tmp_path):
    """已知节写成标量（如 `episode = "slug"`）时不得崩溃——否则 validate() 的
    「应为表」FAIL 分支不可达，且 status/doctor 这类诊断命令会一并死掉
    （与「配置有病时诊断工具尤其该运行」的设计声明直接矛盾）。
    """
    root = _write(
        tmp_path,
        'episode = "some-episode-video"\n[narration]\ntarget_minutes = [1.0, 2.0]\n',
    )
    cfg, _o, fails, _w = config.load(root, required=True)
    assert any("应为表" in f and "episode" in f for f in fails), fails
    # 非表节按「键不存在」处理：其余节的解析不受牵连
    assert cfg["narration"]["target_minutes"] == [1.0, 2.0]


def test_non_table_section_out_of_scope_degrades_to_warn(tmp_path):
    """「节应为表」这条 FAIL 必须同样受 scope 约束。

    此前它无条件进 `fails`：把 `tts` 写成标量时，`check_script.py`
    （scope={"narration"}）会以 1 退出——④⑤ 内容门因为一个**它不消费的节**
    而拒绝检查分镜覆盖性，正是 scope 机制要挡住的形态（同
    `test_scope_limits_required_key_enforcement` 的必填性那一半）。
    降级而非丢弃：畸形节对谁都值得知道，只是不该替别人拦门。
    """
    root = _write(
        tmp_path,
        'tts = "indextts"\nrender = 1\n[narration]\ntarget_minutes = [1.0, 2.0]\n',
    )
    _cfg, _o, fails, warns = config.load(root, required=False, scope={"narration"})
    assert not fails, f"越界的结构病不该拦内容门：{fails}"
    for sec in ("tts", "render"):
        assert any("应为表" in w and sec in w for w in warns), (sec, warns)

    # 正控（判据有方向）：范围之内仍必须是 FAIL，否则这条修复等于把门关掉
    _cfg, _o, in_scope_fails, _w = config.load(root, required=False, scope={"tts"})
    assert any("应为表" in f and "tts" in f for f in in_scope_fails), in_scope_fails


def test_config_module_never_reads_series_json():
    """执法落点唯一：series.json 的登记校验归 `verify_skeleton.py`，本模块不碰。

    由来：`episode.slug` 的说明曾写「且能在 series.json 中命中」，而 `validate()`
    只比目录名（同一措辞还曾出现在 README 字段表与 CHANGELOG）——一个「你以为拦
    得住其实没有」的声明，与本模块要消灭的「静默跳过的门」同病。

    判据取**导入面**而非源码里的字符串：「series.json」这几个字如今正出现在
    `validate()` 的注释里（声明它刻意不做这件事），用源码 grep 会两边同时为真、
    当场假通过（同 CHANGELOG 记载的 theme 判据首版翻车模式）。真要在门内读它，
    必须新增 `json` 或 `paths` 之一的导入——那才是有信噪比的判据。
    行为侧的正面记录见下一条用例。
    """
    import ast

    tree = ast.parse((SCRIPTS / "config.py").read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert not (imported & {"json", "paths"}), (
        f"config.py 出现了 {sorted(imported & {'json', 'paths'})} 导入 —— 若确要在"
        "配置门内校验 series.json 登记，须同步改 SCHEMA 说明、pipeline/README.md"
        "字段表与 verify_skeleton.py 的孤儿警告职责，勿留两个执法落点"
    )


def test_slug_matching_dir_but_unregistered_is_not_a_config_fail(tmp_path):
    """执法边界的正面记录：目录名一致即通过配置门。

    是否登记进 series.json 归 `verify_skeleton.py` 的孤儿目录警告（非阻塞，
    `--strict` 也不失败）——执法只留一个落点，本模块不做第二处。
    """
    root = _write(
        tmp_path,
        '[episode]\nslug = "some-episode-video"\n[narration]\n'
        "target_minutes = [1.0, 2.0]\n"
        '[tts]\nengine = "edge"\n',
    )
    _cfg, _o, fails, _w = config.load(root, required=True)
    assert not fails, f"未登记进 series.json 不该是配置门的 FAIL：{fails}"


def test_missing_config_is_fatal_when_required_soft_otherwise(tmp_path):
    root = tmp_path / "bare-episode-video"
    root.mkdir()
    _cfg, _o, fails, _w = config.load(root, required=True)
    assert fails, "required=True 时缺文件必须是 FAIL"
    _cfg, _o, fails2, warns2 = config.load(root, required=False)
    assert not fails2 and warns2, "required=False 时缺文件应只 WARN"


def test_missing_config_announces_skipped_gate(project):
    """缺 target_minutes 时，时长预算门必须**点名说自己被跳过**。

    此前它静默退化为 [0, 999]。**在 conftest 的临时工程上做**——它本来就没有
    pipeline.toml，正是这条用例要的形态。初版是「删掉真集的 pipeline.toml、
    finally 放回」：pytest 被 Ctrl-C 或进程被杀就会把某集**唯一的可执行参数源**
    留在删除态。同一个教训已写在 tests/test_skeleton.py 文件头（正控一律在镜像
    副本上做，绝不改受版本控制的真文件）。
    """
    r = subprocess.run(
        [sys.executable, str(SCRIPTS / "check_script.py"), "--project", str(project)],
        capture_output=True,
        text=True,
        check=False,
    )
    out = r.stdout + r.stderr
    assert "Traceback" not in out, out[-2000:]
    assert "跳过时长预算门" in out, out[-2000:]  # 门被跳过必须说出来
    assert "无 pipeline.toml" in out, out[-2000:]  # 且须说清病因


# 这条教训的执法在 conftest.py 的 `_episodes_stay_pristine`（会话级快照）：
# 静态扫描做不准——原违规是 `ep = INFLUENCE / "episodes" / …` 与几行之后的
# `toml.unlink()` 分处两行，单行正则一律漏，而漏报的门等于没门。


#: 消费者脚本里，凡对 SCHEMA 叶子键做 `.get(key, <兜底>)` 的地方，兜底**必须**取自
#: `config.default()`。节名（tts/render/…）的 `.get(sec, {})` 不在此列——那是取节。
_LEAF_KEYS = {k.split(".", 1)[1] for k, *_ in config.SCHEMA}
_GET_WITH_DEFAULT = re.compile(r'\.get\(\s*"(?P<key>[a-z_]+)"\s*,\s*(?P<dflt>[^)]+)')
CONSUMERS = ("pipeline.py", "check_script.py")


def test_consumers_do_not_inline_schema_defaults():
    """默认值只许有一份。

    `load(required=False)` 缺文件时直接返回 `{}`（不走 `resolve()`），所以消费者
    里内联的 `.get("chars_per_min", 280)` 是**可达**的第二事实源：改 SCHEMA 时
    那条路径会静默沿用旧口径。`required=True` 的调用点虽恒被 resolve 填过、内联
    默认不可达，但同样是重复声明——一并禁掉，免得下一个人照抄。
    """
    offenders: list[str] = []
    for name in CONSUMERS:
        text = (SCRIPTS / name).read_text(encoding="utf-8")
        for lineno, line in enumerate(text.split("\n"), 1):
            for m in _GET_WITH_DEFAULT.finditer(line):
                if m.group("key") not in _LEAF_KEYS:
                    continue
                if "config.default(" in m.group("dflt"):
                    continue
                offenders.append(f"{name}:{lineno} {line.strip()}")
    assert not offenders, (
        'SCHEMA 叶子键的兜底默认值须写成 config.default("<节>.<键>")：\n  '
        + "\n  ".join(offenders)
    )


def test_default_accessor_matches_schema_and_rejects_unknown():
    import pytest

    for dotted, _t, dflt, *_ in config.SCHEMA:
        assert config.default(dotted) == dflt
    with pytest.raises(KeyError):
        config.default("tts.styl")
