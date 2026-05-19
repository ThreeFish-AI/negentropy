"""PDF 子系统共享的延迟导入辅助。"""


def import_fitz():
    """延迟导入 PyMuPDF (fitz)。"""
    try:
        import fitz

        return fitz
    except ImportError as e:
        raise ImportError(f"PyMuPDF (fitz) is required for PDF processing: {e}")


def import_pypdf():
    """延迟导入 pypdf。"""
    try:
        import pypdf

        return pypdf
    except ImportError as e:
        raise ImportError(f"pypdf is required for PDF processing: {e}")


def import_mineru():
    """延迟导入 MinerU。

    Returns:
        mineru 模块，未安装时返回 None。
    """
    try:
        import mineru  # noqa: F401

        return mineru
    except ImportError:
        return None


def import_marker():
    """延迟导入 Marker（marker_pdf 或 marker）。

    Returns:
        marker 模块，未安装时返回 None。
    """
    try:
        import marker_pdf  # noqa: F401

        return marker_pdf
    except ImportError:
        pass
    try:
        import marker  # noqa: F401

        return marker
    except ImportError:
        return None
