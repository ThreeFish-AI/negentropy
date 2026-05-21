# **架构分歧与融合：生成式 AI 可观测性时代的 Jaeger 与 Langfuse 深度对比分析报告**

## **1. 执行摘要**

随着大型语言模型（LLM）的广泛应用，软件工程架构正经历一场从确定性的、以代码为中心的微服务架构，向随机性的、以模型为中心的概率性工作流的范式转变。这种转变迫使企业重新评估其可观测性技术栈。本报告旨在为架构师、工程负责人及技术决策者提供一份详尽的、专家级的对比分析，深入探讨云原生微服务分布式追踪的标准 **Jaeger** 与专为 LLM 开发生命周期打造的工程平台 **Langfuse** 之间的异同。

本报告基于对超过 80 份技术文档、架构白皮书、社区讨论及性能基准测试的深入研究，不仅分析了两者在功能表象上的差异，更深入解剖了其底层的存储引擎、数据模型、摄取管道及运维复杂度的本质区别。分析显示，尽管两者均建立在 OpenTelemetry (OTel) 这一通用标准之上，但它们占据了截然不同但互补的生态位。Jaeger 作为通用的、高吞吐量的基础设施追踪后端，针对复杂分布式系统中的延迟分析和服务依赖映射进行了极致优化；而 Langfuse 则作为垂直领域的专用平台，将追踪的概念延伸至模型评估、提示词管理及成本归因，专注于保障 AI 应用的质量与经济可行性。

## **2. 范式转移：可观测性哲学的根本分歧**

要深入理解 Jaeger 与 Langfuse 的对比，首先必须纠正将两者视为直接替代品的“范畴错误”。虽然这两种工具的核心功能都是可视化“Trace”（操作的时间线），但它们旨在解决的工程问题植根于软件工程发展的不同阶段。

### **2.1 微服务语境：Jaeger 的确定性宇宙**

Jaeger 诞生于 Uber Technologies，旨在解决微服务时代爆发的可见性挑战 1。在这一范式中，复杂性源于**网络**与**服务拓扑**。一个单一的用户请求可能会在下游触发数百次远程过程调用（RPC）。当请求失败或响应迟缓时，根本原因通常隐藏在网络瓶颈、数据库锁争用或特定微服务内部的代码异常中。

Jaeger 的核心使命是**分布式上下文传播（Distributed Context Propagation）**。它通过在不同的服务组件之间传递 Trace ID，将离散的日志和指标串联起来，构建出一个有向无环图（DAG），从而还原请求在系统中的执行路径 3。在 Jaeger 的世界观里，价值的原子单位是 **Span**（跨度）——一个带有开始时间、持续时间和标签的逻辑工作单元。其关注的关键指标是 **延迟（Latency）**、**吞吐量（Throughput）** 和 **错误率（Error Rate）**。Jaeger 假设系统行为在逻辑上是确定性的：相同的输入应当产生相同的输出，异常往往意味着基础设施或代码逻辑的故障。

### **2.2 生成式 AI 语境：Langfuse 的随机性宇宙**

Langfuse 出现于 2023 年，旨在应对生成式 AI（GenAI）时代的独特挑战 5。在这一范式中，复杂性源于**模型**本身。对 LLM 的请求本质上是一个“黑盒”操作，其输出具有内在的非确定性（Stochastic）。在这种背景下，追踪不仅仅关注操作耗时，更关注**生成了什么**以及**消耗了多少成本**。

Langfuse 的核心使命是**质量控制与成本治理**。它的价值原子单位虽然在技术上也基于 Span，但被扩展为 **Generation**（生成）——这是一种包含提示词（Prompt）、补全文本（Completion）、Token 使用量及模型超参数的特殊 Span 6。关键指标转变为 **Token 消耗量**、**模型推理成本**、**幻觉率（Hallucination Rate）** 以及 **用户反馈评分**。Langfuse 承认系统的概率性质，因此其观测重点在于通过聚合分析来评估模型在不同输入分布下的表现稳定性。

### **2.3 融合点：OpenTelemetry 的通用语言**

尽管目标迥异，行业已在 **OpenTelemetry (OTel)** 这一标准上达成共识。Jaeger 和 Langfuse 均全面拥抱 OTel 标准 6。Jaeger 的 v2 架构已基于 OpenTelemetry Collector 框架重构 8，而 Langfuse 则原生构建在 OTel SDK 之上，并支持通过 OTLP（OpenTelemetry Protocol）接收数据 9。这种共享的标准使得两者在数据采集层具备互操作性，但对数据的**解释**、**存储**和**可视化**方式则构成了两者的本质区别。

## **3. 架构解剖：基础设施与数据分析的较量**

Jaeger 和 Langfuse 的架构决策揭示了它们各自的优化目标：Jaeger 追求极致的写入吞吐量和基础设施弹性，而 Langfuse 则追求丰富的数据分析能力和开发者工作流的集成。

### **3.1 Jaeger 架构：基础设施的重型承载者**

Jaeger 的架构是模块化的，旨在处理超大规模分布式系统产生的海量追踪数据“消防水龙带”。它支持从简单的“All-in-One”二进制文件到复杂的分布式生产环境部署等多种策略 1。

#### **3.1.1 核心组件详解**

- **Jaeger Agent（代理）：** 历史上，这是一个部署在宿主机上的网络守护进程，监听 UDP 端口接收 Span。在现代架构中，这已逐渐被 **OpenTelemetry Collector** 取代，后者作为 Sidecar 或 Host Agent 运行 1。其主要职责是对数据进行批处理并转发给 Collector，从而屏蔽下游路由逻辑，减轻应用负担。
- **Jaeger Collector（收集器）：** 这是接收追踪数据的中央处理单元。它负责验证数据、执行转换（如降采样、脱敏）、并将其写入存储后端 10。Collector 是无状态的，支持水平扩展，能够通过负载均衡器分发流量。
- **Ingester（摄取器）：** 在高流量的生产环境中，直接写入数据库往往会成为瓶颈。Jaeger 推荐使用 **Apache Kafka** 作为中间缓冲层。Collector 将数据写入 Kafka，而 Ingester 负责从 Kafka 消费数据并写入数据库 1。这种“Kafka 缓冲”架构对于处理突发流量（Spikes）至关重要，防止背压（Back-pressure）导致应用端数据丢失。
- **Query Service（查询服务）：** 提供 API 接口以供检索追踪数据，并支撑基于 React 的前端 UI 1。

#### **3.1.2 存储后端：写入密集型的抉择**

Jaeger 的存储层设计高度可插拔，但强烈倾向于支持高写入吞吐量的 NoSQL 解决方案 11：

- **Elasticsearch (或 OpenSearch):** 这是最常见的生产环境后端。它提供强大的搜索能力（例如：“查找所有 HTTP 状态码为 500 的 Trace”）。然而，在大规模环境下维护 Elasticsearch 集群的运营成本极高，需要精细管理索引生命周期（ILM）、分片（Sharding）和副本 12。
- **Cassandra:** 对于写入量极大的场景（如 Uber 内部），Cassandra 是首选。它提供极致的写入性能和线性扩展能力，但在搜索灵活性上不如 Elasticsearch。
- **Kafka:** 仅作为中间管道，而非长期存储。

### **3.2 Langfuse 架构：垂直整合的分析引擎**

Langfuse 的架构更接近于现代 Web 应用与专用 OLAP（在线分析处理）数据仓库的结合。它被设计用于摄取包含大量文本载荷（Payloads）的数据，并对其进行复杂的聚合分析 13。

#### **3.2.1 核心组件详解**

- **Web Container (Next.js):** 负责提供 UI 界面并处理所有的 API 请求。它是用户交互的入口。
- **Worker Container (Node.js/Express):** 这是系统的异步处理引擎。它负责处理数据摄取、执行后台任务（如“LLM-as-a-Judge”评估）、以及管理数据导出 13。为了确保 API 的高响应性，Langfuse 使用 **Redis** (BullMQ) 队列将数据接收与处理解耦 13。
- **异步摄取管道：** 与 Jaeger 追求近实时的流式处理不同，Langfuse 优先考虑数据的丰富性。SDK 将数据发送到 API 后，API 会将原始事件转储到 **S3（或 Blob Storage）** 并将任务推入 Redis。Worker 随后异步处理这些事件，进行数据清洗和富化，最后批量写入数据库 13。

#### **3.2.2 存储层：双数据库策略 (The Split-Brain Strategy)**

Langfuse 架构的一个决定性特征是其“双数据库”设计 13：

- **PostgreSQL (OLTP):** 处理事务性数据：用户、组织、API 密钥、提示词版本控制、数据集及配置设置。它确保了管理数据的 ACID 一致性。
- **ClickHouse (OLAP):** 这是 Langfuse 与 Jaeger 的根本区别所在。Langfuse 强制要求使用 ClickHouse 来存储 Trace、Observation 和 Score 数据 13。
  - **为什么选择 ClickHouse？** 可观测性数据具有“写多读少”且“读取时需大量聚合”的特性（例如：“计算过去 30 天每个用户的平均 Token 成本”）。Postgres 在处理此类海量数据的聚合查询时性能会急剧下降。ClickHouse 的列式存储（Columnar Storage）和向量化执行引擎使得 Langfuse 能够在毫秒级内完成数亿行数据的聚合，支撑其实时的分析仪表盘 13。
  - **运维影响：** 自托管 Langfuse 意味着必须维护 ClickHouse 集群。对于不熟悉列式数据库的团队来说，这引入了显著的学习曲线和运维负担（如处理异步插入、合并树引擎的调优等） 14。

### **3.3 架构对比总结表**

| 特性维度         | Jaeger                                      | Langfuse                                              |
| :--------------- | :------------------------------------------ | :---------------------------------------------------- |
| **首要目标**     | 分布式上下文传播、基础设施监控、延迟分析    | LLM 工程化、成本归因、质量评估、提示词管理            |
| **架构风格**     | 流水线式 (Agent -> Collector -> DB)         | Web 应用 + 异步 Worker (API -> Queue -> Worker -> DB) |
| **主要存储后端** | Elasticsearch 或 Cassandra (NoSQL/搜索引擎) | ClickHouse (OLAP) + PostgreSQL (OLTP)                 |
| **摄取缓冲机制** | Apache Kafka (生产环境推荐)                 | Redis (BullMQ) + S3 (原始事件存储)                    |
| **扩展机制**     | Collector 无状态水平扩展；ES/Cassandra 分片 | Worker 无状态水平扩展；ClickHouse 分片与副本          |
| **数据“重量”**   | 轻量级 Span (时间戳 + 简单标签)             | 重量级 Payloads (完整 Prompt、Completion、元数据)     |
| **查询模式**     | 主要是基于 ID 或 Tag 的点查                 | 基于列的大规模聚合分析 (OLAP)                         |

## **4. 数据模型与遥测标准**

尽管这两种工具都使用“Trace”和“Span”这两个术语，但在语义深度和扩展模型上，它们存在显著差异。

### **4.1 Jaeger 的数据模型：通用的 Span**

Jaeger 严格遵循 OpenTracing（及现在的 OpenTelemetry）的通用数据模型 10。

- **Trace (链路):** 由 Spans 组成的有向无环图 (DAG)。
- **Span (跨度):** 代表一个逻辑工作单元。它包含：
  - 操作名称 (Operation Name, 如 HTTP GET /api/v1/user)
  - 开始时间与持续时间 (Start Time & Duration)
  - 标签 (Tags, 键值对, 如 http.status_code=200)
  - 日志 (Logs, Span 内的时间戳事件)
  - 引用 (References, 如 ChildOf, FollowsFrom)
- **LLM 场景下的局限性：** Jaeger 将 LLM 调用视为与数据库调用完全相同的操作。它只能看到一个“请求”和一个“响应”。它不具备语义上的理解力，无法识别“请求”中包含的是 prompt，也无法理解“响应”中的 usage.total_tokens 代表成本。在 Jaeger 中，这些仅仅是普通的标签。如果 Prompt 长达 4000 个 Token，Jaeger 的标签视图可能会截断显示，或者以极不友好的纯文本形式展示，导致调试困难 18。

### **4.2 Langfuse 的数据模型：富化的 Generation**

Langfuse 扩展了 OpenTelemetry 模型，引入了专门针对 GenAI 的语义实体 6。

- **Trace:** 代表一次完整的执行流（例如，用户与聊天机器人的单次交互）。
- **Observation (观测):** 所有事件的基类。其子类型包括：
  - **Span:** 通用的工作单元（数据库调用、业务逻辑），与 OTel Span 1:1 映射。
  - **Generation (生成):** 一种特殊的 Span，专为 LLM 调用设计。它显式地结构化了以下字段：model（模型名称）、model_parameters（温度、Top-p）、input（提示词）、output（补全结果）、usage（输入/输出 Token 数量）以及 cost（基于定价模型自动计算的成本） 7。
  - **Event:** 离散的时间点事件。
- **Score (评分):** 这是一个独特的实体，可以链接到 Trace 或 Observation。Score 用于捕获评估结果（例如：“准确性：0.9”、“用户反馈：差评”） 20。Jaeger 中完全没有这种对应实体，用户必须笨拙地使用 Log 或 Tag 来模拟，但这无法被用于聚合分析。
- **Session (会话):** Langfuse 引入了 **Session** 的概念，用于将多个 Trace 分组以表示连续的用户交互（如多轮对话） 19。Jaeger 虽然支持按“Trace ID”搜索，但缺乏原生的跨 Trace 会话概念，无法轻易还原用户的完整对话历史。

### **4.3 语义约定鸿沟 (The Semantic Convention Gap)**

一个关键的洞察在于这两种工具如何处理 **OpenTelemetry GenAI 语义约定 (Semantic Conventions)** 21。

- **Langfuse:** 原生实现并依赖这些约定。如果一个 OTel Span 带有 gen_ai.system=openai 和 gen_ai.usage.input_tokens=50 属性，Langfuse 会自动将其解析为内部的“Generation”模型，应用定价逻辑计算成本，并在 UI 中以对话气泡的形式渲染 Prompt 9。
- **Jaeger:** 仅将这些属性显示为原始的文本标签列表。它不会计算成本，也不会格式化对话。用户必须在脑海中解析 gen_ai.usage.input_tokens 的含义。这使得 Jaeger 在分析 Token 消耗趋势时几乎毫无用处，除非配合 Prometheus 等指标工具进行二次开发。

## **5. 运维动力学与部署复杂性**

对于工程团队而言，系统的维护成本往往比功能本身更具决定性。本节深入对比两者的运维现实。

### **5.1 Jaeger：基础设施的重担**

在生产环境中运行 Jaeger 是一项重大的运维任务，通常由专门的平台工程或 SRE 团队负责。

- **依赖的重型化：** 部署 Jaeger 不仅仅是运行 Jaeger 二进制文件，实际上你是在运行和调优一个 **Elasticsearch** 集群。Elasticsearch 是出了名的资源消耗大户，需要精细的堆内存管理、分片规划和副本策略。为了防止数据爆炸，必须配置索引生命周期管理（ILM）策略来定期滚动和删除旧索引 11。
- **Kafka 的引入：** 为了获得高可靠性，架构中通常需要引入 Kafka。这意味着运维团队还需要具备 Kafka 集群的维护能力（Topic 管理、分区再平衡、消费者滞后监控等） 8。
- **无状态组件的优势：** Jaeger 的 Collector 和 Query 服务是无状态的，非常适合在 Kubernetes 上运行，利用 HPA（水平自动伸缩）即可轻松应对流量波动 24。
- **内存 vs 持久化：** 虽然 Jaeger 提供了简单的 all-in-one 部署模式，但它使用内存存储，重启即丢数据。这种模式仅限于开发测试，不能用于生产。

### **5.2 Langfuse：数据仓库的挑战**

自托管 Langfuse 将复杂性从搜索引擎转移到了列式数据库。

- **ClickHouse 的强制性：** Langfuse **必须** 使用 ClickHouse。虽然 ClickHouse 效率极高，但它有着独特的运维特性（如异步数据合并、Mutation 的高昂代价）。Langfuse 负责管理数据库迁移，但底层的数据库健康、备份和扩容仍需运维人员负责 14。
  - **版本陷阱：** 研究指出，特定的 ClickHouse 版本（如 25.6.2.5）存在内存泄漏 bug，在执行删除操作时可能导致系统崩溃 15。这要求运维团队必须紧跟社区动态，谨慎选择数据库版本。
- **Docker Compose 的便捷性：** 对于中小型规模（或单机部署），Langfuse 提供的 Docker Compose 方案非常成熟，能在几分钟内拉起 Postgres、ClickHouse、Redis 和应用容器 25。这使得个人开发者或初创团队能比 Jaeger 更快地获得一个持久化的环境。
- **摄取限制与堆内存耗尽：** 这是一个关键的隐患。研究表明，Langfuse 的摄取 Worker（基于 Node.js）在处理极大的 Trace（例如单个 Trace 包含超过 10,000 个 Span）时可能会遭遇堆内存耗尽（Heap Exhaustion） 26。这是因为 Langfuse 试图将整个 Trace 的事件在内存中合并后再写入 ClickHouse。相比之下，Jaeger 以流式处理单个 Span，对“巨型 Trace”的鲁棒性更强。

### **5.3 成本分析（TCO）**

| 成本维度     | Jaeger (自托管)                 | Langfuse (自托管)                  | Langfuse (SaaS)     |
| :----------- | :------------------------------ | :--------------------------------- | :------------------ |
| **计算资源** | 高 (Elasticsearch 需要大量 RAM) | 中 (ClickHouse 压缩率高，CPU 密集) | 无 (按量付费)       |
| **存储效率** | 低 (JSON 文档存储，膨胀率高)    | 极高 (列式存储 + 压缩)             | 无                  |
| **运维人力** | 高 (需 ES/Kafka 专家)           | 中 (需 ClickHouse 知识)            | 低                  |
| **许可费用** | 免费 (Apache 2.0)               | 核心免费 (MIT)，企业功能付费       | 基于 Event 数量计费 |

## **6. 功能特性深度剖析**

本节将逐一对比两者在关键功能领域的表现。

### **6.1 可视化与调试 (Visualization & Debugging)**

- **Jaeger:**
  - **甘特图 (Gantt Chart):** 这是并发和延迟可视化的黄金标准。Jaeger 极其擅长识别“瀑布流”模式（即服务之间不必要的串行等待） 3。
  - **服务依赖图 (Service Dependency Graph):** 基于聚合的 Trace 数据自动生成服务间的调用拓扑图。这对于理解微服务架构中的上下游关系至关重要 2。
  - **关键路径分析 (Critical Path Analysis):** 视觉化高亮决定整个 Trace 耗时的关键 Span 序列，帮助开发者快速定位性能瓶颈。
- **Langfuse:**
  - **会话视图 (Trace View):** 专注于交互的**内容**。它以类似聊天窗口的界面渲染 Prompt 和 Completion，保留了 Markdown 格式。它会在每一步显示 Token 消耗和成本，这对 AI 工程师优化模型至关重要 27。
  - **Agent Graph (智能体图谱):** Langfuse 推出的一项新功能（2025 年），用于可视化 LangGraph 等框架构建的智能体。它不仅展示调用关系，还能展示智能体的推理循环、分支决策逻辑，这是 Jaeger 的通用服务图无法表达的 28。
  - **IO 深度检查:** 允许对复杂的 JSON 输入/输出进行展开检查，这对于调试 Agent 的工具调用（Function Calling）非常关键 5。

### **6.2 搜索与发现 (Search & Discovery)**

- **Jaeger:** 主要依赖基于 Tag 的结构化搜索（如 tag:error=true）。它**不支持**对日志内容或 Payload 的全文检索，除非配置了与 Kibana 的深度集成。这意味着你无法直接搜索“所有用户提到‘退款’的请求” 30。
- **Langfuse:** 得益于 ClickHouse 的强大能力，Langfuse 支持对 Prompt 和 Response 的**全文检索**和**向量检索**。你可以搜索“所有模型回复中包含‘我不知道’的 Trace”，或者根据语义相似度查找相关 Trace 5。

### **6.3 LLM 工程化专属特性 (Langfuse 独占)**

Langfuse 包含了一整套 Jaeger 完全缺失的功能，因为这些功能超出了传统分布式追踪的范畴：

- **提示词管理 (Prompt Management):** 将提示词视为代码进行版本控制。支持在 UI 中编辑提示词，并通过 SDK 在代码中拉取。这实现了提示词工程与代码部署的解耦 31。
- **评估 (Evaluations / Evals):**
  - **基于模型的评估 (Model-based):** 设置“LLM-as-a-Judge”自动对 Trace 进行评分（如：检测毒性、相关性、幻觉） 20。
  - **人工反馈 (Human-in-the-loop):** 提供 UI 界面供人类专家对 Trace 进行标注（点赞/点踩/打分） 20。
- **数据集与测试 (Datasets & Testing):** 允许团队构建“输入/期望输出”数据集，并针对新版本的提示词运行回归测试（Experiments） 20。
- **Playground:** 内置的沙箱环境，允许在不编写代码的情况下直接测试提示词效果。

## **7. 集成格局：共存策略与生态系统**

鉴于 Jaeger 在基础设施监控方面的不可替代性，以及 Langfuse 在 LLM 逻辑层的独特价值，最成熟的工程团队往往采用“强强联合”的策略，而非二选一。

### **7.1 “分叉遥测”模式 (The Forked Telemetry Pattern)**

一种稳健的生产架构是使用 **OpenTelemetry Collector** 作为中央路由器 10。

1. **插桩 (Instrumentation):** 应用程序统一使用 OTel SDK (Python/Node/Go) 进行埋点。
2. **收集 (Collection):** Trace 数据首先发送到本地或集群级的 OTel Collector。
3. **分叉 (Fan-out):** OTel Collector 配置两个 Exporter：
   - **Exporter A (OTLP/gRPC) -> Jaeger:** 将所有的 Spans（包括数据库、HTTP、Redis、LLM）发送给 Jaeger。SRE 团队利用这些数据监控基础设施健康度、报警及服务拓扑。
   - **Exporter B (OTLP/HTTP) -> Langfuse:** 通过过滤器（Processor）筛选出与 LLM 相关的 Spans（或者全部发送），转发给 Langfuse。AI 团队利用这些数据进行成本分析和效果评估。
4. **优势:** 平台团队在 Grafana/Jaeger 中保持了统一的视图 33，而 AI 工程团队则获得了 Langfuse 的专业视图，互不干扰。

### **7.2 SDK 互操作性与语义注入**

Langfuse 本质上是一个 OTel 后端 9。它可以摄取由标准 OTel 库（如 opentelemetry-instrumentation-openai）生成的 Trace。然而，为了最大化 Langfuse 的价值（如关联 Prompt 版本、用户反馈），通常需要进行语义注入。

- **挑战:** 如果仅使用纯 OTel SDK，生成的 Span 缺乏 Langfuse 特有的元数据（如 langfuse.prompt_version, langfuse.user_id）。
- **解决方案:** 开发者可以在 OTel Span 中手动添加特定属性，或者使用 Langfuse SDK 提供的装饰器（如 @observe()），后者会自动处理这些上下文注入，确保在 Langfuse UI 中正确渲染 9。

### **7.3 安全与合规：PII 脱敏**

在金融和医疗领域，将包含用户敏感信息（PII）的完整 Prompt 发送到 Langfuse（尤其是 SaaS 版）可能违反合规要求。

- **Langfuse:** 提供了数据脱敏（Masking）功能，可以在 SDK 层或服务端对特定字段进行掩码处理 34。
- **Jaeger:** 作为一个通用的管道，也可以在 OTel Collector 层配置 attributes/redaction 处理器来清洗敏感数据，但这通常是全局性的配置，粒度较粗。

## **8. 性能极限与已知限制**

在选择工具时，必须清楚地认识到它们的性能边界。

### **8.1 吞吐量与延迟**

- **Jaeger:** 专为“高吞吐”设计。通过 Kafka 缓冲和 Cassandra 后端，它能够处理每秒数百万级的 Spans。其 UDP 代理模式对应用性能的影响微乎其微 1。
- **Langfuse:** 摄取通常基于 HTTP（尽管是异步的）。虽然 SDK 是非阻塞的，但在服务端，处理管道需要解析 Token、匹配定价模型、可能还需要运行评估逻辑，因此计算密度远高于 Jaeger。

### **8.2 规模化限制**

- **Langfuse 的 Node.js 堆内存问题:** 如前文所述 26，Langfuse 在处理单个包含数万个 Span 的分布式 Trace 时存在架构弱点。如果你的应用场景涉及极度复杂的长链 Agent（例如一个 Agent 循环运行数千次），Langfuse 的 Worker 可能会崩溃。建议对此类 Trace 进行截断或分段处理。
- **ClickHouse 的行大小限制:** 如果 Prompt 或 Context 极大（例如超过 ClickHouse 的默认行大小限制），Langfuse 会尝试截断数据，但这可能导致部分数据的丢失 26。

### **8.3 AI Gateway 的缺失**

Langfuse 和 Jaeger 都不是 AI Gateway 33。

- **限制:** 它们都是“旁路”观测工具。它们不能拦截请求进行实时限流、缓存或故障转移。
- **补充:** 如果需要这些功能，应引入专门的 AI Gateway（如 Portkey 或 Helicone），并将其遥测数据导入 Langfuse。

## **9. 战略决策框架**

组织应根据自身的发展阶段和技术栈特点做出选择。

### **9.1 场景 A：纯 LLM 初创公司 / 独立应用**

- **画像:** 构建 GenAI Wrapper、RAG 应用或垂直领域 Agent。没有复杂的遗留微服务资产。
- **建议:** **直接使用 Langfuse。**
- **理由:** 你立刻就需要 Token 成本追踪、Prompt 版本管理和质量评估。Jaeger 无法提供这些核心价值。Langfuse 的追踪功能对于调试简单的 Agent 链已经足够，且 Docker Compose 部署成本低。

### **9.2 场景 B：企业级平台团队 / 混合架构**

- **画像:** 银行、电商或 SaaS 巨头，拥有 500+ 微服务。正在现有应用中集成 GenAI 功能。
- **建议:** **采用“双栈”策略（使用 OTel Collector 分流）。**
- **理由:** 你不能抛弃 Jaeger，因为它是支付、鉴权和库存服务的监控基石。但 Jaeger 对“为什么机器人对客户无礼？”这类问题无能为力。将 LLM 相关的 Trace 路由给 Langfuse 供 AI 团队使用，同时将所有基础设施 Trace 保留在 Jaeger 中供 SRE 团队使用。

### **9.3 场景 C：安全/合规优先组织**

- **画像:** 涉及高度机密数据的金融/国防项目。严禁数据出境。
- **建议:** **自托管 Langfuse（需谨慎评估运维能力）或 仅使用 Jaeger。**
- **理由:** 两者均可自托管。如果你有 Elasticsearch 运维经验，Jaeger 是“设置即忘”的安全选择。如果你选择自托管 Langfuse，必须评估团队是否具备运维 ClickHouse 的能力。对于极度敏感的数据，Langfuse 的全量 Payload 捕获可能过于激进，需要配合严格的脱敏策略。

## **10. 结论**

Jaeger 和 Langfuse 代表了可观测性从**系统性能（System Performance）**向**系统行为（System Behavior）**进化的两个阶段。

**Jaeger** 是**“时间与拓扑”**的大师。它回答的问题是：_哪个服务变慢了？哪个数据库锁住了？网络瓶颈在哪里？_ 它是保障 AI 应用底层基础设施可靠性的基石。

**Langfuse** 是**“语境与质量”**的大师。它回答的问题是：_为什么模型产生了幻觉？这段对话花费了多少钱？Prompt V2 是否比 V1 更有效？_ 它是构建智能本身的工程化工具。

对于现代 AI 工程师而言，试图强行改造 Jaeger 去存储 LLM 属性，或者用 Langfuse 去监控高频的 Redis 调用，都是对工具特性的误用。通往生产级 GenAI 的最佳路径是构建一个共生的可观测性体系：以 OpenTelemetry 为桥梁，让 Jaeger 守护系统的**快与稳**，让 Langfuse 守护系统的**智与优**。

### **附录：核心特性对比总结表**

| 功能域           | Jaeger                           | Langfuse                                  |
| :--------------- | :------------------------------- | :---------------------------------------- |
| **核心实体**     | Span (时间绑定的操作)            | Generation (LLM 调用 + 元数据)            |
| **数据可视化**   | 甘特图, 服务依赖 DAG             | 聊天视图, Agent Graphs, 成本/Token 趋势图 |
| **搜索能力**     | 标签点查 (Tag-based)             | Prompt/Output 全文检索与向量检索          |
| **成本追踪**     | 不支持 (需二次开发)              | 原生支持 (自动 Token 计数与定价模型)      |
| **Prompt 工程**  | 不支持                           | 版本控制, 部署, A/B 测试, 回归测试        |
| **评估体系**     | 不支持                           | LLM-as-a-Judge, 人工标注与反馈            |
| **基础设施要求** | ElasticSearch/Cassandra + Kafka  | ClickHouse + Postgres + Redis             |
| **摄取协议**     | OTLP (gRPC/HTTP), Thrift, Zipkin | OTLP, Custom SDK API                      |
| **适用人群**     | SRE, 平台工程师, 后端开发        | AI 工程师, 产品经理, 提示词工程师         |

#### **Works cited**

1. Architecture | Jaeger, accessed January 13, 2026, [https://www.jaegertracing.io/docs/1.30/architecture/](https://www.jaegertracing.io/docs/1.30/architecture/)
2. Introduction - Jaeger, accessed January 13, 2026, [https://www.jaegertracing.io/docs/latest/](https://www.jaegertracing.io/docs/latest/)
3. What is Jaeger Tracing? - Dash0, accessed January 13, 2026, [https://www.dash0.com/knowledge/what-is-jaeger-tracing](https://www.dash0.com/knowledge/what-is-jaeger-tracing)
4. What is Jaeger? - Jaeger Tracing Explained - AWS, accessed January 13, 2026, [https://aws.amazon.com/what-is/jaeger/](https://aws.amazon.com/what-is/jaeger/)
5. Compare Jaeger vs. Langfuse in 2026, accessed January 13, 2026, [https://slashdot.org/software/comparison/Jaeger-vs-Langfuse/](https://slashdot.org/software/comparison/Jaeger-vs-Langfuse/)
6. Langfuse SDKs, accessed January 13, 2026, [https://langfuse.com/docs/observability/sdk/overview](https://langfuse.com/docs/observability/sdk/overview)
7. Langfuse.Generation — Langfuse v0.1.0 - Hexdocs, accessed January 13, 2026, [https://hexdocs.pm/langfuse/Langfuse.Generation.html](https://hexdocs.pm/langfuse/Langfuse.Generation.html)
8. Architecture - Jaeger, accessed January 13, 2026, [https://www.jaegertracing.io/docs/latest/architecture/](https://www.jaegertracing.io/docs/latest/architecture/)
9. Open Source LLM Observability via OpenTelemetry - Langfuse, accessed January 13, 2026, [https://langfuse.com/integrations/native/opentelemetry](https://langfuse.com/integrations/native/opentelemetry)
10. Architecture | Jaeger, accessed January 13, 2026, [https://www.jaegertracing.io/docs/1.76/architecture/](https://www.jaegertracing.io/docs/1.76/architecture/)
11. Deployment | Jaeger, accessed January 13, 2026, [https://www.jaegertracing.io/docs/1.dev/deployment/](https://www.jaegertracing.io/docs/1.dev/deployment/)
12. What Database does Jaeger Use - Elasticsearch vs Cassandra - SigNoz, accessed January 13, 2026, [https://signoz.io/guides/what-database-does-jaeger-use/](https://signoz.io/guides/what-database-does-jaeger-use/)
13. Architecture - Langfuse Handbook, accessed January 13, 2026, [https://langfuse.com/handbook/product-engineering/architecture](https://langfuse.com/handbook/product-engineering/architecture)
14. ClickHouse (self-hosted) - Langfuse, accessed January 13, 2026, [https://langfuse.com/self-hosting/deployment/infrastructure/clickhouse](https://langfuse.com/self-hosting/deployment/infrastructure/clickhouse)
15. ClickHouse (self-hosted) upgrade · langfuse · Discussion #10314 - GitHub, accessed January 13, 2026, [https://github.com/orgs/langfuse/discussions/10314](https://github.com/orgs/langfuse/discussions/10314)
16. ClickHouse Cloud - Langfuse Handbook, accessed January 13, 2026, [https://langfuse.com/handbook/product-engineering/infrastructure/clickhouse](https://langfuse.com/handbook/product-engineering/infrastructure/clickhouse)
17. Terminology | Jaeger, accessed January 13, 2026, [https://www.jaegertracing.io/docs/2.dev/architecture/terminology/](https://www.jaegertracing.io/docs/2.dev/architecture/terminology/)
18. AI-Powered Trace Analysis with Local LLM Support · Issue #7832 · jaegertracing/jaeger - GitHub, accessed January 13, 2026, [https://github.com/jaegertracing/jaeger/issues/7832](https://github.com/jaegertracing/jaeger/issues/7832)
19. Tracing Data Model in Langfuse, accessed January 13, 2026, [https://langfuse.com/docs/observability/data-model](https://langfuse.com/docs/observability/data-model)
20. Langfuse Documentation, accessed January 13, 2026, [https://langfuse.com/docs](https://langfuse.com/docs)
21. Semantic conventions for generative AI systems - OpenTelemetry, accessed January 13, 2026, [https://opentelemetry.io/docs/specs/semconv/gen-ai/](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
22. Observability by Design: Unlocking Consistency with OpenTelemetry Weaver, accessed January 13, 2026, [https://opentelemetry.io/blog/2025/otel-weaver/](https://opentelemetry.io/blog/2025/otel-weaver/)
23. OpenTelemetry Tracing Arrives in Envoy AI Gateway - Tetrate, accessed January 13, 2026, [https://tetrate.io/blog/opentelemetry-tracing-arrives-in-envoy-ai-gateway](https://tetrate.io/blog/opentelemetry-tracing-arrives-in-envoy-ai-gateway)
24. Jaeger | OpenShift Container Platform | 4.3 - Red Hat Documentation, accessed January 13, 2026, [https://docs.redhat.com/en/documentation/openshift_container_platform/4.3/html-single/jaeger/index](https://docs.redhat.com/en/documentation/openshift_container_platform/4.3/html-single/jaeger/index)
25. Mastering LLM Observability: A Hands-On Guide to Langfuse and OpenTelemetry Comparison | by Oleh Dubetcky, accessed January 13, 2026, [https://oleg-dubetcky.medium.com/mastering-llm-observability-a-hands-on-guide-to-langfuse-and-opentelemetry-comparison-33f63ce0a636](https://oleg-dubetcky.medium.com/mastering-llm-observability-a-hands-on-guide-to-langfuse-and-opentelemetry-comparison-33f63ce0a636)
26. bug: Distributed Tracing Failure with Large Number of Spans (~10K Observations per Trace) #10367 - GitHub, accessed January 13, 2026, [https://github.com/langfuse/langfuse/issues/10367](https://github.com/langfuse/langfuse/issues/10367)
27. LLM Observability & Application Tracing (open source) - Langfuse, accessed January 13, 2026, [https://langfuse.com/docs/observability/overview](https://langfuse.com/docs/observability/overview)
28. Langfuse vs Phoenix: Which One's the Better Open-Source Framework (Compared) - ZenML Blog, accessed January 13, 2026, [https://www.zenml.io/blog/langfuse-vs-phoenix](https://www.zenml.io/blog/langfuse-vs-phoenix)
29. Graph view for LangGraph traces - Langfuse, accessed January 13, 2026, [https://langfuse.com/changelog/2025-02-14-trace-graph-view](https://langfuse.com/changelog/2025-02-14-trace-graph-view)
30. Understanding Jaeger: From Basics to Advanced Distributed Tracing - Uptrace, accessed January 13, 2026, [https://uptrace.dev/glossary/what-is-jaeger](https://uptrace.dev/glossary/what-is-jaeger)
31. Link prompts to traces - Langfuse, accessed January 13, 2026, [https://langfuse.com/docs/prompt-management/features/link-to-traces](https://langfuse.com/docs/prompt-management/features/link-to-traces)
32. Observability via OpenTelemetry - Langfuse, accessed January 13, 2026, [https://langfuse.com/self-hosting/configuration/observability](https://langfuse.com/self-hosting/configuration/observability)
33. 8 Best Langfuse Alternatives to Trace, Evaluate, and Manage Prompts for Your LLM Application - ZenML Blog, accessed January 13, 2026, [https://www.zenml.io/blog/langfuse-alternatives](https://www.zenml.io/blog/langfuse-alternatives)
34. Advanced features of the Langfuse SDKs, accessed January 13, 2026, [https://langfuse.com/docs/observability/sdk/advanced-features](https://langfuse.com/docs/observability/sdk/advanced-features)
