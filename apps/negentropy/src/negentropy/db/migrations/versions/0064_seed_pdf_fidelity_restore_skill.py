"""Seed: pdf-fidelity-restore 内置全局技能（卡片全员可见 + 全 Agent 自动注入）

Revision ID: 0064
Revises: 0063
Create Date: 2026-06-07 00:00:00.000000+00:00

设计动机：
    将「PDF 高保真还原」技能物化为系统内置 Skill 行，一次落库即满足两件事：
    - **卡片全员可见**：``is_system=TRUE`` 经 ``get_visible_plugin_ids("skill")`` union
      让所有用户在 Interface/Skills 卡片看到（与 0037 paper-hunter 同语义）；
    - **全 Agent 自动注入**：``is_global=TRUE``（列由 0063 引入）经
      ``skills_injector.resolve_global_skills`` 并入一核五翼及未来新增 Agent 的
      Progressive Disclosure —— 不依赖 ``Agent.skills``，规避 ``_build_payload``
      的 ``skills=[]`` 覆盖。

正交分解：
    0063 专注 schema（加 ``is_global`` 列），本迁移专注 data（种子技能行），
    沿用 0036/0037 的「列类型 / 数据修正」拆分范式。

幂等性：
    ``ON CONFLICT (name) DO NOTHING``（依赖 ``skills_name_unique`` 唯一约束）；
    初始版本快照亦以 ``NOT EXISTS`` 守卫。重跑安全。

SSOT 提示：
    本迁移内嵌的 prompt_template / schema 是**冻结快照**（Alembic 迁移不可变原则）；
    技能的「活」定义见 ``skill_templates/pdf_fidelity_restore.yaml`` 与
    ``.agent/skills/pdf-fidelity-restore/SKILL.md``。三者首发内容一致。

downgrade：
    删除该 skill 行（级联 skill_versions），``name=`` 精确匹配，不触碰其它数据。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0064"
down_revision: str | None = "0063"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
SKILL_NAME = "pdf-fidelity-restore"
SKILL_VERSION = "1.0.0"

PROMPT_TEMPLATE = """你是「PDF 高保真还原」专家。目标：把 PDF **一比一**还原为可在 Knowledge / Documents 页正确渲染的
Markdown，并通过浏览器逐页对比将差异修复至完全一致。

## 输入
- pdf_source：``{{ pdf_source }}``（本地绝对路径或 http(s) URL）
- corpus_name：``{{ corpus_name }}``（目标 Corpus，默认 Harness Engineering）
- method：``{{ method }}``（perceives 引擎：auto / smart / docling / mineru / marker / pymupdf / pypdf）
- 分批：batch_page_size=``{{ batch_page_size }}``，batch_threshold_pages=``{{ batch_threshold_pages }}``

## 一比一还原范围（缺一不可）
文字、段落顺序、高清原图、**图片显示尺寸**、目录(TOC/锚点)、表格、数学公式(LaTeX/KaTeX)、
代码块(语言与高亮)、脚注/注释。

## 流程（自驱闭环）
1. **基准**：用用户常用浏览器（真实登录态）打开源 PDF（``file://`` 或 URL）作为对照基线；不得绕过/模拟任何登录。
2. **路由就绪**：确认目标 Corpus 的 ``config.extractor_routes`` 已把 ``source_kind=pdf`` 路由到
   ``negentropy-perceives.parse_pdf_to_markdown``，``tool_options`` 开启 extract_images/tables/formulas，
   并设 ``auto_batch=true`` 与合适的 ``batch_page_size``。
3. **分批摄取**：经 Documents Ingest 上传 PDF。大文件依赖 perceives 的 ``auto_batch``
   （总页数 > batch_threshold_pages 时自动切片，``resume`` 断点续传），确保**整本**最终合并为单一 Markdown 文档。
4. **等待完成**：轮询文档 ``markdown_extract_status`` 至 ``completed``（失败则查 ``markdown_extract_error`` 并 refresh 重试）。
5. **渲染核对**：在 Documents 页 View 渲染结果（react-markdown + remark-gfm/math + rehype-katex/raw/highlight/sanitize）。
6. **逐页对比**：按上「一比一还原范围」逐页 / 逐模块比对源 PDF 与渲染 Markdown，逐条记录差异（页号 + 类别 + 现象）。
7. **发现一处修一处（分层修复路由）**：
   - **渲染层**：DocumentMarkdownRenderer / sanitize schema / DocumentImage（图片宽高、表格、KaTeX、代码高亮、figure/figcaption、TOC 锚点）。
   - **摄取层**：图片链接重写、资产存储、元数据。
   - **管线层**：perceives 引擎选型、分批边界、跨片合并（图片去重、边界图注补救）、图片分辨率与显示尺寸提取。
   改后经 refresh_markdown 重摄取或重载页面，复核该项。
8. **循环**：重复 6–7，直到逐页校验清单全绿；保留关键页源 PDF vs 渲染 Markdown 对比截图为证。

## 反模式（严禁）
- 跳过逐页核对即声明完成；
- 只比文字而忽略图 / 表 / 公式 / 代码 / 注释；
- 图片不还原原始显示尺寸（宽高）。

## 完成判据
逐页校验清单全绿 + 关键页对比截图留证 + 整本 PDF 在 Documents 页可读性与一致性达最佳。
"""

DESCRIPTION = (
    "用 negentropy-perceives 的 parse_pdf_to_markdown 经 Knowledge Base Documents Ingest 将 PDF "
    "一比一还原为可渲染 Markdown（文字、段落顺序、高清原图、图片显示尺寸、目录、表格、数学公式、"
    "代码块、注释），大文件分批，逐页浏览器对比、发现一处修一处，直至完全一致。"
)

REQUIRED_TOOLS = ["data-extractor", "parse_pdf_to_markdown", "ingest_to_corpus"]

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "pdf_source": {"type": "string", "description": "本地绝对路径或 http(s) URL 的 PDF 源"},
        "corpus_name": {
            "type": "string",
            "default": "Harness Engineering",
            "description": "目标 Knowledge Corpus 名称",
        },
        "method": {
            "type": "string",
            "enum": ["auto", "smart", "docling", "mineru", "marker", "pymupdf", "pypdf"],
            "default": "auto",
            "description": "perceives 解析引擎",
        },
        "batch_page_size": {
            "type": "integer",
            "minimum": 1,
            "maximum": 200,
            "default": 40,
            "description": "auto_batch 单切片最大页数",
        },
        "batch_threshold_pages": {
            "type": "integer",
            "minimum": 1,
            "default": 60,
            "description": "超过该页数才启用 auto_batch 分批",
        },
    },
    "required": ["pdf_source"],
}

DEFAULT_CONFIG = {
    "corpus_name": "Harness Engineering",
    "method": "auto",
    "batch_page_size": 40,
    "batch_threshold_pages": 60,
}

RESOURCES = [
    {
        "type": "corpus",
        "ref": "harness-engineering",
        "title": "Harness Engineering corpus（默认目标语料库）",
        "lazy": True,
    },
    {
        "type": "url",
        "ref": "https://github.com/negentropy/negentropy-perceives",
        "title": "negentropy-perceives parse_pdf_to_markdown 工具文档",
        "lazy": True,
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    # --- 种子 skill 行（幂等 INSERT；显式 is_system=TRUE + is_global=TRUE）---
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
            :required_tools, TRUE, TRUE, TRUE, 20,
            'warning', :resources
        )
        ON CONFLICT (name) DO NOTHING
        """
        ).bindparams(
            sa.bindparam("name", value=SKILL_NAME, type_=sa.Text),
            sa.bindparam("display_name", value="PDF 高保真还原 (PDF Fidelity Restore)", type_=sa.Text),
            sa.bindparam("description", value=DESCRIPTION, type_=sa.Text),
            sa.bindparam("version", value=SKILL_VERSION, type_=sa.Text),
            sa.bindparam("prompt_template", value=PROMPT_TEMPLATE, type_=sa.Text),
            sa.bindparam("config_schema", value=CONFIG_SCHEMA, type_=JSONB),
            sa.bindparam("default_config", value=DEFAULT_CONFIG, type_=JSONB),
            sa.bindparam("required_tools", value=REQUIRED_TOOLS, type_=JSONB),
            sa.bindparam("resources", value=RESOURCES, type_=JSONB),
        )
    )

    # --- 初始版本快照（NOT EXISTS 守卫；让 name@1.0.0 引用立即可用）---
    skill_id = conn.execute(
        sa.text(f"SELECT id FROM {SCHEMA}.skills WHERE name = :name").bindparams(
            sa.bindparam("name", value=SKILL_NAME, type_=sa.Text)
        )
    ).scalar()
    if skill_id is not None:
        snapshot = {
            "name": SKILL_NAME,
            "display_name": "PDF 高保真还原 (PDF Fidelity Restore)",
            "description": DESCRIPTION,
            "category": "knowledge",
            "prompt_template": PROMPT_TEMPLATE,
            "config_schema": CONFIG_SCHEMA,
            "default_config": DEFAULT_CONFIG,
            "required_tools": REQUIRED_TOOLS,
            "priority": 20,
            "enforcement_mode": "warning",
            "resources": RESOURCES,
            "is_global": True,
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


def downgrade() -> None:
    # 删除种子技能行（级联 skill_versions / skill_schedules），精确匹配 name。
    op.execute(
        sa.text(f"DELETE FROM {SCHEMA}.skills WHERE name = :name").bindparams(
            sa.bindparam("name", value=SKILL_NAME, type_=sa.Text)
        )
    )
