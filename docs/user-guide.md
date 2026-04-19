# Negentropy 用户手册

> **Negentropy (熵减引擎)** — 一套基于「一核五翼」架构的智能体系统，致力于将混沌的输入转化为有序、结构化的高价值输出。
>
> 本手册面向**最终用户**与**系统管理员**，覆盖系统概览、快速上手、对话交互、知识库管理、记忆系统、插件扩展、管理后台与 Wiki 发布等全部功能模块。

---

## 阅读路径

| 角色           | 推荐阅读顺序                |
| :------------- | :-------------------------- |
| **首次使用者** | 第 1 章 → 第 2 章 → 第 3 章 |
| **知识管理员** | 第 1 章 → 第 4 章 → 第 5 章 |
| **系统管理员** | 第 1 章 → 第 7 章 → 第 6 章 |
| **全面了解**   | 按章节顺序 1 → 9 逐章阅读   |

---

## 目录

1. [认识 Negentropy](#1-认识-negentropy)
2. [快速上手](#2-快速上手)
3. [对话交互](#3-对话交互)
4. [知识库管理](#4-知识库管理)
5. [记忆系统使用](#5-记忆系统使用)
6. [插件系统使用](#6-插件系统使用)
7. [管理后台](#7-管理后台)
8. [Wiki 知识发布](#8-wiki-知识发布)
9. [常见问题](#9-常见问题)
- [附录 A：术语表](#附录-a术语表)
- [附录 B：环境变量速查表](#附录-b环境变量速查表)
- [附录 C：文档导航](#附录-c文档导航)

---

## 1. 认识 Negentropy

### 1.1 什么是 Negentropy？

Negentropy 的命名源自薛定谔《生命是什么》中的"负熵"概念<sup><a href=#ref1>1</a></sup>——生命以负熵为食。这个系统以同样的哲学对抗知识管理中的**五大熵增形态**：

| 熵增形态 | 表现                                     | 系统对策                            |
| :------- | :--------------------------------------- | :---------------------------------- |
| 信息过载 | Agent 吞噬海量数据，信号与噪音齐飞       | 👁️ **感知系部** — 高信噪比过滤       |
| 记忆断裂 | 对话间的积累被下一个 Session 抛诸脑后    | 💎 **内化系部** — 结构化持久化       |
| 肤浅回应 | Agent 给出教科书式答案，从不追问"为什么" | 🧠 **沉思系部** — 二阶思维与根因分析 |
| 纸上谈兵 | 分析头头是道，需要动手时却力不从心       | ✋ **行动系部** — 精准执行与代码变更 |
| 价值衰减 | 专业洞察经层层传递后可读性暴跌           | 🗣️ **影响系部** — 清晰表达与价值交付 |

### 1.2 一核五翼架构

Negentropy 的核心是一个**调度者**（The Self），它不直接执行任何原子任务，而是将意图委派给最胜任的**系部**（Faculty），如同乐队指挥与演奏家的关系。

```mermaid
graph TB
    subgraph Input["📥 用户输入"]
        Q["用户提问 / 指令"]
    end

    subgraph Core["🔮 调度核心"]
        Engine["NegentropyEngine<br/>The Self · 调度指挥"]
    end

    subgraph Faculties["🎯 五大系部"]
        P["👁️ 感知系部<br/>Perception"]
        I["💎 内化系部<br/>Internalization"]
        C["🧠 沉思系部<br/>Contemplation"]
        A["✋ 行动系部<br/>Action"]
        Inf["🗣️ 影响系部<br/>Influence"]
    end

    subgraph Output["📤 价值输出"]
        R1["结构化知识"]
        R2["可执行方案"]
        R3["清晰洞察"]
    end

    Q --> Engine
    Engine -->|"单一委派<br/>or 流水线编排"| P
    Engine --> I
    Engine --> C
    Engine --> A
    Engine --> Inf

    P --> R1
    I --> R1
    C --> R3
    A --> R2
    Inf --> R3

    classDef core fill:#F59E0B,stroke:#92400E,color:#000
    classDef fac fill:#3B82F6,stroke:#1E3A8A,color:#FFF
    classDef inp fill:#10B981,stroke:#065F46,color:#FFF
    classDef out fill:#8B5CF6,stroke:#5B21B6,color:#FFF

    class Engine core
    class P,I,C,A,Inf fac
    class Q inp
    class R1,R2,R3 out
```

### 1.3 三大标准流水线

对于常见的多步骤任务，系统预置了三条**标准流水线**，免去手动编排的繁琐：

```mermaid
flowchart LR
    subgraph KA["📚 知识获取"]
        direction LR
        P1["👁️ 感知"] --> I1["💎 内化"]
    end

    subgraph PS["🔧 问题解决"]
        direction LR
        P2["👁️ 感知"] --> C2["🧠 沉思"] --> A2["✋ 行动"] --> I2["💎 内化"]
    end

    subgraph VD["📝 价值交付"]
        direction LR
        P3["👁️ 感知"] --> C3["🧠 沉思"] --> Inf3["🗣️ 影响"]
    end

    classDef ka fill:#DBEAFE,stroke:#1E3A8A,color:#000
    classDef ps fill:#FEF3C7,stroke:#92400E,color:#000
    classDef vd fill:#D1FAE5,stroke:#065F46,color:#000

    class P1,I1 ka
    class P2,C2,A2,I2 ps
    class P3,C3,Inf3 vd
```

| 流水线       | 执行路径                  | 适用场景                         |
| :----------- | :------------------------ | :------------------------------- |
| **知识获取** | 感知 → 内化               | 研究新技术、收集需求、构建知识库 |
| **问题解决** | 感知 → 沉思 → 行动 → 内化 | Bug 修复、功能实现、系统优化     |
| **价值交付** | 感知 → 沉思 → 影响        | 撰写文档、生成报告、决策建议     |

> 更深入的架构设计细节，请参阅 [架构设计](./framework.md)。

---

## 2. 快速上手

### 2.1 环境要求

| 依赖                             | 最低版本       | 用途            | 获取方式                                      |
| :------------------------------- | :------------- | :-------------- | :-------------------------------------------- |
| Python                           | 3.13+          | 后端运行时      | [python.org](https://www.python.org/)         |
| [uv](https://docs.astral.sh/uv/) | 最新           | Python 包管理器 | `curl -LsSf https://astral.sh/uv/install.sh   | sh` |
| Node.js                          | 22+            | 前端运行时      | [nodejs.org](https://nodejs.org/)             |
| [pnpm](https://pnpm.io/)         | 最新           | 前端包管理器    | `npm install -g pnpm`                         |
| PostgreSQL                       | 16+ (pgvector) | 数据持久化      | [postgresql.org](https://www.postgresql.org/) |

### 2.2 启动后端服务

```bash
# 1. 克隆仓库
git clone https://github.com/ThreeFish-AI/negentropy.git
cd negentropy

# 2. 进入后端目录
cd apps/negentropy

# 3. 安装依赖
uv sync --dev

# 4. 生成用户级配置文件（首次）
uv run negentropy init    # 写入 ~/.negentropy/config.yaml

# 5. 配置密钥/敏感项（通过 shell 环境变量或 .env.local）
#   export NE_DB_URL=postgresql+asyncpg://user:pass@localhost:5432/negentropy
#   export OPENAI_API_KEY=your-openai-key
#   export ANTHROPIC_API_KEY=your-anthropic-key
# 模型 vendor（OpenAI / Anthropic / Gemini 等）通过 Admin → Model 页动态配置

# 6. 应用数据库迁移
uv run alembic upgrade head

# 7. 启动引擎（开发模式，支持热重载）
uv run adk web --port 8000 --reload_agents src/negentropy
```

> 后端服务启动后可访问 `http://localhost:8000`，API 文档自动生成于 `/docs`。

### 2.3 启动前端界面

```bash
# 在新终端窗口中执行
cd apps/negentropy-ui

# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
pnpm run dev
```

> 前端启动后访问 `http://localhost:3192` 即可进入 Negentropy 主界面。

### 2.4 首次对话

```mermaid
sequenceDiagram
    participant U as 👤 用户
    participant UI as 🖥️ 前端界面
    participant BE as ⚙️ 后端引擎

    U->>UI: 打开 localhost:3192
    UI->>UI: 显示三栏布局<br/>（Session 列表 / 聊天区 / 调试面板）
    U->>UI: 在 Composer 输入框输入消息
    UI->>BE: 自动创建 Session<br/>发送用户消息
    BE->>BE: NegentropyEngine 分析意图<br/>委派系部 / 触发流水线
    BE-->>UI: 流式返回 Agent 响应
    UI->>UI: ChatStream 实时渲染<br/>EventTimeline 更新事件
    U->>UI: 阅读 Agent 回复<br/>查看右侧调试信息
```

打开浏览器访问 `http://localhost:3192`，你会看到三栏布局的对话界面：

- **左侧**：Session 列表（当前为空）
- **中间**：聊天区域 + 底部输入框（Composer）
- **右侧**：调试面板（可点击右上角按钮展开）

在底部输入框中输入你的第一条消息，系统会**自动创建 Session** 并开始与 Agent 对话。

> 详细的环境搭建与故障排查，请参阅 [开发指南](./development.md)。

---

## 3. 对话交互

对话交互是 Negentropy 的核心使用场景。通过与 NegentropyEngine 对话，你可以研究问题、解决问题、生成内容。

### 3.1 界面布局

系统主界面采用**三栏布局**，通过顶部导航栏在各模块间切换。

```mermaid
graph TB
    subgraph Page["🌐 主页面"]
        subgraph Navbar["顶部导航栏"]
            Nav["Home | Knowledge | Memory | Interface | Admin"]
        end

        subgraph Left["左侧面板 (w-64)"]
            SL["SessionList<br/>• New Session<br/>• 会话列表<br/>• 重命名 / 归档"]
        end

        subgraph Center["中央区域"]
            TB["内部工具栏<br/>• 展开/收起侧栏<br/>• 当前会话标题"]
            CS["ChatStream<br/>• 用户消息<br/>• Agent 回复<br/>• 工具调用卡片"]
            CP["Composer<br/>• 文本输入框<br/>• 发送按钮"]
        end

        subgraph Right["右侧面板 (w-80)"]
            VM["视图模式指示<br/>• 实时视图 / 历史视图"]
            SS["StateSnapshot<br/>• Run 状态"]
            ET["EventTimeline<br/>• 事件流"]
            LB["LogBufferPanel<br/>• 结构化日志"]
        end
    end

    classDef nav fill:#6366F1,stroke:#4338CA,color:#FFF
    classDef left fill:#DBEAFE,stroke:#1E3A8A,color:#000
    classDef center fill:#FEF3C7,stroke:#92400E,color:#000
    classDef right fill:#D1FAE5,stroke:#065F46,color:#000

    class Nav nav
    class SL left
    class TB,CS,CP center
    class VM,SS,ET,LB right
```

**顶部导航栏**包含五个模块入口：

| 导航项        | 路径         | 权限     | 功能       |
| :------------ | :----------- | :------- | :--------- |
| **Home**      | `/`          | 所有用户 | Agent 对话 |
| **Knowledge** | `/knowledge` | 所有用户 | 知识库管理 |
| **Memory**    | `/memory`    | 所有用户 | 记忆系统   |
| **Interface** | `/plugins`   | 所有用户 | 插件管理   |
| **Admin**     | `/admin`     | 仅 admin | 管理后台   |

### 3.2 发起对话

1. 在 **Composer** 输入框中输入你的问题或指令
2. 按 **Enter** 或点击发送按钮
3. 系统自动创建 Session，NegentropyEngine 开始处理
4. **ChatStream** 区域实时显示 Agent 的回复
5. 连接状态从 `idle` → `connecting` → `streaming` → `idle` 变化

> 当 Agent 需要执行关键操作前，标题栏会显示 **「等待确认」** 提示（参见 [3.4 HITL 确认](#34-hitl-人机交互确认)）。

### 3.3 Agent 调度行为

NegentropyEngine 接收到用户输入后，会根据意图复杂度选择不同的调度策略：

**单一系部委派**：简单问题直接交给一个系部处理。例如"搜索关于 React 19 的信息"会直接委派给感知系部。

**流水线编排**：多步骤任务自动触发预定义流水线。例如"帮我修复这个 Bug"会走问题解决流水线（感知 → 沉思 → 行动 → 内化）。

**主动导航**：Agent 完成任务后会**主动建议下一步操作**，例如推荐相关搜索、提醒知识沉淀等。

```mermaid
flowchart TD
    Input["📥 用户输入"] --> Engine["🔮 NegentropyEngine"]
    Engine --> Analyze{"意图复杂度评估"}

    Analyze -->|"单一问题"| Single["单一系部委派"]
    Analyze -->|"多步骤任务"| Pipeline{"匹配预定义流水线"}
    Analyze -->|"自定义序列"| Custom["手动编排系部序列"]

    Single --> P1["👁️ 感知"]
    Single --> I1["💎 内化"]
    Single --> C1["🧠 沉思"]
    Single --> A1["✋ 行动"]
    Single --> Inf1["🗣️ 影响"]

    Pipeline -->|"研究类"| KA["知识获取流水线<br/>感知 → 内化"]
    Pipeline -->|"执行类"| PS["问题解决流水线<br/>感知 → 沉思 → 行动 → 内化"]
    Pipeline -->|"表达类"| VD["价值交付流水线<br/>感知 → 沉思 → 影响"]

    P1 --> Output["📤 输出结果"]
    I1 --> Output
    C1 --> Output
    A1 --> Output
    Inf1 --> Output
    KA --> Output
    PS --> Output
    VD --> Output

    Output --> Navigate["🧭 主动导航<br/>建议下一步行动"]
    Navigate --> End["✅ 完成"]

    classDef proc fill:#FEF3C7,stroke:#92400E,color:#000
    classDef pipe fill:#DBEAFE,stroke:#1E3A8A,color:#000
    classDef nav fill:#D1FAE5,stroke:#065F46,color:#000

    class KA,PS,VD pipe
    class Navigate nav
    class Engine,Analyze,Single,Pipeline,Custom,Output,End proc
```

### 3.4 HITL 人机交互确认

当 Agent 准备执行关键操作时，会触发 **HITL (Human-in-the-Loop)** 确认机制，将决策权交还给用户。

**确认卡片**会出现在 ChatStream 中，包含：

| 操作                  | 说明                      |
| :-------------------- | :------------------------ |
| **确认 (Confirm)**    | 同意 Agent 执行当前方案   |
| **修正 (Correct)**    | 修正 Agent 的方案后再执行 |
| **补充 (Supplement)** | 补充额外信息或约束条件    |

确认卡片下方还提供**补充说明文本框**，可在操作时附带备注。提交后状态从「进行中」变为「已反馈」，Agent 收到反馈后继续执行。

```mermaid
sequenceDiagram
    participant U as 👤 用户
    participant Agent as 🤖 NegentropyEngine
    participant Card as 📋 ConfirmationCard

    Agent->>Agent: 准备执行关键操作
    Agent->>Card: 显示确认卡片<br/>（标题 + 详情）
    Card->>U: 等待用户操作

    alt 用户确认
        U->>Card: 点击「确认」
        Card->>Agent: HITL:confirm
        Agent->>Agent: 执行操作
    else 用户修正
        U->>Card: 输入修正内容 → 点击「修正」
        Card->>Agent: HITL:correct {note}
        Agent->>Agent: 根据修正重新规划
    else 用户补充
        U->>Card: 输入补充信息 → 点击「补充」
        Card->>Agent: HITL:supplement {note}
        Agent->>Agent: 结合补充信息继续
    end

    Agent-->>U: 返回执行结果
```

### 3.5 Session 管理

Session 是一次独立对话的容器。通过左侧面板管理所有会话：

| 操作               | 说明                                       |
| :----------------- | :----------------------------------------- |
| **创建新 Session** | 点击 SessionList 顶部的「New Session」按钮 |
| **切换 Session**   | 点击左侧列表中的任意会话                   |
| **重命名 Session** | 右键点击会话或使用重命名操作               |
| **归档 Session**   | 将不活跃的会话归档                         |
| **取消归档**       | 恢复已归档的会话                           |
| **视图切换**       | 在不同列表视图间切换                       |

### 3.6 调试工具

右侧面板提供三套调试工具，帮助用户理解 Agent 的运行过程：

**StateSnapshot（状态快照）**
- 显示当前 Run 的状态信息
- 实时视图中显示最新的快照数据

**EventTimeline（事件时间线）**
- 实时展示 Agent 的事件流，包括文本输出、工具调用、状态变更等
- 每个事件以卡片形式展示，包含名称、参数和结果

**LogBufferPanel（日志面板）**
- 显示结构化日志条目，包含级别（info/warn/error）、时间戳和内容
- 支持**导出到剪贴板**功能
- 最多保留 200 条日志

> **历史视图**：点击 ChatStream 中的任意消息，右侧面板切换到历史视图，显示该消息时刻的观察数据。按 `Esc` 键返回实时视图。

---

## 4. 知识库管理

知识库是 Negentropy 的「外部记忆」，支持文档摄取、语义分块、向量检索与知识图谱，实现知识的全生命周期管理。

### 4.1 模块导航

进入 **Knowledge** 模块后，左侧导航栏提供以下子页面：

| 导航项        | 路径                   | 功能                   |
| :------------ | :--------------------- | :--------------------- |
| **Base**      | `/knowledge/base`      | 语料库管理（核心入口） |
| **Dashboard** | `/knowledge/dashboard` | 知识库仪表盘           |
| **Catalog**   | `/knowledge/catalog`   | 知识目录（树形结构）   |
| **Documents** | `/knowledge/documents` | 全局文档列表           |
| **Graph**     | `/knowledge/graph`     | 知识图谱可视化         |
| **Pipelines** | `/knowledge/pipelines` | Pipeline 监控          |
| **APIs**      | `/knowledge/apis`      | API 文档与测试         |

### 4.2 Dashboard 仪表盘

仪表盘提供知识库的全局概览，采用两栏布局：

- **左侧主区域**：指标卡片网格（Corpus 数量、Knowledge 数量、最后构建时间）+ Pipeline Runs 列表（含分页控制）
- **右侧边栏**：Alerts 告警面板 + Pipeline Run 详情面板

运行中的 Pipeline 会自动轮询刷新状态。

### 4.3 语料库管理 (Base)

Base 是知识库管理的**核心页面**，支持两种视图模式：

#### Overview 模式

以卡片网格展示所有语料库，每张卡片显示：

- 语料库名称和描述
- 文档数量和知识数量
- 状态徽章
- 配置摘要

操作包括：选择进入详情、编辑配置、删除语料库、同步、查看设置。

#### Corpus 详情模式

进入某个语料库后，顶部显示语料库信息和操作按钮（返回、同步、重建、设置），下方通过 **Tab** 切换三个子面板：

| Tab                 | 功能                                                        |
| :------------------ | :---------------------------------------------------------- |
| **Documents**       | 文档列表（搜索、分页）、添加源、上传文档                    |
| **Settings**        | 切分策略配置（Fixed / Recursive / Semantic / Hierarchical） |
| **Document Chunks** | 文档分块列表、查看块详情、编辑块内容                        |

#### 文档摄取

Negentropy 支持三种文档摄取方式：

```mermaid
flowchart LR
    subgraph Ingest["📥 文档摄取"]
        Text["📝 文本摄取<br/>直接粘贴文本"]
        URL["🔗 URL 摄取<br/>抓取网页内容"]
        File["📁 文件摄取<br/>上传本地文件"]
    end

    subgraph Process["⚙️ 处理流程"]
        Doc["📄 Document<br/>文档解析"]
        Chunk["🧩 Chunk<br/>语义分块"]
        Embed["🔢 Embedding<br/>向量嵌入"]
        Store["💾 存储<br/>PostgreSQL + pgvector"]
    end

    Text --> Doc
    URL --> Doc
    File --> Doc
    Doc --> Chunk
    Chunk --> Embed
    Embed --> Store

    classDef ing fill:#DBEAFE,stroke:#1E3A8A,color:#000
    classDef proc fill:#FEF3C7,stroke:#92400E,color:#000

    class Text,URL,File ing
    class Doc,Chunk,Embed,Store proc
```

#### 知识检索

在语料库详情页的搜索栏中输入查询关键词，系统会执行**混合检索**（语义检索 + 关键词检索），返回相关的 `RetrievedChunkCard` 结果卡片。点击卡片可查看完整的块详情（`RetrievedChunkDetailDialog`），包括分块内容、来源文档和相关性分数。

### 4.4 知识目录 (Catalog)

Catalog 提供树形结构的知识组织方式，采用两栏布局：

- **左侧边栏**：语料库选择器 + 目录树（支持展开/折叠节点）
- **右侧主区域**：节点详情面板

支持创建子节点、更新节点信息、删除节点等操作。

### 4.5 知识图谱 (Graph)

知识图谱以 **D3.js 力导向图** 可视化实体和关系：

- **拖拽节点**：调整图谱布局
- **缩放和平移**：浏览大规模图谱
- **点击节点**：在右侧面板查看实体详情
- **写回图谱**：保存图谱编辑
- **Build Runs**：查看图谱构建历史

### 4.6 Pipeline 监控

Pipeline 页面展示所有知识处理流水线的运行记录，包括：

- 运行状态（Pending / Running / Completed / Failed）
- 各 Stage 的执行详情和耗时
- 错误信息（如有）
- 运行中的作业自动轮询刷新

### 4.7 API 文档与测试 (APIs)

APIs 页面提供交互式的 API 文档和测试环境：

- **左侧**：API 统计卡片（总调用次数、成功/失败计数、平均延迟）+ API 文档面板
- **右侧**：端点列表 + Try It 测试面板（参数输入 → 执行 → 查看结果）

> 更深入的知识系统设计，请参阅 [知识系统](./knowledges.md) 和 [知识图谱](./knowledge-graph.md)。

---

## 5. 记忆系统使用

记忆系统是 Negentropy 的「长期记忆」，管理对话历史、结构化事实和记忆衰减机制。

### 5.1 模块导航

进入 **Memory** 模块后，左侧导航栏提供以下子页面：

| 导航项         | 路径                 | 功能                   |
| :------------- | :------------------- | :--------------------- |
| **Dashboard**  | `/memory`            | 记忆仪表盘             |
| **Timeline**   | `/memory/timeline`   | 记忆时间线             |
| **Facts**      | `/memory/facts`      | 语义事实               |
| **Audit**      | `/memory/audit`      | 记忆审计               |
| **Automation** | `/memory/automation` | 自动化配置（仅管理员） |
| **Activity**   | `/memory/activity`   | 活动日志               |

### 5.2 Dashboard 仪表盘

仪表盘展示记忆系统的全局指标，支持按用户筛选：

| 指标              | 说明                 |
| :---------------- | :------------------- |
| **Users**         | 用户总数             |
| **Memories**      | 记忆条目总数         |
| **Facts**         | 结构化事实总数       |
| **Avg Retention** | 平均保留分数         |
| **Low Retention** | 低保留分数的记忆数量 |
| **Recent Audits** | 最近的审计操作数     |

当存在低保留分数记忆时，仪表盘会显示**警告提示**和跳转链接。

### 5.3 记忆时间线 (Timeline)

时间线页面以三栏布局展示记忆数据：

- **左侧**：用户列表
- **中间**：记忆时间线 / 搜索结果（支持关键词搜索）
- **右侧**：保留策略说明 + 图例

每条记忆卡片展示：

| 信息         | 说明                                  |
| :----------- | :------------------------------------ |
| **内容**     | 记忆文本（截断显示）                  |
| **保留分数** | 颜色指示：🟢 ≥ 50% / 🟠 ≥ 10% / 🔴 < 10% |
| **类型**     | 记忆类型标签                          |
| **访问次数** | Access Count                          |
| **创建时间** | Created At                            |

### 5.4 语义事实 (Facts)

Facts 是结构化的键值对知识存储，每条事实包含：

| 字段                   | 说明                |
| :--------------------- | :------------------ |
| **Key**                | 事实标识键          |
| **Value**              | 事实值（JSON 格式） |
| **Fact Type**          | 事实类型标签        |
| **Confidence**         | 置信度分数          |
| **Valid From / Until** | 有效期范围          |

使用方式：输入 User ID → 点击「Load Facts」→ 浏览或搜索事实。

### 5.5 记忆审计 (Audit)

审计页面提供 GDPR 合规的记忆治理能力，采用三栏布局：

- **左侧**：用户列表
- **中间**：记忆审计列表（含审计按钮）
- **右侧**：提交面板 + 最近审计记录

**三种审计操作**：

| 操作                    | 说明                   |
| :---------------------- | :--------------------- |
| **Retain（保留）**      | 确认保留该记忆条目     |
| **Delete（删除）**      | 标记删除该记忆条目     |
| **Anonymize（匿名化）** | 对记忆内容进行脱敏处理 |

审计时可选填备注说明，支持批量提交。

```mermaid
flowchart TD
    New["🆕 新记忆创建"] --> Score["📊 保留分数计算<br/>(Ebbinghaus 遗忘曲线)"]
    Score --> Check{"保留分数 ≥ 阈值?"}

    Check -->|"是"| Keep["✅ 正常保留"]
    Check -->|"否"| Warn["⚠️ 低保留警告<br/>Dashboard 显示告警"]

    Warn --> Audit["🔍 人工审计"]
    Audit --> Retain["保留"]
    Audit --> Delete["删除"]
    Audit --> Anon["匿名化"]

    classDef proc fill:#FEF3C7,stroke:#92400E,color:#000
    classDef warn fill:#FEE2E2,stroke:#991B1B,color:#000
    classDef ok fill:#D1FAE5,stroke:#065F46,color:#000

    class Warn warn
    class Keep,Retain,Anon ok
    class New,Score,Check,Audit,Delete proc
```

### 5.6 记忆自动化 (Automation)

> ⚠️ 此页面仅对 **admin** 角色用户可见。

自动化页面提供记忆系统的后台治理配置，采用三栏布局：

**左侧 — 系统能力**
- pg_cron 调度器状态
- 管理模式
- 系统健康状态

**中间 — 自动化配置**

| 配置域                | 关键参数                                                                      | 说明                   |
| :-------------------- | :---------------------------------------------------------------------------- | :--------------------- |
| **Retention**         | `decay_lambda`、`low_retention_threshold`、`min_age_days`、`cleanup_schedule` | 记忆衰减与自动清理策略 |
| **Consolidation**     | `schedule`、`lookback_interval`、`enabled`                                    | 记忆整合策略           |
| **Context Assembler** | `max_tokens`、`memory_ratio`、`history_ratio`                                 | 上下文组装参数         |

**Managed Jobs 管理**：启用/停用定时任务、重建任务、手动触发执行。

**右侧 — 函数与日志**：查看自动化函数定义、最近执行日志。

### 5.7 活动日志 (Activity)

活动日志记录记忆系统的所有操作事件：

- 按级别筛选：All / Success / Error / Info / Warning
- 每条记录包含：时间戳、级别徽章、描述信息
- 支持刷新和清除所有操作

> 更深入的记忆系统设计，请参阅 [记忆系统](./memory.md)。

---

## 6. 插件系统使用

插件系统扩展了 Negentropy 的能力边界，支持接入外部工具、技能和子智能体。

### 6.1 模块导航

进入 **Interface** 模块后，左侧导航栏提供以下子页面：

| 导航项          | 路径                 | 功能           |
| :-------------- | :------------------- | :------------- |
| **Dashboard**   | `/plugins`           | 插件仪表盘     |
| **MCP Servers** | `/plugins/mcp`       | MCP 服务器管理 |
| **Skills**      | `/plugins/skills`    | 技能管理       |
| **SubAgents**   | `/plugins/subagents` | 子智能体管理   |

### 6.2 插件仪表盘

仪表盘展示插件系统的全局统计和快捷操作：

- **统计卡片**：MCP Servers 数量 / Skills 数量 / SubAgents 数量（含各自启用数）
- **快捷链接**：Register MCP Server / Create Skill / Configure SubAgent

### 6.3 MCP Server 管理

MCP (Model Context Protocol) 是 Negentropy 接入外部工具的标准协议。

**Server 卡片**展示每个 MCP Server 的信息：

| 信息        | 说明                                    |
| :---------- | :-------------------------------------- |
| 名称 / 描述 | Server 的标识                           |
| 传输类型    | `stdio`（本地进程）或 `sse`（远程服务） |
| 启用状态    | 已启用 / 已禁用                         |
| 工具数量    | 该 Server 注册的工具数                  |

**核心操作**：

| 操作              | 说明                                                |
| :---------------- | :-------------------------------------------------- |
| **Add Server**    | 注册新的 MCP Server（配置名称、传输类型、命令/URL） |
| **Load Tools**    | 加载已启用 Server 的工具列表                        |
| **Try**           | 打开测试对话框，试用 Server 提供的工具              |
| **Edit / Delete** | 编辑或删除 Server                                   |

### 6.4 Skill 管理

Skill 是预定义的 Prompt 模板，可以为 Agent 赋能特定领域的技能。

**Skill 卡片**展示：

| 信息        | 说明             |
| :---------- | :--------------- |
| 名称 / 描述 | 技能的标识和说明 |
| Category    | 技能分类         |
| Version     | 版本号           |
| Priority    | 优先级           |
| 启用状态    | 已启用 / 已禁用  |

支持按 **Category** 下拉筛选，创建/编辑/删除 Skill。

### 6.5 SubAgent 管理

SubAgent 是可独立调度的子智能体，Agent 可以在需要时将任务委派给 SubAgent。

**核心功能**：

| 操作                  | 说明                                                                        |
| :-------------------- | :-------------------------------------------------------------------------- |
| **Sync Negentropy 5** | 从 Negentropy 五大系部同步预设模板（显示同步结果：created/updated/skipped） |
| **Add SubAgent**      | 创建自定义子智能体                                                          |
| **Edit / Delete**     | 编辑或删除 SubAgent                                                         |

**SubAgent 卡片**展示：

| 信息           | 说明                 |
| :------------- | :------------------- |
| 名称 / 描述    | 子智能体的标识       |
| Agent Type     | 智能体类型           |
| Model          | 使用的模型           |
| Skills / Tools | 配置的技能和工具     |
| 是否内置       | 系统预设或用户自定义 |

```mermaid
flowchart TB
    Engine["🔮 NegentropyEngine"]

    subgraph Plugins["🔧 插件系统"]
        MCP["📡 MCP Servers<br/>外部工具协议"]
        Skill["🎯 Skills<br/>Prompt 模板"]
        SubAgent["🤖 SubAgents<br/>子智能体"]
    end

    subgraph External["🌐 外部能力"]
        WebSearch["Web 搜索"]
        API["第三方 API"]
        DB["数据库"]
    end

    Engine -->|"工具调用"| MCP
    Engine -->|"技能匹配"| Skill
    Engine -->|"任务委派"| SubAgent

    MCP --> WebSearch
    MCP --> API
    MCP --> DB

    classDef core fill:#F59E0B,stroke:#92400E,color:#000
    classDef plug fill:#3B82F6,stroke:#1E3A8A,color:#FFF
    classDef ext fill:#10B981,stroke:#065F46,color:#FFF

    class Engine core
    class MCP,Skill,SubAgent plug
    class WebSearch,API,DB ext
```

---

## 7. 管理后台

管理后台（Admin）提供系统级配置能力，包括用户管理、模型配置和角色权限管理。

> ⚠️ Admin 模块仅对具有 **admin** 角色的用户可见。用户通过 Google OAuth SSO 登录后，系统根据其角色分配访问权限。详细配置请参阅 [SSO 集成](./sso.md)。

### 7.1 用户管理

用户管理页面展示当前系统中的所有用户：

- **当前用户信息卡片**：头像、姓名、邮箱、角色徽章
- **用户列表**：展示所有用户及其角色
- **角色切换**：在 `admin` 和 `user` 之间切换用户角色
- **权限说明**：展示 admin 和 user 两种角色的权限范围

### 7.2 模型管理

模型管理页面允许管理员配置系统使用的 LLM、Embedding 和 Rerank 模型。

#### 模型类型

系统支持三种模型类型：

| 类型          | 用途           | 专属配置                                                     |
| :------------ | :------------- | :----------------------------------------------------------- |
| **LLM**       | 对话与推理     | Temperature 滑块、Max Tokens、Thinking Mode（开关 + Budget） |
| **Embedding** | 文本向量化     | Dimensions、Input Type                                       |
| **Rerank**    | 搜索结果重排序 | —                                                            |

#### 支持的模型供应商

| 供应商    | 说明                |
| :-------- | :------------------ |
| OpenAI    | GPT 系列            |
| Anthropic | Claude 系列         |
| ZAI       | 智谱 AI（GLM 系列） |
| Vertex AI | Google Cloud AI     |
| DeepSeek  | DeepSeek 系列       |
| Ollama    | 本地模型            |

#### 模型操作

```mermaid
flowchart TD
    Start["➕ 添加模型"] --> Type["选择模型类型<br/>LLM / Embedding / Rerank"]
    Type --> Config["配置参数<br/>名称、Vendor、模型名"]
    Config --> Params["类型专属配置<br/>Temperature / Dimensions 等"]
    Params --> Cred["API 凭证<br/>Base URL + API Key"]
    Cred --> Ping["📡 Ping 连通性测试"]
    Ping -->|"成功 (显示延迟)"| Save["💾 保存模型"]
    Ping -->|"失败"| Config
    Save --> Default["⭐ 设为默认模型"]

    classDef proc fill:#FEF3C7,stroke:#92400E,color:#000
    classDef ok fill:#D1FAE5,stroke:#065F46,color:#000
    classDef err fill:#FEE2E2,stroke:#991B1B,color:#000

    class Start,Type,Config,Params,Cred,Save,Default proc
    class Ping ok
```

| 操作          | 说明                                |
| :------------ | :---------------------------------- |
| **创建模型**  | 填写配置表单，支持 Ping 测试连通性  |
| **编辑模型**  | 修改已有模型的配置参数              |
| **设为默认**  | 将该模型设为对应类型的默认选择      |
| **启用/禁用** | 切换模型的可用状态                  |
| **删除**      | 移除模型配置                        |
| **Ping 测试** | 验证模型 API 的连通性，显示响应延迟 |

### 7.3 角色权限管理

角色权限管理页面以矩阵形式展示各角色的权限配置：

- **权限区域**：Admin Console、User Management、Knowledge、Memory、Chat
- **权限级别**：`read`（只读）/ `write`（读写），通过开关切换
- **草稿管理**：支持刷新加载、Reset 单个角色、Reset All
- **数据导出**：可导出当前权限配置的草稿快照 JSON

---

## 8. Wiki 知识发布

Negentropy Wiki 是知识库的**对外发布窗口**，将知识库中整理好的内容以静态站点形式发布，供公众浏览。

### 8.1 站点概览

- **首页**：展示所有已发布的 Wiki Publication（卡片式布局，含名称、描述、版本号、文档数量）
- **Publication 页**：左侧导航树 + 右侧文档列表
- **文档详情页**：Markdown 渲染 + MathJax 数学公式支持

### 8.2 内容发布流程

```mermaid
flowchart LR
    KB["📚 知识库<br/>Corpus / Documents"] --> Publish["📤 创建 Wiki Publication"]
    Publish --> Wiki["🌐 Wiki 站点<br/>SSG + ISR"]
    Wiki --> User["👤 用户浏览"]

    Wiki -.->|"ISR 增量更新<br/>(5 分钟)"| KB

    classDef proc fill:#DBEAFE,stroke:#1E3A8A,color:#000
    classDef wiki fill:#D1FAE5,stroke:#065F46,color:#000

    class Publish proc
    class Wiki,User wiki
```

### 8.3 主题与深色模式

Wiki 站点支持 3 套预设主题（`default` / `book` / `docs`），并自动适配深色模式。

### 8.4 运维概要

Wiki 采用 **SSG (Static Site Generation) + ISR (Incremental Static Regeneration)** 模式：

- 构建时预渲染所有页面
- 每 5 分钟增量再验证，自动更新内容
- 支持独立部署（Node.js Standalone 或 Docker）

> 完整的 Wiki 运维文档，请参阅 [Wiki 运维指引](./negentropy-wiki-ops.md)。

---

## 9. 常见问题

### 9.1 对话相关

**Q: Agent 没有响应怎么办？**

检查以下几点：
1. 确认后端服务已启动（`http://localhost:8000`）
2. 查看连接状态指示器是否从 `idle` 变为 `connecting`
3. 检查右侧 LogBufferPanel 是否有错误日志
4. 确认 LLM 模型配置正确（Admin > Models，Ping 测试通过）

**Q: 标题栏显示「等待确认」无法继续？**

这是 HITL 确认机制。在 ChatStream 中找到确认卡片，选择「确认」「修正」或「补充」操作后，Agent 才会继续执行。

**Q: 如何回到之前的对话？**

点击左侧 SessionList 中的历史会话即可切换。中间区域会加载历史消息，右侧面板加载历史事件。

**Q: 调试面板中 EventTimeline 和 LogBuffer 有什么区别？**

- **EventTimeline**：展示 Agent 执行过程中的结构化事件（工具调用、状态变更等），面向业务逻辑
- **LogBufferPanel**：展示系统日志（info/warn/error），面向运维排错

### 9.2 知识库相关

**Q: 摄取文档后搜索不到相关内容？**

1. 确认文档摄取状态为 Completed（在 Pipeline Runs 中查看）
2. 检查分块策略配置是否适合你的文档类型
3. 尝试调整搜索查询，使用更具体的关键词
4. 确认 Embedding 模型配置正确（Admin > Models）

**Q: 如何选择合适的分块策略？**

| 策略             | 适用场景                         |
| :--------------- | :------------------------------- |
| **Fixed**        | 结构统一的文档（日志、表格）     |
| **Recursive**    | 通用场景，按分隔符递归切分       |
| **Semantic**     | 语义密集的文档（论文、技术文档） |
| **Hierarchical** | 层次化文档（书籍、手册）         |

**Q: 知识图谱为空怎么办？**

知识图谱需要手动触发构建。进入 Graph 页面，确认已有文档摄取完成，然后触发图谱构建。

### 9.3 记忆系统相关

**Q: 记忆为什么会被遗忘？**

系统基于 Ebbinghaus 遗忘曲线模型计算记忆的保留分数。长期未被访问的记忆，保留分数会逐渐降低。这是系统的自我净化机制，避免无效信息堆积。

**Q: 如何手动保留低保留分数的记忆？**

进入 Memory > Audit 页面，选择用户和目标记忆，执行「Retain」操作。

**Q: 自动化任务未执行？**

确认 Automation 页面中 pg_cron 状态为正常，相关 Job 已启用（`enabled = true`），且 `schedule` 配置正确。

### 9.4 管理后台相关

**Q: 无法访问 Admin 模块？**

Admin 模块需要 `admin` 角色。联系系统管理员为你的账户分配 admin 角色（Admin > Users）。

**Q: 模型 Ping 测试失败？**

1. 检查 API Key 是否正确
2. 检查 API Base URL 是否可访问
3. 检查网络连接（尤其是需要代理访问的供应商）
4. 确认模型名称是否与供应商提供的模型 ID 一致

**Q: 如何切换默认模型？**

进入 Admin > Models，找到目标模型，点击「设为默认」按钮。每种模型类型（LLM/Embedding/Rerank）可独立设置默认模型。

### 9.5 Wiki 相关

**Q: Wiki 页面内容不更新？**

Wiki 使用 ISR 机制，最长 5 分钟自动更新。如需立即更新，可在知识库中重新发布 Wiki Publication。

**Q: 构建失败怎么办？**

检查 Pipeline Runs 中的错误信息，确认文档内容格式正确（支持 Markdown），且相关依赖服务（如数学公式渲染）可用。

---

## 附录 A：术语表

| 术语     | 英文                            | 说明                                               |
| :------- | :------------------------------ | :------------------------------------------------- |
| 熵减     | Negentropy                      | 对抗知识无序化的系统理念，源自薛定谔《生命是什么》 |
| 系部     | Faculty                         | 负责特定认知功能的智能体子单元                     |
| 流水线   | Pipeline                        | 预定义的多系部协作序列                             |
| 会话     | Session                         | 一次独立对话的容器                                 |
| 语料库   | Corpus                          | 一组相关文档的集合                                 |
| 分块     | Chunk                           | 文档被切分后的最小检索单元                         |
| 嵌入     | Embedding                       | 文本转换为向量表示的过程                           |
| 记忆     | Memory                          | 系统持久化的知识条目                               |
| 事实     | Fact                            | 结构化的键值对知识                                 |
| 保留分数 | Retention Score                 | 衡量记忆重要性的指标（基于遗忘曲线）               |
| 审计     | Audit                           | 对记忆的合规治理操作（保留/删除/匿名化）           |
| MCP      | Model Context Protocol          | 连接外部工具的标准协议                             |
| Skill    | Skill                           | 预定义的 Prompt 模板，为 Agent 赋能特定能力        |
| 子智能体 | SubAgent                        | 可被 Agent 委派任务的独立智能体                    |
| HITL     | Human-in-the-Loop               | 关键决策交由人工确认的机制                         |
| ISR      | Incremental Static Regeneration | 增量静态再生成，定期更新预渲染页面                 |

## 附录 B：环境变量速查表

> 后端完整配置清单请参考 `apps/negentropy/src/negentropy/config/config.default.yaml`（单一事实源），密钥类环境变量需通过 shell 或 `.env.local` 注入；前端变量请参考 `apps/negentropy-ui/.env.example`。

| 变量名                      | 说明                                          | 默认值                  |
| :-------------------------- | :-------------------------------------------- | :---------------------- |
| `NE_ENV`                    | 运行环境                                      | `development`           |
| `NE_DB_URL`                 | PostgreSQL 连接字符串                         | —                       |
| `NE_LOG_LEVEL`              | 日志级别                                      | `INFO`                  |
| `NE_AUTH_ENABLED`           | 是否启用认证                                  | `true`                  |
| `NE_AUTH_MODE`              | 认证模式 (`off` / `optional` / `strict`)      | `optional`              |
| `NE_SEARCH_PROVIDER`        | 搜索供应商 (`google` / `duckduckgo` / `bing`) | `google`                |
| `ZAI_API_KEY`               | LLM API 密钥                                  | —                       |
| `ZAI_API_BASE`              | LLM API Base URL                              | —                       |
| `AGUI_BASE_URL`             | ADK 后端地址（前端服务端变量）                | `http://localhost:8000` |
| `NEXT_PUBLIC_AGUI_APP_NAME` | 应用名称（前端客户端变量）                    | `negentropy`            |

## 附录 C：文档导航

| 文档                                       | 路径                                  | 说明                               |
| :----------------------------------------- | :------------------------------------ | :--------------------------------- |
| **用户手册**（本文档）                     | [docs/user-guide.md](./user-guide.md) | 面向最终用户的使用指南             |
| [开发指南](./development.md)               | `docs/development.md`                 | 环境搭建、开发工作流、数据库迁移   |
| [架构设计](./framework.md)                 | `docs/framework.md`                   | 一核五翼架构、流水线编排、设计模式 |
| [知识系统](./knowledges.md)                | `docs/knowledges.md`                  | 知识管理模块的详细设计             |
| [记忆系统](./memory.md)                    | `docs/memory.md`                      | 记忆生命周期与治理机制             |
| [知识图谱](./knowledge-graph.md)           | `docs/knowledge-graph.md`             | 图建模与查询实现                   |
| [SSO 集成](./sso.md)                       | `docs/sso.md`                         | Google OAuth 认证配置              |
| [QA 流水线](./qa-delivery-pipeline.md)     | `docs/qa-delivery-pipeline.md`        | 质量门禁与发布流程                 |
| [Wiki 运维](./negentropy-wiki-ops.md)      | `docs/negentropy-wiki-ops.md`         | Wiki 站点的部署与运维              |
| [工程变更日志](./engineering-changelog.md) | `docs/engineering-changelog.md`       | 里程碑与基线变更记录               |
| [AI 协作协议](../AGENTS.md)                | `AGENTS.md`                           | Agent 协作准则与工程规范           |

---

<a id="ref1"></a>[1] E. Schrödinger, "What is Life? The Physical Aspect of the Living Cell," _Cambridge University Press_, 1944.
