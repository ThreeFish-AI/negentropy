"""文档展示名 / 下载文件名单一事实源 helper 单测（纯函数，无 DB）。

覆盖 ``negentropy.knowledge._shared``：
- :func:`effective_display_name`：``display_name → metadata_.title → original_filename`` 回退链。
- :func:`effective_download_filename`：``display_name`` 覆盖 + 保留原扩展名。
"""

from __future__ import annotations

from types import SimpleNamespace

from negentropy.knowledge._shared import effective_display_name, effective_download_filename

# ----------------------------------------------------------------------------
# effective_display_name
# ----------------------------------------------------------------------------


def _doc(**kwargs):
    """构造最小文档对象（display_name / metadata_ / original_filename）。"""
    base = {"display_name": None, "metadata_": {}, "original_filename": "report.pdf"}
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_effective_display_name_prefers_display_name():
    assert effective_display_name(_doc(display_name="Q3 Report")) == "Q3 Report"


def test_effective_display_name_falls_back_to_metadata_title():
    assert effective_display_name(_doc(display_name=None, metadata_={"title": "Quarterly"})) == "Quarterly"


def test_effective_display_name_falls_back_to_original_filename():
    assert effective_display_name(_doc(display_name=None, metadata_={})) == "report.pdf"


def test_effective_display_name_ignores_blank_display_name_and_blank_title():
    assert effective_display_name(_doc(display_name="   ", metadata_={"title": "  "})) == "report.pdf"


def test_effective_display_name_strips_whitespace():
    assert effective_display_name(_doc(display_name="  Q3 Report  ")) == "Q3 Report"


# ----------------------------------------------------------------------------
# effective_download_filename
# ----------------------------------------------------------------------------


def test_download_filename_appends_extension_when_missing():
    assert effective_download_filename("report.pdf", "Q3 Report") == "Q3 Report.pdf"


def test_download_filename_does_not_double_append_extension():
    assert effective_download_filename("report.pdf", "Q3 Report.pdf") == "Q3 Report.pdf"


def test_download_filename_extension_match_is_case_insensitive():
    assert effective_download_filename("report.pdf", "Q3 Report.PDF") == "Q3 Report.PDF"


def test_download_filename_falls_back_to_original_when_no_display_name():
    assert effective_download_filename("report.pdf", None) == "report.pdf"
    assert effective_download_filename("report.pdf", "   ") == "report.pdf"


def test_download_filename_preserves_extension_when_display_name_has_other_ext():
    # 用户名带别的扩展名时仍以物理文件扩展名为准，保证可正确打开
    assert effective_download_filename("report.pdf", "notes.txt") == "notes.txt.pdf"


def test_download_filename_without_extension_in_original():
    assert effective_download_filename("README", "My Readme") == "My Readme"
