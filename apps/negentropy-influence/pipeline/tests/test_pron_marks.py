"""发音标注 `<原文|读音>` 的解析与校验 —— 「标注错 = 必然读错」的守门人。

上游把标注整体 re.sub 掉、**丢弃原字**（infer_v2_5.py:52-72），且对非法标注既不报错
也不忽略（`pinyin.vocab` 在运行时从未被读取），故错误标注 100% 静默产出错读音频。
一集近 200 句、单槽位 mp3，事后只能靠听发现 —— 校验必须前移到生成阶段。

夹具取自 2026-08-20 对上游源码与 pinyin.vocab（1728 条）的实测。
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from pron_marks import (  # noqa: E402
    POLYPHONE_CANDIDATES,
    has_marks,
    scan_candidates,
    strip_marks,
    validate,
)

VOCAB = frozenset({"HANG2", "XING2", "YIN2", "JV1", "QV4", "XV1", "ER2", "DE5"})


# ---------------- 剥离：单一书写面派生「人读 text」 ----------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("他在银<行|HANG2>里走。", "他在银行里走。"),
        ("他在银<行|XING2>里<行|HANG2>走。", "他在银行里行走。"),
        ("<Claude|K L AO1 D> 能做到。", "Claude 能做到。"),
        ("<银行|YIN2 HANG2>是机构。", "银行是机构。"),
        ("没有标注的句子。", "没有标注的句子。"),
    ],
)
def test_strip_marks_restores_human_text(raw, expected):
    """标注自带原字 ⇒ 剥离即还原人读文本，无需在逐字稿写两份（不存在副本漂移）。"""
    assert strip_marks(raw) == expected


def test_has_marks():
    assert has_marks("银<行|HANG2>") is True
    assert has_marks("银行") is False
    assert has_marks("延迟 < 10ms") is False  # 孤立 < 不构成标注


# ---------------- ERROR：三个静默失效模式 ----------------


def test_stray_angle_bracket_is_error():
    """上游正则 group(1) 的 `[^|>\\n]+` 允许 `<`：孤立 `<` 会吞掉到下个标记之间的正文。"""
    errs, _ = validate("当 a<b 时，他在银<行|HANG2>里走。")
    assert errs, "孤立 < 与后续标记共存必须报 ERROR"
    assert any("吞掉" in e for e in errs)
    # 只有孤立 < 而无标记时同样报（避免「今天没吞、明天加个标注就吞」）
    errs2, _ = validate("延迟<10ms 就够了。")
    assert errs2


def test_stray_pipe_is_error():
    errs, _ = validate("A|B 两种方案。")
    assert any("孤立 `|`" in e for e in errs)


def test_second_pipe_inside_annotation():
    """`<行|XING2|HANG2>` 的第二个竖线会混进发音串 —— 严格版正则不匹配它，残留即报错。"""
    errs, _ = validate("他在银<行|XING2|HANG2>里走。")
    assert errs


@pytest.mark.parametrize(
    "bad",
    [
        "他在银<行|HANG>里走。",  # 缺声调
        "他在银<行|SHENGDIAO9>里走。",  # 声调越界
        "他在银<行|hang2>里走。",  # 小写
        "他在银<行|HANG2!>里走。",  # 非法字符
        "他在银<行|>里走。",  # 空标注（严格版不匹配 → 残留 <> 报错）
    ],
)
def test_illegal_pinyin_is_error(bad):
    errs, _ = validate(bad)
    assert errs, f"{bad!r} 应报 ERROR"


def test_jqx_u_must_be_written_v():
    """实测 pinyin.vocab 中 `^[JQX]U` 零命中：居/去/须 必须写 JV1/QV4/XV1。"""
    errs, _ = validate("这个<居|JU1>然可以。")
    assert any("必须写 V" in e for e in errs)
    ok, _ = validate("这个<居|JV1>然可以。")
    assert ok == []
    # L/N 声母两种都合法且语义不同（LU=卢、LV=吕），不得误伤
    assert validate("<卢|LU2>先生")[0] == []
    assert validate("<吕|LV3>先生")[0] == []


def test_valid_marks_pass():
    for good in (
        "他在银<行|HANG2>里<行|XING2>走。",
        "<银行|YIN2 HANG2>是机构。",  # 多字词：空格分音节
        "<Claude|K L AO1 D> 能做到。",  # CMU 通道（左侧纯 ASCII）
        "<going|G OW1 . IH0 NG> on.",  # 官方示例的 ` . ` 分音节写法
        "轻声用五声：<的|DE5>。",
    ):
        errs, _ = validate(good)
        assert errs == [], f"{good!r} 应通过，实得 {errs}"


def test_cmu_channel_rejects_non_arpabet():
    errs, _ = validate("<Claude|K L ZZZ1 D> 能做到。")
    assert any("ARPAbet" in e for e in errs)


def test_channel_chosen_by_left_side_not_lang():
    """通道由标记左侧是否含汉字二分（上游 :66），与 lang 无关 —— 写法陷阱的来源。

    `<AI|AI4 AI1>` 左侧纯 ASCII ⇒ 走 CMU 通道，拼音会被当成音素而报错。
    要走拼音通道，左侧必须至少含一个汉字。
    """
    errs, _ = validate("<AI|AI4 AI1> 很强。")
    assert errs, "左侧无汉字却写拼音应被 CMU 校验拦下"
    assert validate("<爱|AI4>很强。")[0] == []


# ---------------- WARN：vocab 缺格只告警不阻断 ----------------


def test_vocab_miss_is_warning_not_error():
    """vocab 存在合法缺格（ANG3/ER1/KEI1 均不在 1728 条内），故只能 WARN。"""
    errs, warns = validate("这<行|ANG3>不通。", VOCAB)
    assert errs == [], "格式合法就不该 ERROR"
    assert any("不在 pinyin.vocab" in w for w in warns)
    # 不传 vocab 时跳过该项（该文件在 index-tts checkout 内，不在本仓）
    assert validate("这<行|ANG3>不通。")[1] == []


def test_in_vocab_no_warning():
    errs, warns = validate("他在银<行|HANG2>里走。", VOCAB)
    assert errs == [] and warns == []


# ---------------- 候选表：每个建议标注都必须本身合法 ----------------
#
# 候选表是「若读错则标注」的复听提示——若表里的建议标注自身非法（如 ü 写 U、
# 缺声调），复听者照抄即产出必然读错的音频（上游丢弃原字无兜底）。故每条建议
# 须先通过 validate() 才有资格出现在表里。


def _marked_forms(advice: str) -> list[str]:
    """`"<行|HANG2>` / `<行|XING2>"` → 取出全部 `<…|…>` 形态并各配一个宿主汉字。

    形态自带原字（`<行|HANG2>`），本身就是可校验的完整标注句。
    """
    import re

    return re.findall(r"<[^>]+>", advice)


def test_every_candidate_advice_passes_validation():
    assert POLYPHONE_CANDIDATES, "候选表为空——检测器失效或表被误删"
    for char, risk, advice in POLYPHONE_CANDIDATES:
        forms = _marked_forms(advice)
        assert forms, f"候选 {char!r} 的建议列没有任何标注形态：{advice!r}"
        for form in forms:
            errs, _ = validate(f"测试句{form}测试。")
            assert errs == [], f"候选 {char!r} 的建议标注 {form} 非法：{errs}"


def test_candidates_cover_series_vocabulary():
    """claude-code 系列追加的词表必须在场（拆解 Claude Code 口播高频命中）。"""
    chars = {c for c, *_ in POLYPHONE_CANDIDATES}
    for needed in "行重差卷量更":
        assert needed in chars, f"系列词表缺 {needed!r}"


def test_scan_candidates_finds_planted_char_with_id():
    items = [
        {"id": "p0-01", "scene": "P0", "text": "普通句子没有候选字。"},
        {"id": "p1-02", "scene": "P1", "text": "重试一次很重要。"},
    ]
    hits = scan_candidates(items)
    ids = {h[0] for h in hits}
    chars = {h[1] for h in hits}
    assert "p1-02" in ids and "p0-01" not in ids
    assert "重" in chars
    # 四元组形态：(句id, 字, 易错点, 建议标注)
    row = next(h for h in hits if h[1] == "重")
    assert len(row) == 4 and row[2] and row[3]


def test_scan_candidates_empty_on_clean_text():
    items = [{"id": "p0-01", "scene": "P0", "text": "普通句子没有候选字。"}]
    assert scan_candidates(items) == []


def test_glossary_points_to_scanner_not_a_second_table():
    """PRON-GLOSSARY.md 的候选清单已收敛为指针——文档里的表没有消费者，只会
    与扫描器漂移；旧表头若回归（手工补表），split-brain 即复现。
    """
    glossary = (Path(__file__).resolve().parents[1] / "PRON-GLOSSARY.md").read_text(
        encoding="utf-8"
    )
    assert "若读错则标注 |" not in glossary, (
        "旧候选表头回归——候选表 SSOT 在 pron_marks.py"
    )
    assert "POLYPHONE_CANDIDATES" in glossary, (
        "指针缺失：文档须指向 pron_marks.py 的候选表"
    )
    assert "--pron-candidates" in glossary, (
        "须给出精确命令（check_script.py --pron-candidates）"
    )
    # 纪律句必须保留：候选 ≠ 台账，确认读错才标注
    assert "不要预防性标注" in glossary
