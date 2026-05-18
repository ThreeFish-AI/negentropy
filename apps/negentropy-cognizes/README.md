---
id: cognizes
sidebar_position: 0
title: Agentic AI Cognizes
last_update:
  author: Aurelius Huang
  created_at: 2025-10-22
  updated_at: 2026-01-22
  version: 1.1
  status: Reviewed
tags:
  - Agentic AI
  - Cognizes
  - Research
---

> [!NOTE]
>
> **开发状态**: 早期 MVP 阶段 · 后端优先 · [📋 查看完整路线图](docs/000-roadmap.md)
>
> 一个专注于 Agentic AI 研究的学术论文收集、翻译、理解、语义检索、应用的智能平台，为中文读者提供高质量的人工智能智能体领域技术资源与服务支持。

## 📊 当前进展

| 模块        | 完成度 | 说明                               |
| ----------- | ------ | ---------------------------------- |
| 🤖 核心后端 | 60%    | 智能体系统 90% + API 后端 95%      |
| 📚 内容建设 | 59%    | 27 篇论文收集，16 篇已翻译         |
| 🏗️ 基础设施 | 35%    | Docker 容器化完成，缺少 UI、数据库 |
| 🖥️ Web 前端 | 0%     | 计划于 Q1 2026 开发                |
| ✅ 测试覆盖 | 82%    | 针对后端代码的测试                 |

### ⚠️ 当前限制

- Web 界面尚未开发（计划 Q1 2026）
- Claude SDK 依赖问题导致 AI 功能暂不可用
- 仅支持文件存储，暂无数据库
- 无用户认证系统

## 🚀 快速开始

### 环境要求

- Python 3.12+
- Docker & Docker Compose（推荐）

### Docker Compose 部署

```bash
# 1. 克隆仓库
git clone https://github.com/ThreeFish-AI/agentic-ai-cognizes.git
cd agentic-ai-cognizes

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加必要的 API Key

# 3. 启动服务
docker-compose up -d

# 4. 访问 API 文档
# http://localhost:8000/docs
```

### 本地开发

```bash
# 1. 安装依赖
pip install -e .

# 2. 启动 API 服务
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# 3. 访问 API 文档
# http://localhost:8000/docs
```

## ✨ 功能特性

### ✅ 已实现

- 📚 **论文收集管理** - 系统性收集和分类 Agentic AI 领域论文
- 🔄 **基础工作流** - 自动化的论文处理流程
- 🖥️ **RESTful API** - 完整的异步 API 接口
- 🧪 **测试覆盖** - 82% 的后端测试覆盖率

### 🚧 开发中

- 🤖 **AI 驱动翻译** - 等待 Claude SDK 依赖解决
- 🔍 **检索功能** - 基于文件系统的搜索实现

### 📋 计划中

- 🌐 Web 用户界面（Q1 2026）
- 🗄️ 数据库支持（PostgreSQL）
- 🔐 用户认证系统
- 📊 高级分析功能

## 🏗️ 系统架构

```mermaid
flowchart TD
    %% 用户交互层
    subgraph UserLayer [用户交互层]
        A[API Client<br/>REST/HTTP]
        B[Web UI<br/>🚧 计划中 Q1 2026]
    end

    %% API 网关层
    subgraph GatewayLayer [API 网关层]
        C[FastAPI 服务<br/>异步网关]
        D[WebSocket<br/>实时更新]
    end

    %% 路由层
    subgraph RouteLayer [API 路由层]
        E[论文管理<br/>/api/papers]
        F[任务管理<br/>/api/tasks]
        G[健康检查<br/>/health]
    end

    %% 服务层
    subgraph ServiceLayer [业务服务层]
        H[论文服务<br/>Paper Service]
        I[任务服务<br/>Task Service]
        J[WebSocket 服务<br/>实时通信]
    end

    %% Agent 智能层
    subgraph AgentLayer [Agent 智能层]
        K[工作流 Agent<br/>WorkflowAgent]
        L[批处理 Agent<br/>BatchAgent]
        M[PDF 处理 Agent<br/>PDFAgent]
        N[翻译 Agent<br/>TranslationAgent]
        O[深度分析 Agent<br/>HeartfeltAgent]
    end

    %% Claude Skills 能力层
    subgraph SkillLayer [Claude Skills - 7个专用能力]
        P[pdf-reader<br/>PDF解析]
        Q[web-translator<br/>网页转换]
        R[zh-translator<br/>中文翻译]
        S[markdown-formatter<br/>格式优化]
        T[doc-translator<br/>文档翻译]
        U[batch-processor<br/>批量处理]
        V[heartfelt<br/>深度分析]
    end

    %% 外部工具层
    subgraph ExternalLayer [外部工具服务]
        W[data-extractor<br/>内容提取]
        X[web-search<br/>网络搜索]
        Y[其他 MCP 服务]
    end

    %% 存储层
    subgraph StorageLayer [文件系统存储]
        Z1[papers/source/<br/>原始文档]
        Z2[papers/translation/<br/>翻译结果]
        Z3[papers/heartfelt/<br/>深度分析]
        Z4[papers/images/<br/>提取图像]
        Z5[logs/<br/>审计日志]
    end

    %% 连接关系
    A --> C
    B -.-> C
    C --> D
    C --> E
    C --> F
    C --> G

    E --> H
    F --> I
    D --> J

    H --> K
    I --> L
    K --> M
    K --> N
    K --> O
    L --> U

    M --> P
    N --> R
    N --> S
    N --> T
    O --> V

    SkillLayer -.-> ExternalLayer

    H --> Z1
    H --> Z2
    H --> Z3
    H --> Z4
    I --> Z5

    %% 样式定义 - 深色主题适配
    classDef userUI fill:#61DAFB,stroke:#2171B5,color:#fff
    classDef api fill:#2196F3,stroke:#1976D2,color:#fff
    classDef service fill:#00BCD4,stroke:#0097A7,color:#fff
    classDef agent fill:#9C27B0,stroke:#7B1FA2,color:#fff
    classDef skill fill:#673AB7,stroke:#512DA8,color:#fff
    classDef tool fill:#FF6F00,stroke:#E65100,color:#fff
    classDef storage fill:#FF9800,stroke:#F57C00,color:#fff
    classDef planned fill:#757575,stroke:#424242,color:#fff,stroke-dasharray: 5 5

    class A,B userUI
    class C,D,E,F,G api
    class H,I,J service
    class K,L,M,N,O agent
    class P,Q,R,S,T,U,V skill
    class W,X,Y tool
    class Z1,Z2,Z3,Z4,Z5 storage
    class B planned
```

**架构说明**：

- **蓝色系**：用户界面和 API 层
- **青色系**：业务服务层
- **紫色系**：Agent 智能层和 Skills 能力层
- **橙色系**：外部工具和存储层
- **灰色虚线**：计划中的组件
- 采用分层架构，职责清晰，易于扩展
- 异步优先设计，支持高并发处理
- 文件系统存储，简化部署和运维

## 📁 项目结构

```shell
agentic-ai-cognizes/
├── 📦 src/cognizes/           # Python 主包 (统一入口)
│   ├── __init__.py            # 包初始化
│   ├── engine/                # 核心引擎
│   ├── adapters/              # 适配器层
│   ├── agents/                # Agent 实现 (claude/adk)
│   ├── api/                   # FastAPI 服务
│   └── examples/              # 示例应用
├── 🌐 ui/                     # Next.js Web UI
├── 🧪 tests/                  # 测试套件
├── 📚 docs/                   # 文档
├── 🎨 assets/                 # 资源文件
│   ├── 📄 papers/             # 论文存储
│   │   ├── source/            # 原始论文
│   │   ├── translation/       # 中文翻译
│   │   └── images/            # 提取的图片
├── 🔧 scripts/                # 脚本工具
├── 📝 pyproject.toml          # Python 项目配置
├── 📝 README.md               # 项目说明
├── 📝 AGENTS.md               # Agent 实现说明
└── 📝 .gitignore              # Git 忽略文件
```

## 📚 文档

- [🗺️ 项目路线](docs/000-roadmap.md) - 项目整体开发计划和进度
- [📖 系统架构](docs/001-architecture.md) - 架构设计和技术栈
- [💻 开发指南](docs/002-development.md) - 开发环境和代码规范
- [👥 用户手册](docs/003-user-guide.md) - 安装部署和使用教程
- [🧪 测试方案](docs/004-testing.md) - 测试框架和 CI/CD
- [🚀 GitHub Actions](docs/005-github-actions.md) - 自动化工作流
- [🤖 AI Agents](docs/006-agents.md) - Claude SDK 与 Google ADK 实现方案
- [📡 API 文档](docs/007-apis.md) - RESTful API 和 WebSocket 详细文档

## 🤝 贡献指南

我们欢迎社区贡献！当前最需要的帮助：

1. **前端开发** - React/TypeScript Web UI 实现
2. **翻译工作** - 新论文的翻译和校对
3. **SDK 集成** - 帮助解决 Claude SDK 依赖问题
4. **测试** - 提高测试覆盖率
5. **文档** - 改进和完善文档

### 如何贡献

1. Fork 项目并创建功能分支
2. 遵循代码规范（见 [开发指南](docs/002-development.md)）
3. 提交 Pull Request

## 📜 许可证

本项目采用 [Apache License 2.0](LICENSE)，所有翻译内容仅供学术研究使用。

## 🔗 相关资源

- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python)
- [Google Agent Development Kit](https://google.github.io/adk-docs/)
- [项目主页](https://threefish.site)

## 📞 联系我们

- 问题反馈: [GitHub Issues](https://github.com/ThreeFish-AI/agentic-ai-cognizes/issues)
- 邮箱: threefish.ai@gmail.com

---

**重要提醒**: 翻译内容仅供学术研究和教育目的使用，引用时请注明原始论文来源。
