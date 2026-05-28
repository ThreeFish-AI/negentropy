"""``assembly._code_block_to_markdown`` —— 代码块语言头清洗单元测试。

锁定 R9 D1 修复契约：docling 在某些 PDF 上把代码块第一行 ``Python`` / ``Java`` /
``Javascript`` 字面字符串当作 ``text`` 输出（label='code' 但 code_language=None），
导致 assembly 渲染出的 markdown 形如::

    ```
    Python
    import os
    ...
    ```

不仅 highlighter 失效（无 fence info string），更让首行 "Python" 字面字符
被错误当作代码本体，破坏阅读与执行体验。

修复后 ``_code_block_to_markdown`` 优先采用显式 ``code_block.language``；当语言
未识别但 code 首行恰好是某常见编程语言关键词（且独占一行）时，从 body 移除该
首行并提升为 fence info string。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.models import ExtractedCodeBlock
from negentropy.perceives.pipeline.stages.pdf.assembly import _code_block_to_markdown


def _block(code: str, language: str | None = None) -> ExtractedCodeBlock:
    """构造最小 ExtractedCodeBlock fixture。"""
    return ExtractedCodeBlock(
        code_id="t",
        code=code,
        language=language,
        page_number=0,
        reading_order=0,
    )


class TestCodeBlockToMarkdownLangHeader:
    """``_code_block_to_markdown`` —— lang header stripping + 显式 lang 优先。"""

    def test_explicit_language_takes_precedence(self) -> None:
        """显式 language 字段优先于 code body 中可能的 lang 首行。"""
        out = _code_block_to_markdown(_block("Python\nimport os\n", language="python"))
        # body 首行的 Python 字面应被移除，因显式 lang 已提供
        assert out.startswith("```python\n")
        assert out.endswith("\n```")
        assert "Python\nimport os" not in out
        assert "import os" in out

    def test_python_first_line_promoted_to_fence(self) -> None:
        """code 首行单独是 "Python" → 提升为 ```python 围栏，body 删除首行。"""
        out = _code_block_to_markdown(_block("Python\nimport os\nprint(1)\n"))
        assert out.startswith("```python\n")
        lines = out.split("\n")
        # 不应有 Python 字面单独占代码内容首行
        assert lines[1].startswith("import os")

    def test_javascript_first_line_promoted(self) -> None:
        """JavaScript 同理。"""
        out = _code_block_to_markdown(_block("Javascript\nconst x = 1;\n"))
        assert out.startswith("```javascript\n")
        assert "Javascript\nconst" not in out

    def test_bash_first_line_promoted(self) -> None:
        """Bash 同理。"""
        out = _code_block_to_markdown(_block("Bash\nls -la\necho hi\n"))
        assert out.startswith("```bash\n")
        assert "Bash\nls" not in out

    def test_case_insensitive(self) -> None:
        """识别忽略大小写。"""
        out = _code_block_to_markdown(_block("PYTHON\nimport os\n"))
        assert out.startswith("```python\n")

    def test_first_line_with_trailing_whitespace(self) -> None:
        """首行带尾随空白也识别。"""
        out = _code_block_to_markdown(_block("Python   \nimport os\n"))
        assert out.startswith("```python\n")

    def test_unknown_first_word_kept(self) -> None:
        """首行不在 lang 集合中 → 完整保留为 code，无 lang 提升。"""
        out = _code_block_to_markdown(_block("Hello world\nfoo bar\n"))
        assert out.startswith("```\n")
        assert "Hello world" in out

    def test_no_first_line_lang_with_code(self) -> None:
        """code 首行本身就是有效代码 → 不应被吞掉。"""
        out = _code_block_to_markdown(_block("import os\nprint(1)\n"))
        # "import" 不是 lang 关键词，保留
        assert "import os" in out
        # 无 lang 推断，fence 为空 lang
        assert out.startswith("```\n")

    def test_lang_synonyms_normalized(self) -> None:
        """``Js`` / ``Ts`` / ``c++`` 同义词应归一化到标准 highlight 名。"""
        assert _code_block_to_markdown(_block("Js\nlet x;\n")).startswith(
            "```javascript\n"
        )
        assert _code_block_to_markdown(_block("Ts\nlet x: number;\n")).startswith(
            "```typescript\n"
        )
        assert _code_block_to_markdown(_block("C++\nint main(){}\n")).startswith(
            "```cpp\n"
        )

    def test_empty_code(self) -> None:
        """空 code 不崩溃。"""
        out = _code_block_to_markdown(_block(""))
        assert out.startswith("```")
        assert out.endswith("```")

    def test_single_line_code_no_lang_header(self) -> None:
        """单行 code 不被误识为 lang-only。"""
        out = _code_block_to_markdown(_block("print(1)\n"))
        assert "print(1)" in out
        assert out.startswith("```\n")

    def test_lang_already_set_overrides_body_first_line(self) -> None:
        """显式 language=python 但 body 仍以 "Python" 起首 → body 首行清理 + lang 用显式。"""
        out = _code_block_to_markdown(_block("Python\nprint(1)\n", language="python"))
        assert out.startswith("```python\n")
        # body 首行不应是 "Python"
        body = out.removeprefix("```python\n").removesuffix("\n```")
        assert not body.lstrip().startswith("Python\n")
