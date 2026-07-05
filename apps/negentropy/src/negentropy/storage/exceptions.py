"""Blob 存储异常类型。"""

from __future__ import annotations


class StorageError(Exception):
    """blob 存储操作失败时抛出（上传 / 下载 / 删除等）。"""

    pass
