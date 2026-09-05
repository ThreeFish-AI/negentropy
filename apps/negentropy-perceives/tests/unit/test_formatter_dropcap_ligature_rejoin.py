"""drop-cap 首字母 / 连字 / 同文佐证硬连字符 重组规则的单测。

锁定 ``_rejoin_dropcap_and_ligatures`` 的修复行为与防误并护栏：
- docling 把大号首字母（drop-cap）与正文分作两 span，``" ".join`` 后产生
  ``I ntroduction`` / ``W hat L oop E ngineering`` 碎片；
- ﬀ/ﬃ 连字被拆为 ``di ff erent`` / ``o ffi cial``；
- 专有名跨行软换行连字符残留为行内硬连字符 ``Ra-jasekaran``。
"""

from negentropy.perceives.markdown.formatter import (
    _rejoin_attested_inline_hyphens,
    _rejoin_attested_ligatures,
    _rejoin_dropcap_and_ligatures,
)


def _f(text: str) -> str:
    return _rejoin_dropcap_and_ligatures(text)


def _full(text: str) -> str:
    """模拟 assembly 末道：局部规则 + 两条同文佐证规则。"""
    text = _rejoin_dropcap_and_ligatures(text)
    text = _rejoin_attested_inline_hyphens(text)
    text = _rejoin_attested_ligatures(text)
    return text


# ---------------- drop-cap 首字母重组（修复项） ----------------


def test_dropcap_multidword_heading_rejoined():
    assert _f("I. I ntroduction: W hat L oop E ngineering R eally I s") == (
        "I. Introduction: What Loop Engineering Really Is"
    )
    assert _f("II. F rom P rompt to C ontext to L oop") == (
        "II. From Prompt to Context to Loop"
    )


def test_dropcap_two_word_heading_no_pronoun_rejoined():
    # 两个碎片且首字母非 I/A（独立代词/冠词）→ 重组
    assert _f("V. G enerator and E valuator") == "V. Generator and Evaluator"
    assert _f("XI. O perational D iscipline") == "XI. Operational Discipline"


def test_dropcap_single_word_whitelisted_section_title():
    assert _f("#### R eferences") == "#### References"
    assert _f("## A bstract") == "## Abstract"


# ---------------- drop-cap 防误并护栏 ----------------


def test_no_false_merge_standalone_pronoun_in_heading():
    # 「I think Therefore I am」恰 2 碎片且首字母为 I → 不重组
    assert _f("## I think Therefore I am") == "## I think Therefore I am"


def test_no_false_merge_article_plus_word():
    assert _f("## A brief history of time") == "## A brief history of time"


def test_no_touch_body_text():
    body = "I think A few engineers will agree on this."
    assert _f(body) == body


def test_intact_title_case_heading_unchanged():
    assert _f("# Loop Engineering: The Anthropic Playbook") == (
        "# Loop Engineering: The Anthropic Playbook"
    )
    assert _f("A. A One-Line Definition") == "A. A One-Line Definition"


def test_glued_heading_plus_body_no_false_merge():
    # 标题与正文被粘成超长一行：标题区 drop-cap 重组，正文 ``A loop`` 保留
    glued = (
        "XV. S ynthesis: W hat the P laybook C omes D own T o technical in this "
        "note serves that one posture. A loop is the most powerful tool."
    )
    out = _f(glued)
    assert "XV. Synthesis: What the Playbook Comes Down To" in out
    assert "Aloop" not in out
    assert "A loop is the most powerful" in out


# ---------------- 连字 ﬀ/ﬃ 重组（修复项，经同文佐证/白名单） ----------------


def test_ligature_ff_internal_rejoined():
    # "difference" 在白名单 → 词内两侧空格去除
    assert _full("the di ff erence is structural") == ("the difference is structural")


def test_ligature_ffi_rejoined():
    assert _full("refer to each tool’s o ffi cial documentation") == (
        "refer to each tool’s official documentation"
    )


def test_ligature_ff_word_final_rejoined():
    assert _full("hando ff, and tune it") == "handoff, and tune it"
    assert _full("turn it o ff)") == "turn it off)"


def test_ligature_word_final_keeps_space_before_next_word():
    # 回归 handoffskipped：词尾 ff 后接另一词 → 仅去前侧空格，保留词间空格
    out = _full("hando ff skipped the work")
    assert "handoff skipped the work" == out
    assert "handoffskipped" not in out


def test_ligature_word_final_off_keeps_space():
    out = _full("turn it o ff was fine")
    assert "turn it off was fine" == out
    assert "offwas" not in out


def test_ligature_fi_fl_NOT_merged_to_avoid_staff_if():
    # ﬁ/ﬂ 单独不重组；"staff if" 无独立 ff token，不触发
    assert _full("the staff if present should leave") == (
        "the staff if present should leave"
    )


def test_ligature_unknown_split_left_unchanged():
    # 未知 ff 拆词（非白名单、非同文佐证）原样保留，绝不误并
    out = _full("the xylo ff nium played")
    assert "xylo ff nium" in out
    assert "xyloffnium" not in out


# ---------------- 缩写撇号（修复项 + 引号护栏） ----------------


def test_contraction_apostrophe_rejoined():
    assert _f("don ' t and won ' t") == "don’t and won’t"
    assert _f("don ’ t") == "don’t"


def test_quoted_words_not_touched():
    assert _f("say 'no' between 'runs' and 'right.'") == (
        "say 'no' between 'runs' and 'right.'"
    )


# ---------------- 同文佐证硬连字符（修复项 + 护栏） ----------------


def test_attested_inline_hyphen_merged_when_clean_form_exists():
    doc = "Prithvi Rajasekaran wrote it. The Ra-jasekaran finding stands."
    out = _rejoin_attested_inline_hyphens(doc)
    assert "Ra-jasekaran" not in out
    assert "Rajasekaran finding" in out


def test_unattested_compound_preserved():
    doc = "Sub-agents are useful. state-of-the-art too."
    out = _rejoin_attested_inline_hyphens(doc)
    assert "Sub-agents" in out
    assert "state-of-the-art" in out


def test_attested_hyphen_full_pipeline_helper():
    # 端到端：drop-cap + 佐证连字 + 佐证硬连字符 三道工序
    doc = (
        "X. T he E conomics of J udgment\n"
        "Rajasekaran found the di ff erence. Addy Osmani wrote it; by Os-mani.\n"
        "hando ff skipped a beat. Sub-agents remain. 'no' is quoted."
    )
    out = _full(doc)
    assert "The Economics of Judgment" in out
    assert "the difference" in out
    assert "handoff skipped a beat" in out
    assert "handoffskipped" not in out
    assert "Os-mani" not in out  # Osmani 在别处出现 → 同文佐证回并
    assert "Osmani wrote it" in out
    assert "Sub-agents" in out
    assert "'no'" in out
