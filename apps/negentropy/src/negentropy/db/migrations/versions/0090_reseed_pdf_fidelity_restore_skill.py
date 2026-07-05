"""Re-seed: pdf-fidelity-restore 全局技能内容刷新（R10 沉淀 + 死链修正）

Revision ID: 0090
Revises: 0089
Create Date: 2026-07-05 00:00:00.000000+00:00

设计动机：
    0064 以 ``ON CONFLICT (name) DO NOTHING`` 首发种子了 ``pdf-fidelity-restore`` 全局技能行，
    其 ``prompt_template`` / ``resources`` 是**冻结快照**。运行时 ``skills_injector.resolve_skills``
    注入的是 **DB 行**（非 YAML/SKILL.md），故仅改 ``skill_templates/*.yaml`` 与
    ``.agent/skills/*/SKILL.md`` 不会触达 live 的一核五翼 Agent —— 必须以一次非破坏 re-seed
    把 R10 沉淀（热更铁律：改 perceives 须重启 MCP + 清 ``.batch_state``；关键洞察：切片无共享
    可变状态 / 1:1 验收须到浏览器渲染态 / 图注勿双渲染）与 perceives 死链修正推到 DB 行。

正交分解：
    0064 专注「首发创建」（INSERT），本迁移专注「内容刷新」（UPDATE + 新版本快照），
    不重复创建、不删除主行（主行的生命周期由 0064 owns）。

幂等性 / 非破坏：
    - upgrade：按 ``name`` 精确 UPDATE 现有行的 ``prompt_template`` / ``resources`` / ``version``
      （行不存在则 UPDATE 影响 0 行，安全）；``skill_versions`` 1.1.0 快照以 ``NOT EXISTS`` 守卫。
      重跑写入相同值，安全。
    - downgrade：**非破坏 no-op**（AGENTS.md「谨慎回滚，严禁删数据」）。不删主行（那是 0064
      downgrade 的职责），不回退内容（1.1.0 快照保留于 skill_versions 供审计）。

SSOT 提示：
    本迁移内嵌的 ``PROMPT_TEMPLATE`` / ``RESOURCES`` 是 R10 版**冻结快照**（Alembic 不可变原则），
    与「活」定义 ``skill_templates/pdf_fidelity_restore.yaml``（version 1.1.0）+
    ``.agent/skills/pdf-fidelity-restore/SKILL.md`` 首发内容一致。二 twin 骨架一致性由
    ``tests/unit_tests/agents/test_skill_pdf_fidelity_parity.py`` 守卫。

部署注意：
    裸 SQL UPDATE **不触发** ``skills_injector.invalidate_global_skills_cache`` 的进程内失效；
    已 warm 的引擎需重启（或等缓存 TTL）方见 1.1.0 正文。迁移随部署重启一并生效。
"""

# ruff: noqa: E501

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0090"
down_revision: str | None = "0089"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
SKILL_NAME = "pdf-fidelity-restore"
NEW_VERSION = "1.1.0"

# R10 版正文冻结快照（与 skill_templates/pdf_fidelity_restore.yaml@1.1.0 一致）
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
   - **热更铁律（改 perceives src/ 后必做，否则改动不生效）**：① 重启 perceives MCP 进程（Python 无热重载）；② 清 checkpoint `rm -rf <output_dir>/output/.batch_state/*`（auto_batch resume 按 PDF 内容 SHA-1 缓存切片，不清则复用旧切片、跳过新代码，且完成异常快）。
   改后经 refresh_markdown 重摄取或重载页面（**已清 checkpoint**），复核该项。
8. **循环**：重复 6–7，直到逐页校验清单全绿；保留关键页源 PDF vs 渲染 Markdown 对比截图为证。

## 关键洞察（R10 沉淀）
- **auto_batch 切片间无共享可变状态**：引擎实例在 pool 复用时产物落盘目录须 per-call 唯一（`tempfile.mkdtemp`）；级联/册封类状态（如 `_first_h1_seen`）须显式接收 `slice_index`，否则跨切片泄漏（标题层级错乱 / 公式重现）。
- **1:1 验收必须走到浏览器渲染态**：figure 过度捕获、KaTeX ParseError、公式双份等缺陷在 DB markdown 层不可见，仅浏览器渲染后暴露。
- **figure 图注双源风险**：多数图注已烘入 figure region PNG 像素，故 wiki/ui **不得**再从 `alt` 渲染 `figcaption`（会双图注）；caption 语义由 `alt` 承载（无障碍 + 去重指纹），视觉由图内像素承载。

## 反模式（严禁）
- 跳过逐页核对即声明完成；
- 只比文字而忽略图 / 表 / 公式 / 代码 / 注释；
- 图片不还原原始显示尺寸（宽高）。

## 完成判据
逐页校验清单全绿 + 关键页对比截图留证 + 整本 PDF 在 Documents 页可读性与一致性达最佳。

## 资源 / 基线示例（R10）
- 基线 PDF：`Self-Improving Agents in the Era of Experience: A Survey of Self- to Meta-Evolution.pdf`（88 页 / A4 双栏 LaTeX；corpus「Harness Engineering」）。
- 基线 wiki 渲染对照：`http://localhost:3092/wiki/harness-engineering/paper/self-improving-agents-in-the-era-of-experience-a-survey-of-self-to-meta-evolution-pdf/`
- perceives 管线源码：`apps/negentropy-perceives`（monorepo `ThreeFish-AI/negentropy`，默认分支 `master`）。
- 迭代记录：`docs/.agents/pdf-harness-engineering-parity.md` §9（R10 九项修复）。
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

# R10 版 resources：修 0064 的 perceives 死链（github.com/negentropy/...）→ monorepo 子树，
# 并追加 wiki 基线示例与 parity 迭代文档指针。
RESOURCES = [
    {
        "type": "corpus",
        "ref": "harness-engineering",
        "title": "Harness Engineering corpus（默认目标语料库）",
        "lazy": True,
    },
    {
        "type": "url",
        "ref": "https://github.com/ThreeFish-AI/negentropy/tree/master/apps/negentropy-perceives",
        "title": "negentropy-perceives parse_pdf_to_markdown 管线源码（monorepo，master）",
        "lazy": True,
    },
    {
        "type": "url",
        "ref": "http://localhost:3092/wiki/harness-engineering/paper/self-improving-agents-in-the-era-of-experience-a-survey-of-self-to-meta-evolution-pdf/",
        "title": "R10 基线示例（88 页综述 wiki 渲染对照）",
        "lazy": True,
    },
    {
        "type": "url",
        "ref": "https://github.com/ThreeFish-AI/negentropy/blob/master/docs/.agents/pdf-harness-engineering-parity.md",
        "title": "PDF 一比一还原质量迭代（§9 R10 九项修复）",
        "lazy": True,
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    # --- 非破坏 UPDATE：仅刷新现有行的正文/资源/版本（行不存在则影响 0 行，安全）---
    conn.execute(
        sa.text(
            f"""
        UPDATE {SCHEMA}.skills
        SET prompt_template = :prompt_template,
            resources = :resources,
            version = :version,
            updated_at = now()
        WHERE name = :name
        """
        ).bindparams(
            sa.bindparam("prompt_template", value=PROMPT_TEMPLATE, type_=sa.Text),
            sa.bindparam("resources", value=RESOURCES, type_=JSONB),
            sa.bindparam("version", value=NEW_VERSION, type_=sa.Text),
            sa.bindparam("name", value=SKILL_NAME, type_=sa.Text),
        )
    )

    # --- 新版本快照（NOT EXISTS 守卫；让 name@1.1.0 引用可用，且保留审计轨迹）---
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
                sa.bindparam("version", value=NEW_VERSION, type_=sa.Text),
                sa.bindparam("snapshot", value=snapshot, type_=JSONB),
            )
        )


def downgrade() -> None:
    # 非破坏 no-op：不删主行（0064 owns 创建/删除），不回退正文；1.1.0 快照保留于
    # skill_versions 供审计。内容再回退可手工从 1.0.0 skill_versions 快照恢复。
    pass
