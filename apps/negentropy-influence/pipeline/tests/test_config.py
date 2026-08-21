"""pipeline.toml 的 schema / 默认值 / 校验。

核心用例是 `test_real_episodes_resolve_identically_to_literal_values`：它把
「从 4 集 toml 删掉机制常数」这次删除钉成**可证明的等价变换**——解析并填默认后
的每一个 schema 已知键，必须仍等于删除前那些字面值。

另一条要点是 `test_missing_config_announces_skipped_gate`：此前缺 pipeline.toml
时时长预算门会静默退化为 [0, 999]，是个「你以为开着其实关着的门」。
"""

from __future__ import annotations

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


def test_missing_config_is_fatal_when_required_soft_otherwise(tmp_path):
    root = tmp_path / "bare-episode-video"
    root.mkdir()
    _cfg, _o, fails, _w = config.load(root, required=True)
    assert fails, "required=True 时缺文件必须是 FAIL"
    _cfg, _o, fails2, warns2 = config.load(root, required=False)
    assert not fails2 and warns2, "required=False 时缺文件应只 WARN"


def test_missing_config_announces_skipped_gate():
    """缺 target_minutes 时，时长预算门必须**点名说自己被跳过**。

    此前它静默退化为 [0, 999]。用真实工程做：临时移走 toml，跑 check_script，
    断言输出里出现那句 WARN，再原样放回。
    """
    ep = INFLUENCE / "episodes" / "claude-code-explained-video"
    toml = ep / "pipeline.toml"
    saved = toml.read_bytes()
    toml.unlink()
    try:
        r = subprocess.run(
            [sys.executable, str(SCRIPTS / "check_script.py"), "--project", str(ep)],
            capture_output=True,
            text=True,
            check=False,
        )
        out = r.stdout + r.stderr
        assert "跳过时长预算门" in out, out[-2000:]
    finally:
        toml.write_bytes(saved)
