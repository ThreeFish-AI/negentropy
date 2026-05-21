---
id: implementation-plan
sidebar_position: 1
title: Agentic AI 学术研究与工程应用平台 - 实施计划方案
last_update:
  author: Aurelius Huang
  created_at: 2025-12-22
  updated_at: 2025-12-23
  version: 1.1
  status: Reviewed
tags:
  - Implementation Plan
---

> [!IMPORTANT]
>
> **基于**：[PRD & Architecture v1.1](./000-prd-architecture.md)

---

## 1. 项目概述

本实施计划基于 [PRD & Architecture v1.1](./000-prd-architecture.md) 制定，详细技术细节请参考相关研究文档。

**功能优先级**

| 优先级 | 功能分类 | 核心功能                                         |
| ------ | -------- | ------------------------------------------------ |
| **P0** | 核心功能 | 内容上传与管理、智能翻译、语义搜索、任务监控     |
| **P1** | 增强功能 | 知识图谱可视化、多跳推理问答、内容关联分析       |
| **P2** | 扩展功能 | 用户认证系统、个性化推荐、协作批注、API 开放平台 |

---

## 2. 实施规划

### 2.1 总体路线图

```mermaid
gantt
    title 产品实施路线图
    dateFormat  YYYY-MM

    section Phase 1 基础巩固
    FastAPI 服务层          :p1-1, 2025-12, 2026-01
    Agent 层（Claude Skills）:p1-2, 2025-12, 2026-01
    OceanBase 向量存储集成  :p1-3, 2025-12, 2026-01
    Web UI MVP             :p1-4, 2026-01, 2026-02
    基础 RAG 检索           :p1-5, 2026-01, 2026-02

    section Phase 2 智能增强
    Neo4j 部署配置          :p2-1, 2026-02, 2026-03
    Cognee GraphRAG 集成    :p2-2, 2026-02, 2026-03
    知识图谱构建            :p2-3, 2026-03, 2026-04
    混合检索实现            :p2-4, 2026-03, 2026-04

    section Phase 3 认知增强
    多跳推理问答            :p3-1, 2026-04, 2026-05
    RAGAS 评估体系          :p3-2, 2026-04, 2026-05
    Agent 记忆持久化        :p3-3, 2026-05, 2026-06
    图谱可视化              :p3-4, 2026-05, 2026-06

    section Phase 4 生态完善
    用户认证系统            :p4-1, 2026-06, 2026-07
    个性化推荐              :p4-2, 2026-06, 2026-07
    API 开放平台            :p4-3, 2026-07, 2026-08
    移动端适配              :p4-4, 2026-07, 2026-08
```

### 2.2 阶段目标概览

| 阶段        | 时间       | 目标     | 核心交付物                                   |
| ----------- | ---------- | -------- | -------------------------------------------- |
| **Phase 1** | Q4 2025    | 基础能力 | FastAPI 服务、Agent 层、向量检索、Web UI MVP |
| **Phase 2** | Q1-Q2 2026 | 智能增强 | Neo4j 图谱、Cognee 集成、混合检索            |
| **Phase 3** | Q1-Q2 2026 | 认知增强 | 多跳推理、RAGAS 评估、记忆持久化             |
| **Phase 4** | Q2-Q3 2026 | 生态完善 | 用户系统、推荐系统、API 平台                 |

### 2.3 里程碑检查点

| 里程碑 | 日期    | 验收标准                                            |
| ------ | ------- | --------------------------------------------------- |
| **M1** | 2026-01 | 单内容完整处理流程可用（上传 → 解析 → 翻译 → 分析） |
| **M2** | 2026-02 | Web UI MVP 上线，基础 RAG 检索可用                  |
| **M3** | 2026-04 | 知识图谱构建完成，混合检索实现                      |
| **M4** | 2026-06 | 多跳推理问答可用，RAGAS 评估达标                    |
| **M5** | 2026-08 | 完整平台上线，包含用户系统和 API 平台               |

---

## 3. 阶段一：基础巩固

> **时间**：2025-12 ~ 2026-02  
> **目标**：构建核心处理流程，实现单内容完整处理链路（上传 → 解析 → 翻译 → 分析）

### 3.1 任务分解

```mermaid
flowchart TD
    subgraph "Phase 1 任务分解"
        T1[1.1 后端服务层]
        T2[1.2 Agent 层]
        T3[1.3 OceanBase 集成]
        T4[1.4 Web UI MVP]
        T5[1.5 基础 RAG 检索]
    end

    T1 --> T2
    T2 --> T3
    T1 --> T4
    T3 --> T5

    style T1 fill:#4285f4,color:#fff
    style T2 fill:#34a853,color:#fff
    style T3 fill:#ea4335,color:#fff
    style T4 fill:#fbbc04,color:#000
    style T5 fill:#9c27b0,color:#fff
```

### 3.2 任务 1.1：后端服务层

**目标**：基于 FastAPI 构建异步高性能后端服务

#### 3.2.1 目录结构

```shell
cognizes/
├── main.py                        # FastAPI 应用入口
├── api/
│   ├── __init__.py
│   ├── routes/
│   │   ├── sources.py             # 内容管理 API
│   │   ├── tasks.py               # 任务管理 API
│   │   ├── search.py              # 搜索 API
│   │   └── health.py              # 健康检查
│   ├── services/
│   │   ├── source_service.py      # 内容服务
│   │   ├── task_service.py        # 任务服务
│   │   └── search_service.py      # 搜索服务
│   └── websocket/
│       └── task_events.py         # WebSocket 任务事件
├── core/
│   ├── config.py                  # 配置管理
│   ├── database.py                # 数据库连接
│   ├── exceptions.py              # 异常定义
│   └── models/                    # Pydantic 模型
└── agents/                        # Agent 层 (Task 1.2)
```

#### 3.2.2 核心 API 设计

| 端点                        | 方法   | 功能             | 请求体/参数                     |
| --------------------------- | ------ | ---------------- | ------------------------------- |
| `/api/v1/sources`           | POST   | 上传内容         | `multipart/form-data`           |
| `/api/v1/sources`           | GET    | 列表查询         | `?page=1&size=20&status=`       |
| `/api/v1/sources/{id}`      | GET    | 获取详情         | -                               |
| `/api/v1/sources/{id}`      | DELETE | 删除内容         | -                               |
| `/api/v1/tasks`             | GET    | 任务列表         | `?status=pending`               |
| `/api/v1/tasks/{id}/cancel` | POST   | 取消任务         | -                               |
| `/api/v1/tasks/{id}/retry`  | POST   | 重试任务         | -                               |
| `/api/v1/search`            | POST   | 语义搜索         | `{"query": "...", "limit": 10}` |
| `/ws/tasks`                 | WS     | 任务状态实时推送 | -                               |

#### 3.2.3 验收标准

| 验收项         | 标准                     | 验证方式   |
| -------------- | ------------------------ | ---------- |
| API 响应时间   | < 500ms (P95)            | 性能测试   |
| 并发处理能力   | 支持 100+ 并发上传       | 压力测试   |
| WebSocket 连接 | 支持 1000+ 同时连接      | 连接测试   |
| 异常处理       | 统一错误响应格式         | 代码审查   |
| API 文档       | Swagger/OpenAPI 自动生成 | 访问 /docs |

### 3.3 任务 1.2：Agent 层（Google ADK）

**目标**：基于 Google ADK 实现核心 Agent，完成内容处理流程

> **框架选型说明**：
>
> - Phase 1 采用 Google ADK 作为主框架，利用其 LlmAgent、Workflow Agent、MCP 集成等成熟能力
> - Phase 2 引入 Claude SDK + Agent Skills 实现高级认知功能
> - 参考：[Agent Frameworks 调研报告](./research/002-agent-frameworks.md)

#### 3.3.1 Agent 目录结构

```shell
cognizes/agents/
├── adk/                           # Google ADK 实现 (Phase 1)
│   ├── __init__.py
│   ├── coordinator.py             # 中央协调 Agent (SequentialAgent)
│   ├── reader_agent.py            # 多源内容解析 Agent (LlmAgent)
│   ├── translation_agent.py       # 翻译 Agent (LlmAgent)
│   ├── heartfelt_agent.py         # 深度分析 Agent (LlmAgent)
│   ├── tools/                     # 自定义工具
│   │   ├── pdf_parser.py
│   │   ├── web_scraper.py
│   │   └── oceanbase_search.py
│   └── workflows/                 # 工作流编排
│       └── content_pipeline.py
└── claude/                        # Claude SDK 实现 (Phase 2)
    ├── skills.py                  # Agent Skills 调用封装
    └── cognizes_agent.py          # 认知增强 Agent
```

#### 3.3.2 Google ADK 依赖配置

```bash
# 安装 Google ADK
pip install google-adk

# 配置 Google Cloud 认证
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
# 或使用
export GOOGLE_API_KEY="your-google-api-key"
```

#### 3.3.3 Agent 实现要点

**Coordinator Agent（中央协调器）**：

```python
# cognizes/agents/adk/coordinator.py
from google.adk.agents import LlmAgent, SequentialAgent, ParallelAgent
from .reader_agent import create_reader_agent
from .translation_agent import create_translation_agent
from .heartfelt_agent import create_heartfelt_agent

def create_content_pipeline():
    """创建内容处理工作流"""

    # 1. Reader Agent - 解析内容
    reader = create_reader_agent()

    # 2. 并行阶段：翻译 + 分析
    translation = create_translation_agent()
    analysis = create_heartfelt_agent()

    parallel_stage = ParallelAgent(
        name="parallel_processing",
        sub_agents=[translation, analysis]
    )

    # 3. 组合为顺序工作流
    return SequentialAgent(
        name="content_pipeline",
        sub_agents=[reader, parallel_stage]
    )
```

**Reader Agent（内容解析）**：

```python
# cognizes/agents/adk/reader_agent.py
from google.adk.agents import LlmAgent
from .tools.pdf_parser import parse_pdf
from .tools.web_scraper import scrape_url

def create_reader_agent() -> LlmAgent:
    """创建 Reader Agent"""
    return LlmAgent(
        model="gemini-2.0-flash",
        name="reader_agent",
        description="解析多种格式的内容源",
        instruction="""你是一个内容解析专家。

任务流程：
1. 根据输入类型选择合适的解析工具
2. 提取标题、摘要、作者、正文等关键信息
3. 输出结构化的内容数据

支持格式：PDF, Markdown, URL, arXiv""",
        tools=[parse_pdf, scrape_url]
    )
```

**Translation Agent（翻译）**：

```python
# cognizes/agents/adk/translation_agent.py
from google.adk.agents import LlmAgent

def create_translation_agent() -> LlmAgent:
    """创建翻译 Agent"""
    return LlmAgent(
        model="gemini-2.0-flash",
        name="translation_agent",
        description="学术内容翻译",
        instruction="""你是一个学术翻译专家，负责将英文学术内容翻译为中文。

翻译规范：
1. 保留学术术语原文：Chain-of-Thought、ReAct、RAG 等
2. 保持原文结构：标题层级、列表、代码块
3. 术语表格：附加关键术语英中对照表
4. 质量目标：BLEU > 0.7"""
    )
```

**Heartfelt Agent（深度分析）**：

```python
# cognizes/agents/adk/heartfelt_agent.py
from google.adk.agents import LlmAgent
from .tools.oceanbase_search import semantic_search

def create_heartfelt_agent() -> LlmAgent:
    """创建深度分析 Agent"""
    return LlmAgent(
        model="gemini-2.0-flash",
        name="heartfelt_agent",
        description="论文深度分析与洞察提取",
        instruction="""你是一个学术分析专家，负责深度分析论文内容。

分析维度：
1. 核心创新点提取
2. 方法论优缺点分析
3. 与相关工作对比
4. 实践应用场景
5. 研究局限与未来方向

输出格式：结构化 Markdown 分析报告""",
        tools=[semantic_search]
    )
```

**Reader Agent 支持格式**：

| 格式  | 解析库         | 优先级 |
| ----- | -------------- | ------ |
| PDF   | PyMuPDF (fitz) | P0     |
| MD    | markdown-it-py | P0     |
| DOCX  | python-docx    | P1     |
| URL   | httpx + bs4    | P0     |
| arXiv | arxiv API      | P1     |

#### 3.3.4 验收标准

| 验收项         | 标准                      | 验证方式 |
| -------------- | ------------------------- | -------- |
| PDF 解析准确率 | > 95% 文本提取正确        | 样本测试 |
| 翻译质量       | 术语保留 100%，BLEU > 0.7 | 人工评估 |
| 流程完整性     | 端到端流程无中断          | E2E 测试 |
| 元数据提取     | 准确率 > 90%              | 样本验证 |

### 3.4 任务 1.3：OceanBase 集成

**目标**：集成 OceanBase 向量数据库，实现内容存储与向量检索

#### 3.4.1 Schema 创建脚本

```sql
-- 1. 创建数据库
CREATE DATABASE IF NOT EXISTS cognizes DEFAULT CHARSET utf8mb4;

-- 2. 内容元数据表
CREATE TABLE sources (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_type ENUM('paper', 'article', 'document', 'code_repo') NOT NULL,
    title VARCHAR(500) NOT NULL,
    abstract TEXT,
    authors JSON,
    url VARCHAR(1000),
    format VARCHAR(50),
    publication_date DATE,
    category VARCHAR(100),
    status ENUM('pending', 'processing', 'translated', 'analyzed') DEFAULT 'pending',
    metadata JSON,
    file_path VARCHAR(1000),
    translation_path VARCHAR(1000),
    analysis_path VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. 向量表
CREATE TABLE source_embeddings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_id BIGINT NOT NULL,
    chunk_index INT DEFAULT 0,
    chunk_text TEXT,
    embedding VECTOR(1536),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 4. HNSW 向量索引
CREATE INDEX idx_embedding_hnsw ON source_embeddings
USING HNSW (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- 5. 任务表
CREATE TABLE tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_id BIGINT,
    task_type ENUM('parse', 'translate', 'analyze', 'full') NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    progress FLOAT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 6. 全文索引（用于关键词检索）
CREATE FULLTEXT INDEX idx_sources_fulltext ON sources (title, abstract);
```

#### 3.4.2 验收标准

| 验收项     | 标准              | 验证方式     |
| ---------- | ----------------- | ------------ |
| 数据库连接 | 连接池正常工作    | 连接测试     |
| CRUD 操作  | 增删改查正常      | 单元测试     |
| 向量索引   | HNSW 索引正确创建 | EXPLAIN 验证 |
| 相似度搜索 | Top-K 结果正确    | 准确率测试   |
| 检索延迟   | < 100ms (P95)     | 性能测试     |

### 3.5 任务 1.4：Web UI MVP

**目标**：构建基础 Web 界面，支持内容上传、列表查看、任务监控

#### 3.5.1 目录结构

```shell
ui/src/
├── app/
│   ├── layout.tsx             # 全局布局
│   ├── page.tsx               # 首页（仪表板）
│   ├── sources/
│   │   ├── page.tsx           # 内容列表
│   │   ├── [id]/page.tsx      # 内容详情
│   │   └── upload/page.tsx    # 上传页面
│   ├── tasks/page.tsx         # 任务监控
│   └── search/page.tsx        # 搜索页面
├── components/
│   ├── SourceCard.tsx         # 内容卡片
│   ├── UploadZone.tsx         # 上传区域
│   ├── TaskList.tsx           # 任务列表
│   └── SearchBox.tsx          # 搜索框
├── hooks/
│   ├── useApi.ts              # API 调用
│   └── useWebSocket.ts        # WebSocket 连接
└── store/
    ├── sourceStore.ts         # 内容状态 (Zustand)
    └── taskStore.ts           # 任务状态 (Zustand)
```

#### 3.5.2 核心功能页面

| 页面     | 功能                               | 优先级 |
| -------- | ---------------------------------- | ------ |
| 仪表板   | 统计概览、最近活动                 | P0     |
| 内容列表 | 表格展示、排序、筛选、分页         | P0     |
| 上传页面 | 拖拽上传、批量上传、进度显示       | P0     |
| 任务监控 | 实时状态、WebSocket 推送、取消重试 | P0     |
| 搜索页面 | 语义搜索、结果高亮                 | P1     |
| 内容详情 | Tab 切换（原文/翻译/分析）         | P1     |

#### 3.5.3 验收标准

| 验收项       | 标准                | 验证方式   |
| ------------ | ------------------- | ---------- |
| 页面加载     | < 2s (首屏)         | Lighthouse |
| 文件上传     | 50MB 文件 < 30s     | 功能测试   |
| 任务实时更新 | WebSocket 延迟 < 1s | 连接测试   |
| 响应式设计   | 适配移动端          | 视觉测试   |

### 3.6 任务 1.5：基础 RAG 检索

**目标**：实现基于向量的语义检索功能

#### 3.6.1 检索流程

```mermaid
flowchart LR
    Q[用户查询] --> E[生成向量]
    E --> S[向量相似度搜索]
    S --> R[Top-K 结果]
    R --> C{需要生成回答?}
    C -->|是| G[LLM 生成回答]
    C -->|否| O[返回结果]
    G --> O
```

#### 3.6.2 验收标准

| 验收项       | 标准                      | 验证方式   |
| ------------ | ------------------------- | ---------- |
| 检索响应时间 | < 500ms                   | 性能测试   |
| 检索准确率   | 相关结果占 Top-10 的 80%+ | 人工评估   |
| 回答质量     | Faithfulness > 85%        | RAGAS 评估 |

### 3.7 阶段一验收清单

| 检查项                 | 状态 | 验收日期 |
| ---------------------- | ---- | -------- |
| FastAPI 服务启动正常   | ☐    |          |
| API 文档可访问 (/docs) | ☐    |          |
| WebSocket 连接正常     | ☐    |          |
| Reader Agent 解析 PDF  | ☐    |          |
| Translation Agent 翻译 | ☐    |          |
| Heartfelt Agent 分析   | ☐    |          |
| 完整流程端到端可用     | ☐    |          |
| OceanBase 连接正常     | ☐    |          |
| 向量索引创建成功       | ☐    |          |
| 向量检索功能可用       | ☐    |          |
| Web UI 首页可访问      | ☐    |          |
| 文件上传功能正常       | ☐    |          |
| 任务监控实时更新       | ☐    |          |
| 语义搜索功能可用       | ☐    |          |
| 测试覆盖率 > 80%       | ☐    |          |

---

## 4. 阶段二：智能增强

> **时间**：2026-02 ~ 2026-04  
> **目标**：集成 Neo4j 与 Cognee，构建知识图谱与混合检索能力

### 4.1 任务分解

```mermaid
flowchart TD
    subgraph "Phase 2 任务分解"
        T1[2.1 Neo4j 部署配置]
        T2[2.2 Cognee 集成]
        T3[2.3 知识图谱构建]
        T4[2.4 混合检索实现]
    end

    T1 --> T2
    T2 --> T3
    T3 --> T4

    style T1 fill:#4285f4,color:#fff
    style T2 fill:#34a853,color:#fff
    style T3 fill:#ea4335,color:#fff
    style T4 fill:#9c27b0,color:#fff
```

### 4.2 任务 2.1：Neo4j 部署配置

**目标**：部署 Neo4j 图数据库，创建知识图谱 Schema

#### 4.2.1 部署方式

| 环境 | 部署方式           | 配置                   |
| ---- | ------------------ | ---------------------- |
| 开发 | Docker Compose     | 单节点，社区版         |
| 测试 | Docker Compose     | 单节点，企业版（可选） |
| 生产 | Neo4j AuraDB / K8s | 集群模式，企业版       |

**Docker Compose 配置**：

```yaml
version: "3.8"
services:
  neo4j:
    image: neo4j:5.26.0
    ports:
      - "7474:7474" # HTTP
      - "7687:7687" # Bolt
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7474"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  neo4j_data:
  neo4j_logs:
```

#### 4.2.2 Schema 创建

```cypher
// 1. 创建约束 - 确保唯一性
CREATE CONSTRAINT source_id_unique FOR (s:Source) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT paper_id_unique FOR (p:Paper) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT article_id_unique FOR (a:Article) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT author_name_unique FOR (a:Author) REQUIRE a.name IS UNIQUE;
CREATE CONSTRAINT concept_name_unique FOR (c:Concept) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT method_name_unique FOR (m:Method) REQUIRE m.name IS UNIQUE;

// 2. 创建向量索引
CREATE VECTOR INDEX source_embedding FOR (s:Source) ON (s.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1536,
    `vector.similarity_function`: 'cosine'
  }
};

// 3. 创建全文索引
CREATE FULLTEXT INDEX source_fulltext FOR (s:Source) ON EACH [s.title, s.abstract];
```

#### 4.2.3 验收标准

| 验收项         | 标准                  | 验证方式         |
| -------------- | --------------------- | ---------------- |
| Neo4j 服务启动 | 健康检查通过          | 端口测试         |
| 约束创建成功   | 6 个唯一性约束        | SHOW CONSTRAINTS |
| 向量索引创建   | cosine 相似度索引可用 | SHOW INDEXES     |
| Python 连接    | neo4j-driver 正常连接 | 连接测试         |

### 4.3 任务 2.2：Cognee 集成

**目标**：集成 Cognee 框架，配置三存储架构

#### 4.3.1 Cognee 配置

```python
# cognizes/core/cognee_config.py
import cognee
from cognee.infrastructure.databases.graph import Neo4jConfig
from cognee.infrastructure.databases.vector import QdrantConfig

async def init_cognee():
    """初始化 Cognee 配置"""

    # 1. 配置 LLM
    cognee.config.set_llm_api_key(os.getenv("ANTHROPIC_API_KEY"))
    cognee.config.set_llm_provider("anthropic")
    cognee.config.set_llm_model("claude-sonnet-4-20250514")

    # 2. 配置 Embedding
    cognee.config.set_embedding_provider("openai")
    cognee.config.set_embedding_model("text-embedding-3-small")

    # 3. 配置图存储 (Neo4j)
    cognee.config.set_graph_db_config(Neo4jConfig(
        uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        username=os.getenv("NEO4J_USER", "neo4j"),
        password=os.getenv("NEO4J_PASSWORD", "password")
    ))

    # 4. 配置向量存储 (使用 OceanBase 或 Qdrant)
    # 注：Cognee 原生支持 Qdrant，OceanBase 需自定义适配器

    # 5. 重置数据（可选，开发时使用）
    # await cognee.prune.prune_data()
    # await cognee.prune.prune_system(metadata=True)
```

#### 4.3.2 Cognee 服务封装

```python
# cognizes/core/memory.py
import cognee
from typing import List, Dict, Any

class CogneeMemory:
    """Cognee 认知记忆层封装"""

    async def add_content(self, content: str, dataset: str = "default") -> None:
        """添加内容到记忆层"""
        await cognee.add(content, dataset_name=dataset)

    async def add_file(self, file_path: str, dataset: str = "default") -> None:
        """添加文件到记忆层"""
        await cognee.add(file_path, dataset_name=dataset)

    async def cognify(self) -> None:
        """处理数据，构建知识图谱"""
        await cognee.cognify()

    async def search(self, query: str, search_type: str = "INSIGHTS") -> List[Dict]:
        """混合检索"""
        results = await cognee.search(
            query_text=query,
            query_type=search_type  # INSIGHTS, SUMMARIES, CHUNKS, GRAPH_COMPLETION
        )
        return results

    async def get_graph_data(self) -> Dict[str, Any]:
        """获取图谱数据（用于可视化）"""
        graph = await cognee.get_knowledge_graph()
        return {
            "nodes": [{"id": n.id, "label": n.name, "type": type(n).__name__}
                      for n in graph.nodes],
            "edges": [{"source": e.source_id, "target": e.target_id, "type": e.type}
                      for e in graph.edges]
        }
```

#### 4.3.3 验收标准

| 验收项         | 标准         | 验证方式 |
| -------------- | ------------ | -------- |
| Cognee 初始化  | 无报错启动   | 日志检查 |
| cognee.add     | 成功添加文档 | API 测试 |
| cognee.cognify | 成功构建图谱 | 图谱查询 |
| cognee.search  | 返回相关结果 | 检索测试 |

#### 4.3.4 OceanBase Vector Store 适配器

**目标**：为 Cognee 开发 OceanBase 向量存储适配器

**实现步骤**：

1. 创建 `cognizes/core/cognee_oceanbase.py`
2. 实现 `OceanBaseVectorStore` 类，继承 Cognee BaseVectorStore
3. 实现 `add_vectors()`, `search()`, `delete()` 方法
4. 使用 OceanBase HNSW 索引进行向量检索

**代码示例**：

```python
# cognizes/core/cognee_oceanbase.py
from typing import List, Optional
from cognee.infrastructure.databases.vector import BaseVectorStore
import pymysql

class OceanBaseVectorStore(BaseVectorStore):
    """自定义 OceanBase 向量存储适配器"""

    def __init__(self, connection_config: dict):
        self.config = connection_config
        self._connection = None

    async def add_vectors(
        self,
        vectors: List[List[float]],
        ids: List[str],
        collection: str,
        metadata: Optional[List[dict]] = None
    ) -> None:
        """添加向量到 OceanBase"""
        sql = f"""
            INSERT INTO {collection}_embeddings (id, embedding, metadata)
            VALUES (%s, %s, %s)
        """
        # 执行批量插入
        pass

    async def search(
        self,
        query_vector: List[float],
        collection: str,
        k: int = 10
    ) -> List[dict]:
        """向量相似度搜索"""
        sql = f"""
            SELECT id, chunk_text,
                   embedding <-> %s AS distance
            FROM {collection}_embeddings
            ORDER BY embedding <-> %s
            LIMIT %s
        """
        # 执行查询并返回结果
        pass

    async def delete(self, ids: List[str], collection: str) -> None:
        """删除向量"""
        sql = f"DELETE FROM {collection}_embeddings WHERE id IN %s"
        pass
```

**验收标准**：

| 验收项              | 标准                   | 验证方式 |
| ------------------- | ---------------------- | -------- |
| 适配器单元测试      | 全部通过               | pytest   |
| Cognee API 透明使用 | cognee.search 正常返回 | 集成测试 |
| 向量检索准确率      | Recall@10 > 85%        | 评估测试 |

### 4.4 任务 2.3：知识图谱构建

**目标**：实现内容到知识图谱的自动转换

#### 4.4.1 实体抽取流程

```mermaid
flowchart LR
    C[内容文本] --> S[分块处理]
    S --> E[实体抽取 LLM]
    E --> R[关系识别 LLM]
    R --> N[写入 Neo4j]
    N --> V[向量嵌入]
    V --> I[索引更新]
```

#### 4.4.2 自定义实体抽取

```python
# cognizes/agents/claude/entity_extractor.py
from typing import List, Dict
import anthropic

class EntityExtractor:
    """实体和关系抽取器"""

    ENTITY_TYPES = ["Paper", "Author", "Concept", "Method", "Framework", "Dataset"]
    RELATION_TYPES = ["AUTHORED_BY", "CITES", "USES_METHOD", "INTRODUCES", "EXTENDS"]

    def __init__(self):
        self.client = anthropic.Anthropic()

    async def extract(self, content: str) -> Dict:
        """从内容中抽取实体和关系"""
        prompt = f"""从以下学术内容中抽取实体和关系。

实体类型：{', '.join(self.ENTITY_TYPES)}
关系类型：{', '.join(self.RELATION_TYPES)}

内容：
{content[:4000]}

请返回 JSON 格式：
{{
    "entities": [
        {{"type": "...", "name": "...", "properties": {{...}}}}
    ],
    "relations": [
        {{"type": "...", "source": "...", "target": "...", "properties": {{...}}}}
    ]
}}
"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        return self._parse_response(response.content[0].text)
```

#### 4.4.3 验收标准

| 验收项         | 标准             | 验证方式   |
| -------------- | ---------------- | ---------- |
| 实体抽取准确率 | > 80%            | 人工评估   |
| 关系识别准确率 | > 75%            | 人工评估   |
| 图谱完整性     | 核心实体全部入图 | 图遍历验证 |

### 4.5 任务 2.4：混合检索实现

**目标**：实现关键词 + 向量 + 图谱的三路混合检索

#### 4.5.1 混合检索架构

```mermaid
flowchart LR
    Q[用户查询] --> Parse[查询解析]

    Parse --> KW[关键词检索<br/>OceanBase 全文]
    Parse --> Vec[向量检索<br/>OceanBase HNSW]
    Parse --> Graph[图谱检索<br/>Neo4j Cypher]

    KW & Vec & Graph --> Fusion[RRF 融合<br/>重排序]
    Fusion --> Rerank[LLM 重排序<br/>可选]
    Rerank --> Result[检索结果]
```

#### 4.5.2 RRF 融合算法

```python
# cognizes/api/services/hybrid_search.py
from typing import List, Dict

def reciprocal_rank_fusion(
    results_list: List[List[Dict]],
    k: int = 60
) -> List[Dict]:
    """RRF 融合多路检索结果

    RRF Score = Σ 1/(k + rank_i) for each result list
    """
    scores = {}

    for results in results_list:
        for rank, item in enumerate(results, 1):
            doc_id = item["id"]
            if doc_id not in scores:
                scores[doc_id] = {"item": item, "score": 0}
            scores[doc_id]["score"] += 1 / (k + rank)

    # 按分数排序
    sorted_results = sorted(
        scores.values(),
        key=lambda x: x["score"],
        reverse=True
    )

    return [r["item"] for r in sorted_results]
```

#### 4.5.3 智能路由器

```python
# cognizes/api/services/search_router.py
from enum import Enum

class QueryType(Enum):
    FACTUAL = "factual"      # 事实查询 → 向量检索
    RELATIONAL = "relational" # 关系查询 → 图谱检索
    COMPLEX = "complex"       # 复杂查询 → 混合检索

class SearchRouter:
    """智能查询路由器"""

    async def classify(self, query: str) -> QueryType:
        """分类查询类型"""
        # 使用 LLM 或规则判断查询类型
        if any(kw in query for kw in ["关系", "引用", "使用了", "基于"]):
            return QueryType.RELATIONAL
        elif any(kw in query for kw in ["什么是", "定义", "解释"]):
            return QueryType.FACTUAL
        else:
            return QueryType.COMPLEX

    async def route(self, query: str) -> List[str]:
        """返回应使用的检索方法"""
        query_type = await self.classify(query)

        if query_type == QueryType.FACTUAL:
            return ["vector"]
        elif query_type == QueryType.RELATIONAL:
            return ["graph", "vector"]
        else:
            return ["keyword", "vector", "graph"]
```

#### 4.5.4 验收标准

| 验收项       | 标准               | 验证方式 |
| ------------ | ------------------ | -------- |
| 三路检索可用 | 全部正常返回结果   | 功能测试 |
| RRF 融合正确 | 排序符合预期       | 单元测试 |
| 混合检索质量 | Precision@10 > 70% | 评估测试 |
| 响应时间     | < 1s               | 性能测试 |

#### 4.5.5 三路检索并发实现

```python
# cognizes/api/services/hybrid_search.py
import asyncio
from typing import List, Dict

class HybridSearchService:
    """混合检索服务"""

    async def search(self, query: str, limit: int = 10) -> List[Dict]:
        """并发执行三路检索并融合结果"""

        # 并发执行三路检索
        keyword_task = self._keyword_search(query, limit)
        vector_task = self._vector_search(query, limit)
        graph_task = self._graph_search(query, limit)

        results = await asyncio.gather(
            keyword_task,
            vector_task,
            graph_task,
            return_exceptions=True
        )

        # 过滤失败的检索
        valid_results = [
            r for r in results
            if not isinstance(r, Exception) and r is not None
        ]

        # RRF 融合 (k=60 为学术推荐值 [Cormack 2009])
        return reciprocal_rank_fusion(valid_results, k=60)

    async def _keyword_search(self, query: str, limit: int) -> List[Dict]:
        """关键词检索 - OceanBase FULLTEXT"""
        sql = """
            SELECT id, title, abstract,
                   MATCH(title, abstract) AGAINST(%s) AS score
            FROM sources
            WHERE MATCH(title, abstract) AGAINST(%s IN BOOLEAN MODE)
            ORDER BY score DESC
            LIMIT %s
        """
        # 执行查询
        pass

    async def _vector_search(self, query: str, limit: int) -> List[Dict]:
        """向量检索 - OceanBase HNSW"""
        # 1. 生成查询向量
        # 2. 执行 HNSW 检索
        pass

    async def _graph_search(self, query: str, limit: int) -> List[Dict]:
        """图谱检索 - Neo4j Cypher"""
        # 执行 Cypher 查询
        pass
```

### 4.6 阶段二验收清单

| 检查项                  | 状态 | 验收日期 |
| ----------------------- | ---- | -------- |
| Neo4j 服务正常          | ☐    |          |
| Neo4j Schema 创建完成   | ☐    |          |
| Cognee 初始化成功       | ☐    |          |
| cognee.add 功能正常     | ☐    |          |
| cognee.cognify 功能正常 | ☐    |          |
| 实体抽取功能可用        | ☐    |          |
| 知识图谱数据可查询      | ☐    |          |
| 关键词检索可用          | ☐    |          |
| 向量检索可用            | ☐    |          |
| 图谱检索可用            | ☐    |          |
| RRF 混合检索可用        | ☐    |          |
| 测试覆盖率 > 85%        | ☐    |          |

---

## 5. 阶段三：认知增强

> **时间**：2026-04 ~ 2026-06  
> **目标**：实现多跳推理问答、建立 RAGAS 评估体系、Agent 记忆持久化

### 5.1 任务分解

```mermaid
flowchart TD
    subgraph "Phase 3 任务分解"
        T1[3.1 多跳推理问答]
        T2[3.2 RAGAS 评估体系]
        T3[3.3 Agent 记忆持久化]
        T4[3.4 图谱可视化]
    end

    T1 --> T2
    T2 --> T3
    T1 --> T4

    style T1 fill:#4285f4,color:#fff
    style T2 fill:#34a853,color:#fff
    style T3 fill:#ea4335,color:#fff
    style T4 fill:#9c27b0,color:#fff
```

### 5.2 任务 3.1：多跳推理问答

**目标**：实现基于 Agentic RAG 的复杂问题推理

#### 5.2.1 Agentic RAG 架构

```mermaid
flowchart TB
    Q[用户查询] --> Router{智能路由}

    Router -->|内容检索| OB[(OceanBase 向量)]
    Router -->|关系探索| Neo[(Neo4j 图谱)]
    Router -->|最新信息| Web[Web 搜索]

    OB & Neo & Web --> Grader[相关性评估]
    Grader -->|低质量| Router
    Grader -->|高质量| Generator[LLM 生成]

    Generator --> Reflector[自我反思]
    Reflector -->|需修正| Generator
    Reflector -->|通过| Response[最终回答]

    style Router fill:#fbbc04,color:#000
    style Grader fill:#ea4335,color:#fff
    style Reflector fill:#9c27b0,color:#fff
```

#### 5.2.2 多步推理实现

```python
# cognizes/agents/claude/reasoning_agent.py
from typing import List, Dict
from enum import Enum

class ReasoningStep(Enum):
    DECOMPOSE = "decompose"    # 分解问题
    RETRIEVE = "retrieve"      # 检索信息
    REASON = "reason"          # 推理分析
    SYNTHESIZE = "synthesize"  # 综合回答
    REFLECT = "reflect"        # 反思验证

class MultiHopReasoningAgent:
    """多跳推理 Agent"""

    async def answer(self, query: str) -> Dict:
        """执行多跳推理回答问题"""

        # Step 1: 分解复杂问题
        sub_questions = await self._decompose(query)

        # Step 2: 逐个回答子问题
        sub_answers = []
        for sq in sub_questions:
            # 检索相关内容
            context = await self._retrieve(sq)
            # 生成子答案
            answer = await self._reason(sq, context)
            sub_answers.append({"question": sq, "answer": answer})

        # Step 3: 综合最终答案
        final_answer = await self._synthesize(query, sub_answers)

        # Step 4: 自我反思与验证
        reflection = await self._reflect(query, final_answer)

        if reflection["needs_revision"]:
            final_answer = await self._revise(final_answer, reflection)

        return {
            "query": query,
            "sub_questions": sub_questions,
            "sub_answers": sub_answers,
            "answer": final_answer,
            "confidence": reflection["confidence"],
            "sources": self._collect_sources(sub_answers)
        }
```

#### 5.2.3 验收标准

| 验收项       | 标准                   | 验证方式   |
| ------------ | ---------------------- | ---------- |
| 问题分解准确 | 子问题覆盖完整         | 人工评估   |
| 多跳检索有效 | 能发现间接关联         | 案例测试   |
| 回答质量     | Answer Relevancy > 90% | RAGAS 评估 |
| 推理可解释   | 包含推理过程           | 输出检查   |

### 5.3 任务 3.2：RAGAS 评估体系

**目标**：建立基于 RAGAS 的检索与生成质量评估体系

#### 5.3.1 评估指标

| 指标                  | 说明                       | 目标值 |
| --------------------- | -------------------------- | ------ |
| **Faithfulness**      | 生成内容与检索上下文一致性 | > 85%  |
| **Answer Relevancy**  | 答案与问题相关性           | > 90%  |
| **Context Precision** | 检索上下文信噪比           | > 80%  |
| **Context Recall**    | 相关信息召回率             | > 85%  |

#### 5.3.2 评估实现

```python
# cognizes/core/evaluation.py
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
)
from datasets import Dataset

class RAGASEvaluator:
    """RAGAS 评估器"""

    def __init__(self):
        self.metrics = [
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall
        ]

    async def evaluate(self, test_cases: List[Dict]) -> Dict:
        """评估 RAG 系统质量"""

        # 构建数据集
        dataset = Dataset.from_dict({
            "question": [tc["question"] for tc in test_cases],
            "answer": [tc["answer"] for tc in test_cases],
            "contexts": [tc["contexts"] for tc in test_cases],
            "ground_truth": [tc.get("ground_truth", "") for tc in test_cases]
        })

        # 执行评估
        results = evaluate(dataset, metrics=self.metrics)

        return {
            "faithfulness": results["faithfulness"],
            "answer_relevancy": results["answer_relevancy"],
            "context_precision": results["context_precision"],
            "context_recall": results["context_recall"],
            "overall_score": sum(results.values()) / len(results)
        }
```

#### 5.3.3 验收标准

| 验收项       | 标准                | 验证方式 |
| ------------ | ------------------- | -------- |
| 评估管道运行 | 无报错完成评估      | 功能测试 |
| 评估数据集   | 至少 100 条测试用例 | 数据检查 |
| 指标达标     | 四项指标全部达标    | 评估运行 |

### 5.4 任务 3.3：Agent 记忆持久化

**目标**：实现 Agent 跨会话记忆持久化

#### 5.4.1 记忆类型

| 类型     | 存储位置  | 保留周期 | 用途               |
| -------- | --------- | -------- | ------------------ |
| 短期记忆 | 内存      | 会话内   | 当前对话上下文     |
| 长期记忆 | OceanBase | 永久     | 用户偏好、历史交互 |
| 情景记忆 | Neo4j     | 永久     | 处理历史、决策轨迹 |
| 语义记忆 | Cognee    | 永久     | 知识图谱、实体关系 |

#### 5.4.2 记忆管理器

```python
# cognizes/core/memory_manager.py
from typing import Dict, Any, Optional

class MemoryManager:
    """Agent 记忆管理器"""

    def __init__(self, user_id: str, session_id: str):
        self.user_id = user_id
        self.session_id = session_id
        self.short_term = []  # 短期记忆（内存）

    async def remember(self, content: str, memory_type: str = "short") -> None:
        """存储记忆"""
        if memory_type == "short":
            self.short_term.append({
                "content": content,
                "timestamp": datetime.now().isoformat()
            })
        elif memory_type == "long":
            await self._store_long_term(content)
        elif memory_type == "episodic":
            await self._store_episodic(content)

    async def recall(self, query: str, memory_type: str = "all") -> List[Dict]:
        """检索相关记忆"""
        results = []

        if memory_type in ["short", "all"]:
            results.extend(self._search_short_term(query))
        if memory_type in ["long", "all"]:
            results.extend(await self._search_long_term(query))
        if memory_type in ["episodic", "all"]:
            results.extend(await self._search_episodic(query))

        return results

    async def consolidate(self) -> None:
        """记忆固化：将短期记忆转移到长期记忆"""
        for memory in self.short_term:
            await self._store_long_term(memory["content"])
        self.short_term.clear()
```

#### 5.4.3 验收标准

| 验收项       | 标准             | 验证方式   |
| ------------ | ---------------- | ---------- |
| 短期记忆有效 | 会话内上下文保持 | 会话测试   |
| 长期记忆持久 | 重启后记忆保留   | 持久化测试 |
| 记忆检索准确 | 相关记忆正确召回 | 检索测试   |

### 5.5 任务 3.4：图谱可视化

**目标**：实现知识图谱的交互式可视化

#### 5.5.1 技术选型

| 技术            | 用途         | 特点           |
| --------------- | ------------ | -------------- |
| **vis-network** | 图可视化组件 | 轻量、易集成   |
| **D3.js**       | 备选方案     | 功能强大、复杂 |
| **Cytoscape**   | 备选方案     | 专业图可视化   |

#### 5.5.2 可视化 API

```python
# cognizes/api/routes/graph.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/graph", tags=["graph"])

@router.get("/")
async def get_graph_data(
    center_id: Optional[str] = None,
    depth: int = 2,
    limit: int = 100
):
    """获取图谱数据用于可视化"""

    if center_id:
        # 以某节点为中心展开
        query = """
        MATCH path = (center)-[*1..{depth}]-(related)
        WHERE center.id = $center_id
        RETURN path LIMIT $limit
        """
    else:
        # 获取全局概览
        query = """
        MATCH (n) OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m LIMIT $limit
        """

    # 执行查询并格式化为 vis-network 格式
    return {
        "nodes": [...],
        "edges": [...]
    }
```

#### 5.5.3 前端组件

```typescript
// ui/src/components/KnowledgeGraph.tsx
"use client";
import { useEffect, useRef } from "react";
import { Network } from "vis-network";

interface GraphProps {
  centerId?: string;
  depth?: number;
}

export function KnowledgeGraph({ centerId, depth = 2 }: GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAndRender = async () => {
      const response = await fetch(
        `/api/v1/graph?center_id=${centerId}&depth=${depth}`
      );
      const data = await response.json();

      if (containerRef.current) {
        new Network(containerRef.current, data, {
          nodes: {
            shape: "dot",
            scaling: { min: 10, max: 30 },
          },
          edges: {
            arrows: "to",
            smooth: { type: "curvedCW" },
          },
          physics: {
            stabilization: { iterations: 100 },
          },
        });
      }
    };

    fetchAndRender();
  }, [centerId, depth]);

  return <div ref={containerRef} className="w-full h-[600px]" />;
}
```

#### 5.5.4 验收标准

| 验收项       | 标准                 | 验证方式 |
| ------------ | -------------------- | -------- |
| 图谱渲染正确 | 节点和边正确显示     | 视觉测试 |
| 交互功能     | 支持缩放、拖拽、点击 | 功能测试 |
| 性能表现     | 1000 节点渲染 < 3s   | 性能测试 |

### 5.6 任务 3.5：Solutions Architect Agent

**目标**：实现场景化方案定制 Agent，根据用户业务场景输出技术方案

> **参考**：[PRD §4.3 Solutions Architect](./000-prd-architecture.md)

#### 5.6.1 Agent 职责

| 职责         | 描述                         |
| ------------ | ---------------------------- |
| **需求分析** | 解析用户业务场景与技术约束   |
| **方案检索** | 从知识图谱检索相关技术方案   |
| **架构设计** | 综合分析后输出架构建议       |
| **输出生成** | 生成 Markdown 格式的方案文档 |

#### 5.6.2 实现步骤

**Step 1：定义 Agent 结构**

```python
# cognizes/agents/adk/solutions_architect.py
from google.adk.agents import LlmAgent
from .tools.oceanbase_search import semantic_search
from .tools.neo4j_query import graph_query

def create_solutions_architect_agent() -> LlmAgent:
    """创建 Solutions Architect Agent"""
    return LlmAgent(
        model="gemini-2.0-flash",
        name="solutions_architect",
        description="业务场景分析与技术方案设计",
        instruction="""你是一个资深的解决方案架构师。

分析流程：
1. 理解用户业务场景和技术约束
2. 使用搜索工具检索相关技术方案和最佳实践
3. 综合分析适用性、优缺点和实施难度
4. 输出结构化的架构设计方案

输出格式：
## 1. 需求理解
## 2. 技术选型对比
## 3. 推荐架构
## 4. 实施路径
## 5. 风险与缓解""",
        tools=[semantic_search, graph_query]
    )
```

**Step 2：注册到 Coordinator**

```python
# cognizes/agents/adk/coordinator.py
from .solutions_architect import create_solutions_architect_agent

# 在 create_content_pipeline 中添加可选的 Solutions Architect 分支
solutions_agent = create_solutions_architect_agent()
```

**Step 3：API 端点**

```python
# cognizes/api/routes/architect.py
@router.post("/api/v1/architect")
async def generate_solution(request: ArchitectRequest):
    """生成技术方案"""
    agent = create_solutions_architect_agent()
    result = await agent.run(request.scenario)
    return {"solution": result}
```

#### 5.6.3 验收标准

| 验收项     | 标准                   | 验证方式 |
| ---------- | ---------------------- | -------- |
| Agent 响应 | 生成结构化方案文档     | 功能测试 |
| 方案相关性 | 方案与场景匹配度 > 80% | 人工评估 |
| 响应时间   | < 30s（含检索）        | 性能测试 |

### 5.7 任务 3.6：BettaFish ForumEngine（可选）

**目标**：实现 Agent 论坛协作机制，通过多 Agent 辩论提升输出质量

> **参考**：[BettaFish 调研报告](./research/006-bettafish.md)

#### 5.7.1 论坛机制概述

```mermaid
flowchart TB
    subgraph "ForumEngine 架构"
        Q[用户查询] --> Host[主持人 LLM]

        Host --> A1[Agent 1: 赞成派]
        Host --> A2[Agent 2: 质疑派]
        Host --> A3[Agent 3: 补充派]

        A1 --> D{辩论轮次}
        A2 --> D
        A3 --> D

        D -->|未达共识| Host
        D -->|达成共识| Synthesizer[综合器]

        Synthesizer --> Response[最终回答]
    end

    style Host fill:#4285f4,color:#fff
    style Synthesizer fill:#34a853,color:#fff
```

#### 5.7.2 实现步骤

**Step 1：定义 Forum Engine**

```python
# cognizes/agents/adk/forum_engine.py
from google.adk.agents import LlmAgent, LoopAgent
from typing import List, Dict

class ForumEngine:
    """Agent 论坛协作引擎"""

    def __init__(self, max_rounds: int = 3):
        self.max_rounds = max_rounds
        self.host = self._create_host()
        self.participants = self._create_participants()

    def _create_host(self) -> LlmAgent:
        """创建主持人 Agent"""
        return LlmAgent(
            model="gemini-2.0-flash",
            name="forum_host",
            instruction="""你是论坛主持人，负责：
            1. 向各参与者分发讨论议题
            2. 收集各方观点
            3. 引导讨论向共识方向发展
            4. 判断是否达成共识"""
        )

    def _create_participants(self) -> List[LlmAgent]:
        """创建参与者 Agent"""
        perspectives = [
            ("advocate", "你负责支持主流观点，强调优势"),
            ("skeptic", "你负责质疑和挑战，指出潜在问题"),
            ("synthesizer", "你负责综合各方观点，寻找平衡")
        ]

        return [
            LlmAgent(
                model="gemini-2.0-flash",
                name=name,
                instruction=prompt
            )
            for name, prompt in perspectives
        ]

    async def discuss(self, topic: str) -> Dict:
        """执行论坛讨论"""
        discussion_log = []

        for round_num in range(self.max_rounds):
            # 主持人分发议题
            host_prompt = await self.host.run(topic)

            # 各参与者发言
            responses = []
            for participant in self.participants:
                response = await participant.run(host_prompt)
                responses.append({
                    "agent": participant.name,
                    "response": response
                })

            discussion_log.append({
                "round": round_num + 1,
                "responses": responses
            })

            # 检查共识
            if await self._check_consensus(responses):
                break

        # 综合最终结论
        return await self._synthesize(discussion_log)
```

**Step 2：集成到高级问答**

```python
# cognizes/api/routes/forum.py
@router.post("/api/v1/forum/discuss")
async def forum_discussion(request: ForumRequest):
    """论坛式深度讨论"""
    engine = ForumEngine(max_rounds=request.max_rounds or 3)
    result = await engine.discuss(request.topic)
    return result
```

#### 5.7.3 验收标准

| 验收项   | 标准                         | 验证方式 |
| -------- | ---------------------------- | -------- |
| 多轮讨论 | 支持 3 轮以上辩论            | 功能测试 |
| 共识达成 | 论坛能收敛到结论             | 逻辑测试 |
| 输出质量 | 论坛输出 > 单 Agent 输出质量 | A/B 测试 |

#### 5.7.4 优先级说明

> [!NOTE]
>
> 此任务为**可选增强功能**，建议在 Phase 3 核心任务完成后再实施。
>
> **推荐顺序**：多跳推理 → RAGAS 评估 → 记忆持久化 → 图谱可视化 → Solutions Architect → ForumEngine

### 5.8 阶段三验收清单

| 检查项                   | 状态 | 验收日期 |
| ------------------------ | ---- | -------- |
| 多跳推理问答可用         | ☐    |          |
| 问题分解功能正常         | ☐    |          |
| 自我反思机制有效         | ☐    |          |
| RAGAS 评估管道运行       | ☐    |          |
| Faithfulness > 85%       | ☐    |          |
| Answer Relevancy > 90%   | ☐    |          |
| Context Precision > 80%  | ☐    |          |
| Context Recall > 85%     | ☐    |          |
| 短期记忆功能正常         | ☐    |          |
| 长期记忆持久化           | ☐    |          |
| 记忆检索准确             | ☐    |          |
| 图谱可视化页面可用       | ☐    |          |
| Solutions Architect 可用 | ☐    |          |
| ForumEngine 可用（可选） | ☐    |          |
| 测试覆盖率 > 90%         | ☐    |          |

---

## 6. 阶段四：生态完善

> **时间**：2026-06 ~ 2026-08  
> **目标**：完善用户系统、个性化推荐、API 开放平台

### 6.1 任务分解

```mermaid
flowchart TD
    subgraph "Phase 4 任务分解"
        T1[4.1 用户认证系统]
        T2[4.2 个性化推荐]
        T3[4.3 API 开放平台]
        T4[4.4 移动端适配]
    end

    T1 --> T2
    T1 --> T3
    T2 --> T4

    style T1 fill:#4285f4,color:#fff
    style T2 fill:#34a853,color:#fff
    style T3 fill:#ea4335,color:#fff
    style T4 fill:#9c27b0,color:#fff
```

### 6.2 任务 4.1：用户认证系统

**目标**：实现用户注册、登录、权限管理

#### 6.2.1 认证方案

| 特性       | 方案                   |
| ---------- | ---------------------- |
| 认证方式   | JWT + OAuth2           |
| 密码存储   | bcrypt + salt          |
| Token 刷新 | Refresh Token 机制     |
| 第三方登录 | GitHub、Google（可选） |

#### 6.2.2 数据模型

```sql
-- 用户表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    avatar_url VARCHAR(500),
    role ENUM('user', 'admin') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户收藏
CREATE TABLE user_favorites (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (source_id) REFERENCES sources(id),
    UNIQUE KEY unique_favorite (user_id, source_id)
);

-- 用户阅读历史
CREATE TABLE user_reading_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_progress FLOAT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (source_id) REFERENCES sources(id)
);
```

#### 6.2.3 验收标准

| 验收项     | 标准                   | 验证方式 |
| ---------- | ---------------------- | -------- |
| 注册功能   | 邮箱验证、密码强度检查 | 功能测试 |
| 登录功能   | JWT 签发正确           | 功能测试 |
| Token 刷新 | 过期自动刷新           | 边界测试 |
| 权限控制   | 未授权访问返回 401     | 安全测试 |

### 6.3 任务 4.2：个性化推荐

**目标**：基于用户行为的个性化内容推荐

#### 6.3.1 推荐策略

| 策略     | 描述            | 数据来源        |
| -------- | --------------- | --------------- |
| 协同过滤 | 相似用户喜好    | 用户行为数据    |
| 内容推荐 | 相似内容关联    | 内容向量 + 图谱 |
| 热门推荐 | 高阅读/收藏内容 | 全局统计        |
| 趋势推荐 | 近期热门        | 时间衰减统计    |

#### 6.3.2 验收标准

| 验收项     | 标准               | 验证方式   |
| ---------- | ------------------ | ---------- |
| 推荐生成   | 新用户也能获得推荐 | 冷启动测试 |
| 推荐相关性 | 用户满意度 > 70%   | 用户调研   |
| 响应时间   | < 500ms            | 性能测试   |

### 6.4 任务 4.3：API 开放平台

**目标**：提供开放 API 供第三方调用

#### 6.4.1 API 设计

| API               | 功能      | 认证方式 |
| ----------------- | --------- | -------- |
| `/api/v1/sources` | 内容 CRUD | API Key  |
| `/api/v1/search`  | 语义搜索  | API Key  |
| `/api/v1/graph`   | 图谱查询  | API Key  |
| `/api/v1/chat`    | 对话接口  | API Key  |

#### 6.4.2 速率限制

| 套餐  | 请求限制      | 价格    |
| ----- | ------------- | ------- |
| Free  | 100 次/天     | 免费    |
| Basic | 10,000 次/天  | ¥99/月  |
| Pro   | 100,000 次/天 | ¥499/月 |

#### 6.4.3 验收标准

| 验收项       | 标准               | 验证方式 |
| ------------ | ------------------ | -------- |
| API 文档     | Swagger 完整可用   | 文档检查 |
| API Key 管理 | 创建、撤销功能正常 | 功能测试 |
| 速率限制     | 超限返回 429       | 压力测试 |
| 使用统计     | 调用量统计准确     | 数据验证 |

### 6.5 任务 4.4：移动端适配

**目标**：Web 端完全适配移动设备

#### 6.5.1 适配要点

| 要点       | 实现方式                 |
| ---------- | ------------------------ |
| 响应式布局 | TailwindCSS 断点         |
| 触摸优化   | 加大点击区域             |
| 性能优化   | 图片懒加载、分页加载     |
| PWA        | Service Worker、离线支持 |

#### 6.5.2 验收标准

| 验收项          | 标准           | 验证方式 |
| --------------- | -------------- | -------- |
| 移动端可用      | 核心功能正常   | 设备测试 |
| Lighthouse 评分 | Mobile > 80    | 性能测试 |
| 离线支持        | 缓存页面可访问 | 功能测试 |

### 6.6 阶段四验收清单

| 检查项               | 状态 | 验收日期 |
| -------------------- | ---- | -------- |
| 用户注册登录正常     | ☐    |          |
| JWT 认证正确         | ☐    |          |
| 用户收藏功能可用     | ☐    |          |
| 个性化推荐有效       | ☐    |          |
| API 文档完整         | ☐    |          |
| API Key 管理功能正常 | ☐    |          |
| 速率限制生效         | ☐    |          |
| 移动端完全适配       | ☐    |          |
| PWA 离线支持         | ☐    |          |
| 全平台测试通过       | ☐    |          |

---

## 7. 验证与质量保障

### 7.1 测试策略

```mermaid
graph TB
    subgraph "测试金字塔"
        E2E[E2E 测试<br/>Playwright]
        INT[集成测试<br/>API + DB]
        UNIT[单元测试<br/>Pytest + Vitest]
    end

    UNIT --> INT
    INT --> E2E

    style UNIT fill:#4caf50,color:#fff
    style INT fill:#2196f3,color:#fff
    style E2E fill:#ff9800,color:#fff
```

### 7.2 测试覆盖目标

| 阶段    | 单元测试 | 集成测试 | E2E 测试 | 总覆盖率 |
| ------- | -------- | -------- | -------- | -------- |
| Phase 1 | 70%      | 60%      | 50%      | > 80%    |
| Phase 2 | 75%      | 65%      | 55%      | > 85%    |
| Phase 3 | 80%      | 70%      | 60%      | > 90%    |
| Phase 4 | 85%      | 75%      | 65%      | > 90%    |

### 7.3 测试命令参考

```bash
# 后端单元测试
cd cognizes && pytest tests/unit -v --cov=.

# 后端集成测试
cd cognizes && pytest tests/integration -v

# 前端单元测试
cd ui && npm run test

# E2E 测试
cd ui && npx playwright test

# 全量测试
npm run test:all
```

### 7.4 质量指标监控

| 指标类别 | 指标             | 目标值     | 监控方式   |
| -------- | ---------------- | ---------- | ---------- |
| **代码** | 测试覆盖率       | > 90%      | CI 报告    |
|          | Lint 错误        | 0          | Pre-commit |
|          | 安全漏洞         | 0 Critical | Dependabot |
| **性能** | API P95 响应时间 | < 500ms    | APM        |
|          | 向量检索延迟     | < 100ms    | 日志分析   |
|          | 页面首屏加载     | < 2s       | Lighthouse |
| **RAG**  | Faithfulness     | > 85%      | RAGAS      |
|          | Answer Relevancy | > 90%      | RAGAS      |

### 7.5 CI/CD 流水线

```mermaid
flowchart LR
    subgraph "CI 流水线"
        C[代码提交] --> L[Lint 检查]
        L --> U[单元测试]
        U --> I[集成测试]
        I --> E[E2E 测试]
        E --> B[构建镜像]
    end

    subgraph "CD 流水线"
        B --> S[部署 Staging]
        S --> V[验收测试]
        V --> P[部署 Production]
    end
```

### 7.6 RAGAS 评估数据集

**数据集来源与构建方法**：

| 数据集类型     | 来源            | 数量 | 构建方法                      |
| -------------- | --------------- | ---- | ----------------------------- |
| **自建问答对** | 已有论文库      | 100+ | 从翻译/分析结果中抽取典型问答 |
| **标准测试集** | MS MARCO / NQ   | 500+ | 开源数据集子集                |
| **领域专属**   | Agentic AI 论文 | 50+  | 人工标注 Ground Truth         |

**数据集格式要求**：

```json
{
  "question": "Agentic RAG 的核心组件有哪些？",
  "answer": "系统生成的答案",
  "contexts": ["检索到的上下文片段 1", "检索到的上下文片段 2"],
  "ground_truth": "Agentic RAG 的核心组件包括：1) 智能路由器..."
}
```

**评估脚本实现**：

```python
# cognizes/evaluation/ragas_eval.py
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from datasets import Dataset

async def run_ragas_evaluation(test_data: List[Dict]) -> Dict:
    """执行 RAGAS 评估"""

    # 构建评估数据集
    dataset = Dataset.from_list(test_data)

    # 运行评估
    results = evaluate(
        dataset=dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall
        ]
    )

    return {
        "faithfulness": results["faithfulness"],
        "answer_relevancy": results["answer_relevancy"],
        "context_precision": results["context_precision"],
        "context_recall": results["context_recall"],
        "passed": all([
            results["faithfulness"] > 0.85,
            results["answer_relevancy"] > 0.90,
            results["context_precision"] > 0.80,
            results["context_recall"] > 0.85
        ])
    }
```

### 7.7 E2E 测试场景清单

**核心功能场景**：

| 场景编号 | 场景名称 | 测试步骤                                    | 预期结果               |
| -------- | -------- | ------------------------------------------- | ---------------------- |
| E2E-001  | 论文上传 | 1. 上传 PDF → 2. 等待处理 → 3. 检查状态     | 状态变为 `analyzed`    |
| E2E-002  | 语义搜索 | 1. 输入查询 → 2. 执行检索 → 3. 验证结果     | 返回相关论文，排序合理 |
| E2E-003  | 翻译流程 | 1. 选择论文 → 2. 触发翻译 → 3. 检查输出     | 术语保留 + 结构完整    |
| E2E-004  | 深度分析 | 1. 选择论文 → 2. 触发分析 → 3. 检查报告     | 生成结构化分析报告     |
| E2E-005  | 知识图谱 | 1. 打开图谱页面 → 2. 点击节点 → 3. 展开关系 | 正确显示节点和关系     |

**高级功能场景**（Phase 3+）：

| 场景编号 | 场景名称   | 测试步骤                                        | 预期结果       |
| -------- | ---------- | ----------------------------------------------- | -------------- |
| E2E-101  | 多跳问答   | 1. 提问复杂问题 → 2. 观察推理过程 → 3. 验证答案 | 正确的多步推理 |
| E2E-102  | 跨会话记忆 | 1. 第一次会话 → 2. 关闭 → 3. 新会话引用历史     | 记忆正确召回   |
| E2E-103  | 方案生成   | 1. 描述业务场景 → 2. 请求方案 → 3. 检查输出     | 生成结构化方案 |

**Playwright 测试示例**：

```typescript
// ui/tests/e2e/upload.spec.ts
import { test, expect } from "@playwright/test";

test("E2E-001 论文上传", async ({ page }) => {
  // 1. 导航到上传页面
  await page.goto("/upload");

  // 2. 上传 PDF 文件
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("tests/fixtures/sample.pdf");

  // 3. 提交
  await page.click('button[type="submit"]');

  // 4. 等待处理完成
  await expect(page.locator('[data-testid="status"]')).toHaveText("analyzed", {
    timeout: 60000,
  });
});
```

### 7.8 性能测试基准

**基准环境配置**：

| 组件           | 配置                   | 说明              |
| -------------- | ---------------------- | ----------------- |
| **应用服务器** | 4 vCPU, 8GB RAM        | Docker 容器       |
| **OceanBase**  | 8 vCPU, 16GB RAM       | 单节点开发模式    |
| **Neo4j**      | 4 vCPU, 8GB RAM        | Community Edition |
| **数据规模**   | 1000 篇论文, 100K 向量 | 预置测试数据      |

**性能指标目标**：

| 接口/功能              | 指标     | 目标值  | 测试工具         |
| ---------------------- | -------- | ------- | ---------------- |
| `/api/v1/sources` POST | 响应时间 | < 200ms | k6               |
| `/api/v1/search` POST  | P95 延迟 | < 500ms | k6               |
| 向量检索               | 单次查询 | < 100ms | pytest-benchmark |
| 图谱遍历 (2 跳)        | 单次查询 | < 200ms | pytest-benchmark |
| 混合检索 (三路)        | 端到端   | < 1s    | k6               |
| 页面首屏               | LCP      | < 2s    | Lighthouse       |

**负载测试脚本**：

```javascript
// tests/performance/search.k6.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 10 }, // 预热
    { duration: "3m", target: 50 }, // 正常负载
    { duration: "1m", target: 100 }, // 峰值负载
    { duration: "1m", target: 0 }, // 冷却
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const payload = JSON.stringify({
    query: "Agentic RAG 的核心组件",
    limit: 10,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  const res = http.post("http://localhost:8000/api/v1/search", payload, params);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### 7.9 翻译质量评估

**BLEU 评估配置**：

| 配置项       | 值           | 说明                       |
| ------------ | ------------ | -------------------------- |
| **评估工具** | sacrebleu    | 标准 BLEU 计算库           |
| **参考数据** | 人工翻译样本 | 30+ 篇论文摘要的高质量翻译 |
| **分词方式** | jieba (中文) | 中文分词后计算             |
| **目标分数** | BLEU > 0.7   | 学术翻译质量标准           |

**评估脚本**：

```python
# cognizes/evaluation/bleu_eval.py
import sacrebleu
import jieba

def evaluate_translation_quality(
    hypotheses: List[str],  # 系统翻译
    references: List[List[str]]  # 参考翻译（可多个）
) -> Dict:
    """评估翻译质量"""

    # 中文分词
    hyps_tokenized = [' '.join(jieba.cut(h)) for h in hypotheses]
    refs_tokenized = [
        [' '.join(jieba.cut(r)) for r in ref_set]
        for ref_set in references
    ]

    # 计算 BLEU
    bleu = sacrebleu.corpus_bleu(
        hyps_tokenized,
        refs_tokenized,
        tokenize='zh'
    )

    return {
        "bleu_score": bleu.score / 100,  # 归一化到 0-1
        "passed": bleu.score / 100 > 0.7,
        "details": {
            "brevity_penalty": bleu.bp,
            "precisions": bleu.precisions
        }
    }
```

---

## 8. 风险与依赖管理

### 8.1 技术风险

| 风险                 | 影响 | 概率 | 缓解措施                   |
| -------------------- | ---- | ---- | -------------------------- |
| OceanBase 向量功能   | 高   | 中   | 备选 Milvus/Qdrant         |
| Cognee 兼容性        | 中   | 中   | 自研 GraphRAG 组件         |
| LLM API 限流         | 中   | 高   | 多 Provider 切换、本地缓存 |
| Neo4j 企业版功能限制 | 低   | 中   | 社区版 + 手动实现高级功能  |

### 8.2 项目风险

| 风险         | 影响 | 概率 | 缓解措施                |
| ------------ | ---- | ---- | ----------------------- |
| 开发周期延误 | 高   | 中   | 迭代交付、优先核心功能  |
| 人力资源不足 | 高   | 中   | 自动化工具、AI 辅助开发 |
| 需求变更     | 中   | 高   | 模块化设计、抽象层      |

### 8.3 外部依赖

| 依赖       | 类型      | 版本            | 替代方案              |
| ---------- | --------- | --------------- | --------------------- |
| OceanBase  | 数据库    | V4.5+           | PostgreSQL + pgvector |
| Neo4j      | 图数据库  | 5.x / 2025      | Memgraph              |
| Cognee     | 框架      | latest          | 自研 + LangGraph      |
| Claude API | LLM       | claude-sonnet-4 | GPT-4 / Gemini        |
| OpenAI API | Embedding | v3-small        | 本地模型              |

### 8.4 依赖版本锁定

```toml
# pyproject.toml 关键依赖
[project.dependencies]
fastapi = ">=0.110.0"
pydantic = ">=2.6.0"
google-adk = ">=1.0.0"
anthropic = ">=0.40.0"
openai = ">=1.40.0"
cognee = ">=0.1.17"
neo4j = ">=5.26.0"
sqlalchemy = ">=2.0.0"
ragas = ">=0.1.0"
pymysql = ">=1.1.0"
httpx = ">=0.27.0"
vis-network = ">=9.1.0"
```

---

## 9. 附录

### 9.1 术语表

| 术语                    | 定义                                               |
| ----------------------- | -------------------------------------------------- |
| **Agentic RAG**         | Agent 驱动的检索增强生成，支持自适应、纠错、自反思 |
| **GraphRAG**            | 结合知识图谱的 RAG 技术                            |
| **Cognee**              | AI 认知记忆层框架，三存储架构                      |
| **HNSW**                | 分层可导航小世界图，近似最近邻搜索算法             |
| **RRF**                 | 倒数排名融合，多路检索结果融合算法                 |
| **RAGAS**               | RAG 评估框架，四项核心指标                         |
| **Context Engineering** | 系统性上下文管理方法论                             |

### 9.2 参考文档

| 文档                | 路径                                         |
| ------------------- | -------------------------------------------- |
| PRD & Architecture  | `docs/000-prd-architecture.md`               |
| 认知增强调研        | `docs/research/000-cognitive-enhancement.md` |
| Context Engineering | `docs/research/001-context-engineering.md`   |
| Agent Frameworks    | `docs/research/002-agent-frameworks.md`      |
| Cognee 调研         | `docs/research/003-cognee.md`                |
| OceanBase 调研      | `docs/research/004-oceanbase.md`             |
| Neo4j 调研          | `docs/research/005-neo4j.md`                 |
| BettaFish 调研      | `docs/research/006-bettafish.md`             |

### 9.3 环境配置模板

```bash
# .env.template
# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Embedding Configuration
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# Cognee Configuration
COGNEE_LLM_PROVIDER=anthropic
COGNEE_LLM_MODEL=claude-sonnet-4-20250514

# Database Configuration
OCEANBASE_HOST=localhost
OCEANBASE_PORT=2881
OCEANBASE_USER=root
OCEANBASE_PASSWORD=
OCEANBASE_DATABASE=cognizes

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Application Configuration
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000
```

### 9.4 启动命令

```bash
# 开发环境启动
# 1. 启动数据库
docker compose up -d oceanbase neo4j

# 2. 启动后端
cd cognizes && uvicorn api.main:app --reload --port 8000

# 3. 启动前端
cd ui && npm run dev

# 生产环境启动
docker compose -f docker-compose.prod.yml up -d
```
