"""标题末尾多余中文句号「。」剥离的回归测试 (format_fidelity_safe)。

背景：docling 提取大事记/年表条目（如「## 1875 贝尔和沃森发明电话。」）时
把陈述句末句号带入标题文本，与源 PDF（标题无句号）失真。中文出版规范标题
末尾不加标点；``format_fidelity_safe`` 在 return 前剥离末尾中文句号，保留
「？」「！」等语气标点与英文「.」。
"""

from negentropy.perceives.markdown.formatter import MarkdownFormatter


def _fidelity(md: str) -> str:
    return MarkdownFormatter().format_fidelity_safe(md)


def test_strips_trailing_chinese_period():
    out = _fidelity("## 1875 贝尔和沃森发明电话。")
    assert "贝尔和沃森发明电话" in out
    assert "电话。" not in out


def test_strips_multiple_trailing_periods():
    out = _fidelity("## 某标题。。")
    assert "某标题。" not in out
    assert "某标题" in out


def test_preserves_question_mark():
    out = _fidelity("## 为什么衰落？")
    assert "为什么衰落？" in out


def test_preserves_english_period():
    # 英文「.」不处理（章节编号 / 缩写可能合法结尾）
    out = _fidelity("## See Section 1.2.")
    assert "Section 1.2." in out


def test_preserves_body_sentence_period():
    out = _fidelity("## 标题。\n正文句号应保留。\n")
    assert "正文句号应保留。" in out
    assert "## 标题。" not in out
    assert "## 标题" in out
