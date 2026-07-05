"""Blob 存储的 URI 工具函数。

历史上知识文档 / MCP 资产以 GCS ``gs://`` URI 标识；GCS 退役后，blob 统一
落入 PostgreSQL ``blob_objects`` 表，改用中性的 ``pgblob://{key}`` URI
scheme。本模块收口 URI 的构造 / 解析 / 判别，消除全仓散落的
``uri.startswith("gs://")`` 字面量判断。
"""

from __future__ import annotations

BLOB_SCHEME = "pgblob"
"""blob 存储的 URI scheme。``pgblob://{key}``，``key`` 为 ``blob_objects.key``。"""

_BLOB_PREFIX = f"{BLOB_SCHEME}://"


def build_uri(key: str) -> str:
    """由存储 key 构造 blob URI。

    Args:
        key: blob 在 ``blob_objects`` 表中的主键路径，
            如 ``knowledge/negentropy/{corpus}/{file}``。

    Returns:
        ``pgblob://{key}`` 形式的 URI。
    """
    return f"{_BLOB_PREFIX}{key.lstrip('/')}"


def parse_uri(uri: str) -> str:
    """从 blob URI 解析出存储 key。

    Args:
        uri: ``pgblob://{key}`` 形式的 URI。

    Returns:
        存储 key（无 scheme 前缀）。

    Raises:
        ValueError: URI 不是有效的 blob URI。
    """
    if not is_blob_uri(uri):
        raise ValueError(f"Invalid blob URI: {uri}. Must start with {_BLOB_PREFIX}")
    return uri[len(_BLOB_PREFIX) :]


def is_blob_uri(uri: str | None) -> bool:
    """判断给定字符串是否为 blob 存储 URI（``pgblob://``）。

    Args:
        uri: 待判别的字符串，``None`` 视为非 blob URI。

    Returns:
        是否为 blob URI。
    """
    return bool(uri) and uri.startswith(_BLOB_PREFIX)
