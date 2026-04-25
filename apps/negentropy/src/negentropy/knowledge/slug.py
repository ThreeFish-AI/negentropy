"""URL-friendly slug 工具（前后端共享语义）

收敛 Wiki Publication / Wiki Entry / Catalog Entry 三处历史重复实现，
确保 slugify 规则与校验正则在 service / dao / api 层完全一致。

前端对照实现：``apps/negentropy-ui/features/knowledge/utils/wiki-slug.ts``，
两端 ``SLUG_PATTERN`` 字符串值需严格一致（前端通过测试断言对齐）。
"""

from __future__ import annotations

import re
import unicodedata

# Wiki / Catalog slug 校验正则（前后端 SSOT）。
SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
_SLUG_REGEX = re.compile(SLUG_PATTERN)

# 空 / 全非法字符 输入时的回退 slug。
DEFAULT_SLUG = "untitled"


def slugify(text: str) -> str:
    """规范化任意文本为 URL-friendly slug。

    规则：NFKC 归一化 → 小写 → 非 ``[a-z0-9]`` 字符折叠为 ``-`` →
    去首尾 ``-`` → 折叠连续 ``-``。空或全非法输入回退为 ``DEFAULT_SLUG``。
    """
    normalized = unicodedata.normalize("NFKC", text or "").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug or DEFAULT_SLUG


def is_valid_slug(slug: str) -> bool:
    """校验 slug 是否符合 ``[a-z0-9](-[a-z0-9])*`` 模式。"""
    return bool(_SLUG_REGEX.match(slug or ""))


def compute_slug(name: str, slug_override: str | None) -> str:
    """从 ``slug_override`` 或 ``name`` 派生 slug。

    ``slug_override`` 非空（非 None / 非空串）时原样返回；否则对 ``name``
    应用 :func:`slugify`。供 catalog tree 行查询等场景复用。
    """
    if slug_override:
        return slug_override
    return slugify(name)
