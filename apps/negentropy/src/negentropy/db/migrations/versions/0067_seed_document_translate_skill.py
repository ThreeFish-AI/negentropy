"""Seed: document-translate 内置技能 + InfluenceFaculty / claude_code 装配数据修复

Revision ID: 0067
Revises: 0066
Create Date: 2026-06-11 00:00:00.000000+00:00

设计动机：
    将「Translate (文档翻译)」技能物化为系统内置 Skill 行，并完成既有行的装配数据修复，
    一次落库满足三件事：
    - **卡片全员可见**：``is_system=TRUE`` 经 ``get_visible_plugin_ids("skill")`` union
      让所有用户在 Interface/Skills 卡片看到（与 0064 pdf-fidelity-restore 同语义）；
    - **精准挂载 InfluenceFaculty**：``is_global=FALSE``（区别于 0064 的全员注入），
      经 ``Agent.skills`` 显式数组进入 Progressive Disclosure。存量 ``agents`` 行在此
      幂等追加；增量行由 ``agent_presets._AGENT_SKILLS`` 在 Sync 时写入（SSOT 双保险，
      规避 ``_build_payload`` 历史上 ``skills=[]`` 的覆盖问题）；
    - **Claude Code 工具装配**：``builtin_tools(claude_code).config.skills`` 幂等追加
      ``document-translate``，供翻译服务把该技能材料化进 Claude Code 工作目录
      （``<workdir>/.claude/skills/``），使其在 Interface/Tools 配置层可见可审。

正交分解：
    技能 schema 已稳定（0063 引入 ``is_global``），本迁移纯 data：种子技能行 +
    两处装配数据修复，沿用 0036/0037/0064 的数据迁移范式。

幂等性：
    - skills 行：``ON CONFLICT (name) DO NOTHING``（依赖 ``skills_name_unique``）；
    - skill_versions 快照：``NOT EXISTS`` 守卫；
    - agents.skills / builtin_tools.config.skills：``@>`` 包含守卫后 JSONB 追加。
    重跑安全。

SSOT 提示：
    本迁移内嵌的 prompt_template / schema 是**冻结快照**（Alembic 迁移不可变原则）；
    技能的「活」定义见 ``skill_templates/document_translate.yaml`` 与
    ``.agent/skills/document-translate/SKILL.md``。三者首发内容一致。

downgrade：
    逆序撤销：builtin_tools.config.skills 去元素、agents.skills 去元素、删除 skill 行
    （级联 skill_versions），均精确匹配，不触碰其它数据。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0067"
down_revision: str | None = "0066"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
SKILL_NAME = "document-translate"
SKILL_VERSION = "1.0.0"
AGENT_NAME = "InfluenceFaculty"
CLAUDE_CODE_TOOL_NAME = "claude_code"

PROMPT_TEMPLATE = """你是「Markdown 高保真翻译」执行者。任务：把工作目录 ``{{ workdir }}`` 下 ``source/`` 内的
{{ chunk_count }} 个分块文件（``chunk_0000.md`` 起按序零填充编号）翻译为{{ target_language }}，
逐块写入 ``{{ workdir }}/translated/`` 下的**同名文件**。

## 执行方式（唯一合法路径）
必须调用 ``invoke_claude_code`` 完成翻译，参数：
- task：下方「翻译铁律」+「逐块流程」全文；
- working_directory：``{{ workdir }}``；
- timeout_seconds：{{ tool_timeout }}。
**严禁**在对话回复中直接输出译文；完成后仅回报执行结果（成功块数 / 失败原因）。

## 翻译铁律（缺一即失败）
1. 以下内容**逐字节保留、绝不翻译/改写**：
   - 代码块（``` 或 ~~~ 围栏，含语言标记与围栏本身）与行内代码（`...`）；
   - URL / 链接目标 / 图片路径（[text](url) 仅译 text，url 原样）；
   - LaTeX 公式（$...$ / $$...$$ / \\(...\\) / \\[...\\]）；
   - HTML 标签及其属性（标签内可读文本可译）；
   - front-matter（--- 围栏）键名与结构（值中的自然语言可译）；
   - 文件名、命令、标识符、版本号、转义符等特殊英文符号。
2. Markdown 结构与原文**一一对应**：标题层级、列表缩进与标记、表格行列、引用块、
   分隔线、空行布局均不得增删。
3. 每个 ``source/chunk_NNNN.md`` 必须产出**非空**的 ``translated/chunk_NNNN.md``，
   禁止合并、拆分、跳过任何分块；不得丢失任何原文内容。
4. 只翻译自然语言散文（段落、标题文字、列表文字、表格单元格文本、图片 alt 文本）；
   专业术语首次出现可附原文括注，保持全篇术语一致。

## 逐块流程
1. 列出 ``source/`` 下全部分块文件并确认数量 == {{ chunk_count }}；
2. 按编号升序逐块：读取 → 翻译 → 写入 ``translated/`` 同名文件；
3. 全部完成后自检：``translated/`` 文件数 == {{ chunk_count }} 且逐块非空、
   代码围栏数量与原块一致。

## 完成判据
translated/ 分块齐全非空 + 铁律自检通过；服务端将做确定性校验（代码块还原、
结构对比、内容完整性），不达标即整体失败。
"""

DESCRIPTION = (
    "将 Knowledge / Documents 文档的英文 Markdown 正文按段落分块高保真翻译为中文：代码块、行内代码、"
    "URL、图片路径、LaTeX 公式、HTML 标签、front-matter 键名逐字节保留不翻，Markdown 结构与原文"
    "一一对应，逐块翻译禁止合并/拆分/遗漏，由 InfluenceFaculty 经 invoke_claude_code 执行。"
)

REQUIRED_TOOLS = ["invoke_claude_code"]

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "workdir": {
            "type": "string",
            "description": "翻译工作目录绝对路径（含 source/ 与 translated/ 子目录）",
        },
        "chunk_count": {
            "type": "integer",
            "minimum": 1,
            "description": "source/ 下待翻译分块文件数",
        },
        "target_language": {
            "type": "string",
            "default": "中文",
            "description": "目标语言（自然语言名称）",
        },
        "tool_timeout": {
            "type": "number",
            "minimum": 30,
            "maximum": 3600,
            "default": 1800,
            "description": "invoke_claude_code 单次调用超时（秒）",
        },
    },
    "required": ["workdir", "chunk_count"],
}

DEFAULT_CONFIG = {
    "target_language": "中文",
    "tool_timeout": 1800,
}

RESOURCES: list[dict] = []


def upgrade() -> None:
    conn = op.get_bind()
    # --- 1) 种子 skill 行（幂等 INSERT；is_system=TRUE + is_global=FALSE 精准挂载）---
    conn.execute(
        sa.text(
            f"""
        INSERT INTO {SCHEMA}.skills (
            owner_id, visibility, name, display_name, description,
            category, version, prompt_template, config_schema, default_config,
            required_tools, is_enabled, is_system, is_global, priority,
            enforcement_mode, resources
        )
        VALUES (
            'system', 'PUBLIC'::{SCHEMA}.pluginvisibility, :name, :display_name, :description,
            'knowledge', :version, :prompt_template, :config_schema, :default_config,
            :required_tools, TRUE, TRUE, FALSE, 20,
            'warning', :resources
        )
        ON CONFLICT (name) DO NOTHING
        """
        ).bindparams(
            sa.bindparam("name", value=SKILL_NAME, type_=sa.Text),
            sa.bindparam("display_name", value="Translate (文档翻译)", type_=sa.Text),
            sa.bindparam("description", value=DESCRIPTION, type_=sa.Text),
            sa.bindparam("version", value=SKILL_VERSION, type_=sa.Text),
            sa.bindparam("prompt_template", value=PROMPT_TEMPLATE, type_=sa.Text),
            sa.bindparam("config_schema", value=CONFIG_SCHEMA, type_=JSONB),
            sa.bindparam("default_config", value=DEFAULT_CONFIG, type_=JSONB),
            sa.bindparam("required_tools", value=REQUIRED_TOOLS, type_=JSONB),
            sa.bindparam("resources", value=RESOURCES, type_=JSONB),
        )
    )

    # --- 2) 初始版本快照（NOT EXISTS 守卫；让 name@1.0.0 引用立即可用）---
    skill_id = conn.execute(
        sa.text(f"SELECT id FROM {SCHEMA}.skills WHERE name = :name").bindparams(
            sa.bindparam("name", value=SKILL_NAME, type_=sa.Text)
        )
    ).scalar()
    if skill_id is not None:
        snapshot = {
            "name": SKILL_NAME,
            "display_name": "Translate (文档翻译)",
            "description": DESCRIPTION,
            "category": "knowledge",
            "prompt_template": PROMPT_TEMPLATE,
            "config_schema": CONFIG_SCHEMA,
            "default_config": DEFAULT_CONFIG,
            "required_tools": REQUIRED_TOOLS,
            "priority": 20,
            "enforcement_mode": "warning",
            "resources": RESOURCES,
            "is_global": False,
        }
        conn.execute(
            sa.text(
                f"""
            INSERT INTO {SCHEMA}.skill_versions (skill_id, version, snapshot)
            SELECT :skill_id, :version, :snapshot
            WHERE NOT EXISTS (
                SELECT 1 FROM {SCHEMA}.skill_versions WHERE skill_id = :skill_id AND version = :version
            )
            """
            ).bindparams(
                sa.bindparam("skill_id", value=skill_id),
                sa.bindparam("version", value=SKILL_VERSION, type_=sa.Text),
                sa.bindparam("snapshot", value=snapshot, type_=JSONB),
            )
        )

    # --- 3) 存量 InfluenceFaculty 行幂等追加技能（行不存在则无操作；增量由 presets Sync 写入）---
    conn.execute(
        sa.text(
            f"""
        UPDATE {SCHEMA}.agents
        SET skills = COALESCE(skills, '[]'::jsonb) || :skill_ref::jsonb
        WHERE name = :agent_name
          AND NOT (COALESCE(skills, '[]'::jsonb) @> :skill_ref::jsonb)
        """
        ).bindparams(
            sa.bindparam("agent_name", value=AGENT_NAME, type_=sa.Text),
            sa.bindparam("skill_ref", value=f'["{SKILL_NAME}"]', type_=sa.Text),
        )
    )

    # --- 4) claude_code 工具 config.skills 幂等追加（Interface/Tools 层的技能装配）---
    conn.execute(
        sa.text(
            f"""
        UPDATE {SCHEMA}.builtin_tools
        SET config = jsonb_set(
            COALESCE(config, '{{}}'::jsonb),
            '{{skills}}',
            COALESCE(config->'skills', '[]'::jsonb) || :skill_ref::jsonb,
            true
        )
        WHERE name = :tool_name
          AND NOT (COALESCE(config->'skills', '[]'::jsonb) @> :skill_ref::jsonb)
        """
        ).bindparams(
            sa.bindparam("tool_name", value=CLAUDE_CODE_TOOL_NAME, type_=sa.Text),
            sa.bindparam("skill_ref", value=f'["{SKILL_NAME}"]', type_=sa.Text),
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    # 逆序 1) claude_code config.skills 去元素（JSONB 数组无 remove-by-value，过滤重组）
    conn.execute(
        sa.text(
            f"""
        UPDATE {SCHEMA}.builtin_tools
        SET config = jsonb_set(
            config,
            '{{skills}}',
            COALESCE(
                (SELECT jsonb_agg(e) FROM jsonb_array_elements(config->'skills') AS e
                 WHERE e <> :skill_elem::jsonb),
                '[]'::jsonb
            ),
            true
        )
        WHERE name = :tool_name AND config ? 'skills'
        """
        ).bindparams(
            sa.bindparam("tool_name", value=CLAUDE_CODE_TOOL_NAME, type_=sa.Text),
            sa.bindparam("skill_elem", value=f'"{SKILL_NAME}"', type_=sa.Text),
        )
    )

    # 逆序 2) agents.skills 去元素
    conn.execute(
        sa.text(
            f"""
        UPDATE {SCHEMA}.agents
        SET skills = COALESCE(
            (SELECT jsonb_agg(e) FROM jsonb_array_elements(skills) AS e
             WHERE e <> :skill_elem::jsonb),
            '[]'::jsonb
        )
        WHERE name = :agent_name AND COALESCE(skills, '[]'::jsonb) @> :skill_ref::jsonb
        """
        ).bindparams(
            sa.bindparam("agent_name", value=AGENT_NAME, type_=sa.Text),
            sa.bindparam("skill_elem", value=f'"{SKILL_NAME}"', type_=sa.Text),
            sa.bindparam("skill_ref", value=f'["{SKILL_NAME}"]', type_=sa.Text),
        )
    )

    # 逆序 3) 删除种子技能行（级联 skill_versions / skill_schedules），精确匹配 name。
    op.execute(
        sa.text(f"DELETE FROM {SCHEMA}.skills WHERE name = :name").bindparams(
            sa.bindparam("name", value=SKILL_NAME, type_=sa.Text)
        )
    )
