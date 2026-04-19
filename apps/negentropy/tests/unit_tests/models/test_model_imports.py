"""验证 models/ 重构后的导入兼容性与结构完整性。

纯 Python 导入级测试，不需要数据库连接。
"""


class TestBarrelExports:
    """__init__.py 的 barrel export 完整性验证。"""

    def test_all_symbols_importable_from_init(self):
        """所有 __all__ 中声明的符号必须可从 negentropy.models 导入。"""
        from negentropy import models

        for name in models.__all__:
            assert hasattr(models, name), f"Missing export: {name}"

    def test_new_exports_available(self):
        """新增导出项可用：MemoryAutomationConfig, KnowledgeDocument, DEFAULT_EMBEDDING_DIM。"""
        from negentropy.models import DEFAULT_EMBEDDING_DIM, KnowledgeDocument, MemoryAutomationConfig

        assert DEFAULT_EMBEDDING_DIM == 1536
        assert hasattr(MemoryAutomationConfig, "__tablename__")
        assert hasattr(KnowledgeDocument, "__tablename__")


class TestBackwardCompatPluginImports:
    """plugin.py 兼容层验证 — 确保所有现有导入路径不受影响。"""

    def test_all_plugin_symbols_via_compat_layer(self):
        from negentropy.models.plugin import (
            McpServer,
            McpTool,
            McpToolRun,
            McpToolRunEvent,
            McpTrialAsset,
            PluginPermission,
            PluginPermissionType,
            PluginVisibility,
            Skill,
            SubAgent,
        )

        # 验证所有符号均为 class 或 enum
        assert all(
            callable(cls)
            for cls in [
                McpServer,
                McpTool,
                McpToolRun,
                McpToolRunEvent,
                McpTrialAsset,
                PluginPermission,
                Skill,
                SubAgent,
            ]
        )
        assert PluginVisibility.PRIVATE.value == "private"
        assert PluginPermissionType.VIEW.value == "view"

    def test_direct_submodule_imports(self):
        """新子模块的直接导入路径可用。"""
        from negentropy.models.mcp import McpServer, McpTool
        from negentropy.models.mcp_runtime import McpToolRun, McpToolRunEvent, McpTrialAsset
        from negentropy.models.plugin_common import PluginPermission
        from negentropy.models.skill import Skill
        from negentropy.models.sub_agent import SubAgent

        assert McpServer.__tablename__ == "mcp_servers"
        assert McpTool.__tablename__ == "mcp_tools"
        assert McpToolRun.__tablename__ == "mcp_tool_runs"
        assert McpToolRunEvent.__tablename__ == "mcp_tool_run_events"
        assert McpTrialAsset.__tablename__ == "mcp_trial_assets"
        assert PluginPermission.__tablename__ == "plugin_permissions"
        assert Skill.__tablename__ == "skills"
        assert SubAgent.__tablename__ == "sub_agents"

    def test_compat_layer_identity(self):
        """兼容层 re-export 和直接子模块导入必须是同一个类对象。"""
        from negentropy.models.mcp import McpServer as Direct
        from negentropy.models.plugin import McpServer as Compat

        assert Direct is Compat


class TestBackwardCompatPulseImports:
    """pulse.py 兼容层验证 — UserState/AppState re-export。"""

    def test_user_state_from_pulse(self):
        from negentropy.models.pulse import AppState, UserState

        assert UserState.__tablename__ == "user_states"
        assert AppState.__tablename__ == "app_states"

    def test_user_state_from_state(self):
        from negentropy.models.state import AppState, UserState

        assert UserState.__tablename__ == "user_states"
        assert AppState.__tablename__ == "app_states"

    def test_same_class_identity(self):
        """pulse re-export 和 state 直接导入必须是同一个类对象。"""
        from negentropy.models.pulse import UserState as US1
        from negentropy.models.state import UserState as US2

        assert US1 is US2

    def test_pulse_core_models_intact(self):
        """pulse.py 的核心模型（Thread/Event）仍在原位。"""
        from negentropy.models.pulse import Event, Thread

        assert Thread.__tablename__ == "threads"
        assert Event.__tablename__ == "events"


class TestVectorConstant:
    """Vector 维度常量化验证。"""

    def test_embedding_dimension_value(self):
        from negentropy.models.base import DEFAULT_EMBEDDING_DIM

        assert DEFAULT_EMBEDDING_DIM == 1536

    def test_embedding_dimension_exported(self):
        from negentropy.models import DEFAULT_EMBEDDING_DIM

        assert DEFAULT_EMBEDDING_DIM == 1536


class TestKnowledgeRunMixin:
    """knowledge_runtime Mixin 去重验证。"""

    def test_shared_fields_exist(self):
        from negentropy.models.knowledge_runtime import KnowledgeGraphRun, KnowledgePipelineRun

        shared_fields = {"app_name", "run_id", "status", "payload", "idempotency_key", "version"}
        for cls in [KnowledgeGraphRun, KnowledgePipelineRun]:
            model_columns = {c.key for c in cls.__table__.columns}
            assert shared_fields.issubset(model_columns), (
                f"{cls.__name__} missing fields: {shared_fields - model_columns}"
            )

    def test_distinct_tablenames(self):
        from negentropy.models.knowledge_runtime import KnowledgeGraphRun, KnowledgePipelineRun

        assert KnowledgeGraphRun.__tablename__ == "knowledge_graph_runs"
        assert KnowledgePipelineRun.__tablename__ == "knowledge_pipeline_runs"
        assert KnowledgeGraphRun.__tablename__ != KnowledgePipelineRun.__tablename__

    def test_mixin_fields_have_correct_types(self):
        """验证 Mixin 字段的列类型正确传递。"""
        from negentropy.models.knowledge_runtime import KnowledgeGraphRun

        cols = {c.key: c for c in KnowledgeGraphRun.__table__.columns}
        assert not cols["app_name"].nullable
        assert not cols["run_id"].nullable
        assert not cols["status"].nullable


class TestSecurityTimezone:
    """security.py timezone 一致性验证。"""

    def test_credential_updated_at_has_timezone(self):
        from negentropy.models.security import Credential

        col = Credential.__table__.columns["updated_at"]
        assert col.type.timezone is True, "Credential.updated_at should use timezone=True"

    def test_credential_tablename(self):
        from negentropy.models.security import Credential

        assert Credential.__tablename__ == "credentials"

    def test_credential_composite_pk(self):
        """验证复合主键的列。"""
        from negentropy.models.security import Credential

        pk_cols = {c.key for c in Credential.__table__.primary_key.columns}
        assert pk_cols == {"app_name", "user_id", "credential_key"}
