"""
向后兼容代理 - SessionSummarizer 已迁移至 negentropy.engine.summarization

本模块保留为兼容层，新代码请直接导入:
    from negentropy.engine.summarization import SessionSummarizer
"""

from negentropy.engine.summarization import SessionSummarizer  # noqa: F401

__all__ = ["SessionSummarizer"]
