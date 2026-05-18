"""文档测试共享约束与断言 helper。"""

from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"
REQUIRED_FRONTMATTER_FIELDS = ("id", "title", "description", "last_update")
RELATIVE_LINK_PATTERN = re.compile(r"\[.*?\]\((\.\.?/[^)#]+?)(?:#[^)]*)?\)")


def read_doc(relative_path: str) -> str:
    """读取 docs/ 下文档内容。"""
    return (DOCS_DIR / relative_path).read_text(encoding="utf-8")


def assert_doc_exists(relative_path: str) -> None:
    """断言文档存在。"""
    doc_path = DOCS_DIR / relative_path
    assert doc_path.exists(), f"{doc_path} 不存在"


def extract_frontmatter(content: str) -> str:
    """提取 YAML frontmatter 区域。"""
    assert content.startswith("---"), "文档缺少 frontmatter 起始标记"
    end = content.index("---", 3)
    assert end > 3, "文档缺少 frontmatter 结束标记"
    return content[3:end]


def assert_required_frontmatter(content: str) -> None:
    """断言 frontmatter 包含必需字段。"""
    frontmatter = extract_frontmatter(content)
    for field in REQUIRED_FRONTMATTER_FIELDS:
        assert f"{field}:" in frontmatter, f"frontmatter 缺少必需字段 '{field}'"


def iter_relative_links(content: str) -> list[str]:
    """返回文档中的所有相对路径链接。"""
    return RELATIVE_LINK_PATTERN.findall(content)


def assert_relative_links_resolve(content: str) -> None:
    """断言所有相对路径链接可解析。"""
    links = iter_relative_links(content)
    assert links, "未找到任何相对路径链接"

    broken_links = []
    for link in links:
        if not (DOCS_DIR / link).resolve().exists():
            broken_links.append(link)

    assert broken_links == [], f"以下链接目标不存在: {broken_links}"
