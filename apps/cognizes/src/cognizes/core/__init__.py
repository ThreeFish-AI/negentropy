"""
Cognizes Core Module

提供核心基础设施类：
- DatabaseManager: PostgreSQL 数据库统一管理器
"""

from cognizes.core.database import DatabaseManager, get_db, get_pool

__all__ = ["DatabaseManager", "get_db", "get_pool"]
