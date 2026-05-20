# **腾讯 WeKnora 深度调研与同类 RAG 框架全维度对比分析报告**

## **1. 绪论：RAG 技术范式的演进与腾讯的战略入局**

在生成式人工智能（Generative AI）从早期的聊天娱乐向企业级生产力工具转型的过程中，检索增强生成（Retrieval-Augmented Generation, RAG）技术已确立为解决大语言模型（LLM）“幻觉”问题、打破知识截止时间限制以及实现私有数据价值化的核心架构范式。然而，随着企业应用场景的深化，第一代 RAG 系统（Naive RAG）所面临的痛点日益凸显：简单的文本分块（Chunking）破坏了文档的语义完整性，基于向量相似度的检索（Vector Search）无法处理复杂的逻辑推理，且 Python 主导的技术栈在面对高并发企业级负载时显露出性能瓶颈。

正是在这一背景下，腾讯于 2025 年推出了其重量级开源项目——**WeKnora**。作为一个基于 Go 语言构建的、集成了深度文档理解（Deep Document Understanding）与知识图谱增强（GraphRAG）的智能框架，WeKnora 的出现不仅是腾讯在 AI 基础设施层的重要布局，也标志着开源 RAG 框架进入了追求“深度语义”与“高性能工程化”并重的 RAG 3.0 时代。

本报告将对 WeKnora 进行详尽的解构，并将其置于当前竞争激烈的开源 RAG 市场中，与 **RAGFlow**（专注于深度解析）、**Dify**（专注于应用编排）、**FastGPT**（专注于高效问答）等头部竞品进行全方位的正交对比分析。报告旨在通过对技术架构、功能特性、工程实现及商业潜力的深度挖掘，为企业架构师、开发者及技术决策者提供一份体系化的调研参考。

## **2. 腾讯 WeKnora 深度解析：架构、核心能力与技术哲学**

WeKnora 被定义为“基于 LLM 的深度文档理解、语义检索和上下文感知问答框架”1。不同于市面上常见的基于 LangChain 简单封装的 RAG 工具，WeKnora 展现出了极强的“全栈自研”与“工程优先”的设计理念。其核心价值主张在于解决异构文档处理难、复杂问题推理弱以及系统部署资源重这三大行业痛点。

### **2.1 核心技术架构与设计理念**

WeKnora 采用了模块化的微服务架构，其设计哲学强调组件的“正交性”与“高内聚”。系统主要由以下几个核心层级构成：

#### **2.1.1 深度文档理解引擎（Deep Understanding Engine）**

这是 WeKnora 的技术护城河之一。传统的 RAG 系统往往使用通用的文本提取工具（如 PyPDF2），这会导致文档中的表格、多栏排版、页眉页脚等结构信息丢失，进而产生大量的“垃圾碎片”。WeKnora 引入了多模态预处理机制，旨在还原文档的“物理结构”与“逻辑语义” 2。

- **多格式支持**：原生支持 PDF、Word (DOCX)、Excel (XLSX)、PowerPoint (PPTX)、Markdown、TXT 以及各类图像格式。
- **结构化解析**：系统内置了类似于 OCR 与版面分析（Layout Analysis）的能力，能够识别文档中的标题层级、段落边界以及最为棘手的表格数据。通过将表格还原为结构化数据而非纯文本，WeKnora 确保了数值类问题（如“2024 年 Q3 的营收是多少？”）的检索精度。
- **多模态融合**：对于包含图表的文档，WeKnora 利用多模态大模型（如 GPT-4V 或开源的 LLaVA 类模型）生成图片摘要（Captioning），将视觉信息转化为可检索的文本向量，从而实现了对图文混排文档的真正理解。

#### **2.1.2 混合检索与 GraphRAG 引擎**

在检索层，WeKnora 摒弃了单一的向量检索路径，构建了一套复杂的混合检索流水线（Hybrid Retrieval Pipeline），并前瞻性地内置了 GraphRAG 能力 3。

- **正交组合策略**：系统同时运行基于 BM25 的稀疏检索（关键词匹配）和基于 Embedding 的稠密检索（向量匹配）。BM25 擅长捕捉精确的专有名词（如产品型号、人名），而向量检索擅长捕捉语义相关性。两者结果通过 Rerank 模型（重排序）进行加权融合，显著提升了召回率（Recall）和准确率（Precision）。
- **GraphRAG（图增强检索）**：这是 WeKnora 区别于大多数竞品的杀手锏。在索引构建阶段，系统利用 LLM 自动抽取文档中的实体（Entity）与关系（Relation），构建局部的知识图谱。在检索阶段，系统不仅召回相关的文本块，还会执行图遍历（Graph Traversal），寻找实体间的多跳关系（Multi-hop Relations）。这种机制使得 WeKnora 能够回答“A 公司和 B 公司之间有什么潜在的商业关联？”这类需要全局视角和逻辑推理的复杂问题，有效缓解了传统 RAG 的“碎片化”缺陷。

#### **2.1.3 Agent 编排与 MCP 协议支持**

WeKnora 不仅仅是一个问答引擎，更是一个 Agent 框架。

- **ReACT 范式**：引入了 ReACT（Reasoning and Acting）模式，使模型具备了“思考-行动-观察”的闭环能力。Agent 可以自主规划任务步骤，例如先检索知识库，发现信息不足时再调用联网搜索工具 3。
- **MCP (Model Context Protocol) 原生支持**：这是 WeKnora 极具战略眼光的一步。MCP 是由 Anthropic 等推动的下一代 AI 连接标准，旨在标准化 LLM 与外部数据/工具的交互。通过原生支持 MCP，WeKnora 可以无缝接入任何兼容 MCP 标准的工具（如连接本地文件系统、数据库、Slack、GitHub 等），极大地扩展了其能力边界，而无需像传统平台那样维护海量的私有插件代码 1。

### **2.2 工程实现：Go 语言的性能红利**

在 Python 占据 AI 应用层 90% 市场份额的当下，WeKnora 选择了 **Go (Golang)** 作为其后端核心语言 4。这一技术选型具有深远的工程意义：

- **高并发与低延迟**：Go 语言的 Goroutine 机制使其在处理高并发网络请求（I/O 密集型任务）时具有天然优势。对于 RAG 网关而言，需要同时处理大量的文档上传、向量数据库查询、LLM API 调用，Go 的性能表现远优于受限于 GIL（全局解释器锁）的 Python 6。
- **部署便捷性**：WeKnora 可以编译为单个二进制文件，零依赖部署。相比之下，基于 Python 的系统往往需要复杂的虚拟环境管理（Conda/Venv）和大量的依赖包安装，这在企业内网或边缘计算场景下是一个巨大的运维负担。
- **内存效率**：Go 的内存管理机制使得 WeKnora 在同等负载下的内存占用显著低于 Python 竞品，这对于资源受限的私有化部署环境尤为重要。

## **3. 竞品生态扫描与深度剖析**

为了更精准地定位 WeKnora 的市场坐标，我们需要详细剖析当前开源 RAG 领域的三大标杆项目：**RAGFlow**、**Dify** 和 **FastGPT**。

### **3.1 RAGFlow：深度文档理解的极致标杆**

由 Infiniflow 团队开发的 RAGFlow 是目前开源界在“文档解析”领域的绝对王者。

- **核心特质**：RAGFlow 的核心是其 **DeepDoc** 引擎。不同于基于规则或简单 OCR 的解析器，DeepDoc 采用基于视觉（Vision-based）的深度学习模型（如 YOLOv8）对文档进行版面分析（Layout Analysis）。它像人类阅读一样，先识别页面中的标题、段落、表格、图片区域，再进行针对性的内容提取 8。
- **优势**：对于排版混乱的 PDF、扫描件、复杂报表，RAGFlow 的解析还原度极高，能够保留文档的物理结构。其“模板化分块”（Template-based Chunking）功能允许用户针对简历、论文、财报选择特定的解析模板，极大提升了数据质量。
- **劣势**：为了支撑深度解析，RAGFlow 的架构极其厚重，依赖 Elasticsearch、MinIO、MySQL、Redis 等多个组件，且深度解析任务对 CPU/GPU 资源消耗巨大，部署维护成本较高 10。

### **3.2 Dify：应用编排与生态的集大成者**

LangGenius 推出的 Dify 是目前 GitHub Star 数最高（126k+）的 LLM 应用开发平台，是“RAG + Workflow”路线的代表 11。

- **核心特质**：Dify 的护城河在于其强大的**可视化工作流编排（Visual Workflow Orchestration）**。它提供了一个画布，允许用户通过拖拽节点（Node）来构建包含分支逻辑、循环、条件判断的复杂 AI 应用。同时，Dify 拥有极其丰富的插件生态和模型支持。
- **优势**：极低的使用门槛，非技术人员（如产品经理、运营）也能快速上手构建 AI 助手。生态完善，社区活跃度极高。
- **劣势**：在文档解析的深度上相对基础，主要依赖开源库或外部 API，对于复杂非结构化数据的处理能力不如 RAGFlow 和 WeKnora。其 Python 技术栈在高并发场景下面临性能挑战。

### **3.3 FastGPT：高效知识库问答的务实派**

LabRing 团队开发的 FastGPT 专注于“快速构建知识库问答系统”这一具体场景，拥有广泛的国内用户基础 12。

- **核心特质**：FastGPT 强调“开箱即用”和“极简体验”。它通过可视化的 Flow 编排实现了问答逻辑的定制，但相比 Dify 更专注于 QA 场景。其底层的向量检索和重排序流程经过高度优化，响应速度快。
- **优势**：部署简单，操作界面直观，适合中小企业快速搭建客服机器人或内部知识库。
- **劣势**：功能边界相对较窄，缺乏深度文档解析和 GraphRAG 等高级特性，通用性不如 Dify，深度不如 WeKnora。

## **4. 全维度正交对比分析**

基于上述调研，我们将从五个关键维度对 WeKnora 与竞品进行正交对比。

### **4.1 维度一：深度文档理解与解析能力 (Deep Document Understanding)**

这是决定 RAG 系统“天花板”的核心维度，即“Garbage In, Garbage Out”定律的源头。

| 特性指标         | Tencent WeKnora                                                                             | RAGFlow                                                                | Dify                                                          | FastGPT                                            |
| :--------------- | :------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------- | :------------------------------------------------------------ | :------------------------------------------------- |
| **核心解析技术** | **多模态解析引擎**。结合规则解析与 OCR，强调结构化还原。                                    | **DeepDoc (Vision-based)**。基于 YOLOv8 的视觉版面分析，像素级理解 8。 | **标准解析器**。基于 Unstructured/LangChain，主要处理文本流。 | **基础提取**。依赖外部库，近期有所增强但仍偏基础。 |
| **复杂表格处理** | **强**。支持表格结构重建，保留行列关系。                                                    | **极强 (SOTA)**。专门针对跨页表格、合并单元格优化，还原度业界领先。    | **弱/中**。通常将表格展平为文本，丢失结构语义。               | **中**。支持结构化数据导入，PDF 内嵌表格解析一般。 |
| **分块策略**     | **语义 + 版面**。基于语义完整性和版面层级进行分块。                                         | **模板化分块**。提供简历、论文、发票等预设模板，人工干预少 13。        | **规则 + 语义**。按字符数截断或语义分割。                     | **规则分块**。主要基于 CSV/QA 对或段落。           |
| **评价**         | WeKnora 在解析深度上明显优于 Dify 和 FastGPT，力求在效率与 RAGFlow 的极致精度之间寻找平衡。 | RAGFlow 是解析质量的绝对标杆，适合数据清洗环节。                       | Dify 和 FastGPT 更适合处理经过预清洗的规范文档。              | FastGPT 胜在简单，适合标准 FAQ。                   |

### **4.2 维度二：检索增强与知识图谱 (Retrieval Strategy & GraphRAG)**

这是 RAG 3.0 时代的核心竞争点，决定了系统能否进行“推理”。

| 特性指标          | Tencent WeKnora                                                                                                                                                         | RAGFlow                                                                          | Dify                                                               | FastGPT                    |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- | :----------------------------------------------------------------- | :------------------------- |
| **检索模式**      | **混合检索 + GraphRAG**。                                                                                                                                               | **混合检索 + GraphRAG**。                                                        | **混合检索 + Rerank**。                                            | **混合检索 + Rerank**。    |
| **GraphRAG 实现** | **原生内置**。索引时自动提取实体关系建图，检索时执行子图遍历 2。                                                                                                        | **原生支持**。引入社区检测（Community Detection）和实体去重，生成社区摘要 14。   | **插件扩展**。无原生支持，需通过 InfraNodus 等插件或 API 实现 16。 | **无**。依赖向量相似度。   |
| **多跳推理能力**  | **高**。通过图谱链接隐性关系，支持跨文档推理。                                                                                                                          | **高**。通过社区摘要提供宏观视角。                                               | **中**。依赖 LLM 自身的上下文窗口推理，缺乏结构化索引支持。        | **低**。主要基于片段匹配。 |
| **评价**          | WeKnora 和 RAGFlow 是 GraphRAG 的先行者。WeKnora 将 GraphRAG 内置化，降低了使用门槛，使其成为标准检索流水线的一部分，这对于法律、金融等需要严谨逻辑链条的场景至关重要。 | RAGFlow 的 GraphRAG 实现深受微软研究影响，强调全局理解（Global Understanding）。 | Dify 目前通过插件生态补齐，增加了集成复杂度。                      | FastGPT 暂缺此能力。       |

### **4.3 维度三：编排能力与 Agent 生态 (Orchestration & Agents)**

| 特性指标     | Tencent WeKnora                                                                                                                                                                                                     | Dify                                                           | FastGPT                                   | RAGFlow                                        |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------- | :---------------------------------------- | :--------------------------------------------- |
| **编排范式** | **ReACT Agent + MCP**。模型自主规划，配置式开发。                                                                                                                                                                   | **Visual Workflow (DAG)**。强大的拖拽式画布，逻辑控制丰富 18。 | **Visual Flow**。专注 QA 逻辑，线性为主。 | **Agentic Workflow**。可视化编排，处于成长期。 |
| **工具协议** | **MCP (Model Context Protocol)**。原生支持，标准化连接万物 1。                                                                                                                                                      | **私有插件标准**。生态丰富，但封闭。                           | **插件/API**。                            | **自定义工具**。                               |
| **用户画像** | **开发者/架构师**。更适合通过代码和配置定义复杂行为。                                                                                                                                                               | **业务人员/PM**。所见即所得，零代码友好。                      | **业务人员/运营**。                       | **数据工程师**。                               |
| **评价**     | Dify 是编排体验的巅峰，适合快速原型开发和业务落地。WeKnora 选择了一条更具未来感的 **MCP 路线**，它赌的是 Agent 的未来在于通用协议而非私有生态。随着 Claude 等巨头推动 MCP，WeKnora 的工具扩展能力将呈现指数级增长。 |                                                                |                                           |                                                |

### **4.4 维度四：工程架构与性能表现 (Engineering & Performance)**

| 特性指标       | Tencent WeKnora                                                                                                                                                                                                      | RAGFlow                                              | Dify                                       | FastGPT                                         |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- | :----------------------------------------- | :---------------------------------------------- |
| **后端技术栈** | **Go (Golang)** 4。                                                                                                                                                                                                  | Python。                                             | Python (Flask/Celery)。                    | TypeScript (Node.js)。                          |
| **并发性能**   | **极高**。Go Routine 处理高并发 I/O 游刃有余，延迟低。                                                                                                                                                               | **低**。受限于 Python GIL 和重型架构，并发需堆硬件。 | **中**。典型 Python Web 性能，需水平扩展。 | **中/高**。Node.js I/O 性能优秀，适合即时通讯。 |
| **资源占用**   | **低**。编译型语言，内存管理高效。                                                                                                                                                                                   | **极高**。深度学习模型 + ES + Python，内存大户。     | **中**。                                   | **低**。                                        |
| **部署复杂度** | **低**。单二进制文件 + 基础中间件。                                                                                                                                                                                  | **极高**。组件繁多，Docker Compose 庞大 10。         | **中**。组件较多。                         | **低**。                                        |
| **评价**       | **WeKnora 的 Go 架构是其核心差异化优势**。在企业私有化部署中，服务器成本是重要考量。WeKnora 能在更低配的硬件上提供更高的吞吐量，且维护成本显著降低。RAGFlow 的重型架构使其更像一个“数据处理工厂”而非“在线服务网关”。 |                                                      |                                            |                                                 |

### **4.5 维度五：开源协议与商业化 (License)**

| 特性指标     | Tencent WeKnora                                                                                                                                                                                                                                     | RAGFlow          | Dify                                      | FastGPT                                   |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- | :---------------------------------------- | :---------------------------------------- |
| **开源协议** | **MIT License** 1。                                                                                                                                                                                                                                 | **Apache 2.0**。 | **Apache 2.0 + 附加条款**。               | **Apache 2.0 + 附加条款**。               |
| **商业限制** | **极其宽松**。允许闭源商用、集成、SaaS 化。                                                                                                                                                                                                         | **宽松**。       | **有限制**。禁止未经授权的 SaaS 运营 19。 | **有限制**。禁止未经授权的 SaaS 运营 20。 |
| **评价**     | **WeKnora 的 MIT 协议展现了腾讯作为大厂的开放姿态**。这使得 WeKnora 成为 ISV（独立软件开发商）和集成商的理想选择，他们可以放心地将 WeKnora 内嵌到自己的商业产品中而无后顾之忧。FastGPT 和 Dify 的防御性条款则更多是为了保护其官方云服务的商业利益。 |                  |                                           |                                           |

## **5. 场景化选型与落地建议**

基于上述技术特性的深度剖析，我们为不同需求的企业提供以下选型建议：

### **5.1 场景一：构建高性能企业级知识中台**

- **需求**：企业内部存在海量异构文档（PDF、Office），需要构建统一的知识检索服务，对接内部多个业务系统（如 OA、IM、CRM）。对系统响应速度、并发能力有高要求，且已有 Go 语言运维经验。
- **推荐方案**：**Tencent WeKnora**。
- **理由**：Go 语言的高性能后端能够支撑企业级并发；混合检索与 GraphRAG 保证了检索的高查准率；MIT 协议允许企业进行深度的定制开发和集成；MCP 协议支持未来扩展更多企业内部工具。

### **5.2 场景二：非结构化数据清洗与情报分析**

- **需求**：主要任务是处理极其复杂的非结构化数据，如扫描版合同、复杂的财务报表、工程图纸。需要尽可能无损地提取信息。
- **推荐方案**：**RAGFlow**。
- **理由**：在“读懂文档”这件事上，RAGFlow 的 DeepDoc 引擎无可替代。建议将其作为离线的数据处理流水线，清洗后的数据可导入其他系统或直接使用。

### **5.3 场景三：快速搭建 AI 客服与营销助手**

- **需求**：业务部门主导，无专业开发团队。需要快速上线一个对外服务的 AI 客服，要求界面美观、支持人工干预、易于维护。
- **推荐方案**：**Dify** 或 **FastGPT**。
- **理由**：Dify 的可视化编排让业务人员可以像搭积木一样设计话术流程；FastGPT 的知识库管理极其直观。两者的 SaaS 版本或开源版都能实现分钟级上线。

### **5.4 场景四：ISV 集成与二次开发**

- **需求**：软件开发商希望在自己的 ERP/CRM 产品中增加“与数据对话”的功能，需要一个轻量、无版权风险的 RAG 引擎作为子模块。
- **推荐方案**：**Tencent WeKnora**。
- **理由**：MIT 协议无商业限制；架构轻量易集成；Go 语言便于分发；API 接口规范。

## **6. 深度洞察与未来展望**

### **6.1 从“Chat with File”到“Chat with Knowledge”**

WeKnora 和 RAGFlow 对 GraphRAG 的原生支持，标志着 RAG 技术正在跨越“概率性检索”的局限，迈向“结构化认知”的新阶段。未来的 RAG 系统不仅要能找到“相关的片段”，更要能通过知识图谱解释“为什么相关”以及“实体间的隐性关联”。这种 **Neuro-Symbolic（神经符号主义）** 的融合是实现可信 AI（Trustworthy AI）的关键路径。

### **6.2 AI 基础设施的“语言迁徙”**

长期以来，Python 垄断了 AI 领域。但随着 AI 从“模型训练”走向“工程落地”，对系统吞吐量、资源效率的要求日益严苛。WeKnora 的出现可能预示着 AI 应用层基础设施（Infra）将逐渐向 Go 或 Rust 等高性能语言迁移。特别是在 Serverless 和边缘计算场景下，Go 的冷启动优势将成为决定性因素。

### **6.3 MCP 协议的生态爆发**

WeKnora 对 MCP 的支持是其最具战略眼光的一步。随着 LLM 越来越像一个“操作系统内核”，MCP 就是连接应用层的“USB 接口”。WeKnora 实际上定位为一个通用的 **Agent OS**，通过标准协议连接万物。这比 Dify 自建封闭插件生态的路径更具爆发力，一旦 MCP 生态成熟，WeKnora 将不战而胜。

## **7. 结语**

Tencent WeKnora 的发布，不仅仅是腾讯在开源领域的一次“秀肌肉”，更是对当前 RAG 技术发展路径的一次有力修正。它在 RAGFlow 的“深度解析”和 Dify 的“应用编排”之间找到了一条独特的中间路线：**以 Go 语言构建高性能底座，以 GraphRAG 强化深度认知，以 MCP 协议连接广阔生态。**

对于开发者而言，WeKnora 提供了一个简洁、高效且自由的开发基座；对于企业而言，它是构建私有化、数据安全且具备复杂推理能力的知识引擎的理想选择。尽管在社区生态和可视化体验上仍有提升空间，但凭借其扎实的技术架构和前瞻的设计理念，WeKnora 有望在 2026 年成为企业级 RAG 领域的头部玩家，引领 RAG 3.0 时代的工程化变革。

**调研评级：强烈推荐关注。特别是对于追求高性能工程架构与深度知识推理的团队，WeKnora 是目前开源市场上不可多得的优质选项。**

#### **Works cited**

1. Tencent/WeKnora: LLM-powered framework for deep document understanding, semantic retrieval, and context-aware answers using RAG paradigm. - GitHub, accessed January 14, 2026, [https://github.com/Tencent/WeKnora](https://github.com/Tencent/WeKnora)
2. WeKnora — an open-source document understanding and retrieval framework from … - Jimmy Song, accessed January 14, 2026, [https://jimmysong.io/ai/weknora/](https://jimmysong.io/ai/weknora/)
3. WeKnora Talking Documents - YouTube, accessed January 14, 2026, [https://www.youtube.com/watch?v=SQYmI5j1l98](https://www.youtube.com/watch?v=SQYmI5j1l98)
4. github.com/Tencent/WeKnora | Go | Open Source Insights, accessed January 14, 2026, [https://deps.dev/go/github.com%2FTencent%2FWeKnora/v0.0.0-20250908101625-58aa31d86760](https://deps.dev/go/github.com%2FTencent%2FWeKnora/v0.0.0-20250908101625-58aa31d86760)
5. Github-Ranking-AI, accessed January 14, 2026, [https://yuxiaopeng.com/Github-Ranking-AI/Top100/RAG.html](https://yuxiaopeng.com/Github-Ranking-AI/Top100/RAG.html)
6. Go vs Python: Pick the Language for Your Project | Guide 2025 - Mobilunity, accessed January 14, 2026, [https://mobilunity.com/blog/golang-vs-python/](https://mobilunity.com/blog/golang-vs-python/)
7. Integrating Go with Python/FastAPI for Performance: Worth the Hassle? : r/golang - Reddit, accessed January 14, 2026, [https://www.reddit.com/r/golang/comments/1bi1o0d/integrating_go_with_pythonfastapi_for_performance/](https://www.reddit.com/r/golang/comments/1bi1o0d/integrating_go_with_pythonfastapi_for_performance/)
8. ragflow/deepdoc/README.md at main - GitHub, accessed January 14, 2026, [https://github.com/infiniflow/ragflow/blob/main/deepdoc/README.md](https://github.com/infiniflow/ragflow/blob/main/deepdoc/README.md)
9. Apparently "deep document understanding" refers to OCR and structured document p... | Hacker News, accessed January 14, 2026, [https://news.ycombinator.com/item?id=39897959](https://news.ycombinator.com/item?id=39897959)
10. Get started - RAGFlow, accessed January 14, 2026, [https://ragflow.io/docs/](https://ragflow.io/docs/)
11. langgenius/dify: Production-ready platform for agentic workflow development. - GitHub, accessed January 14, 2026, [https://github.com/langgenius/dify](https://github.com/langgenius/dify)
12. Pull requests · labring/FastGPT - GitHub, accessed January 14, 2026, [https://github.com/labring/FastGPT/pulls](https://github.com/labring/FastGPT/pulls)
13. RAGFlow is a leading open-source Retrieval-Augmented Generation (RAG) engine that fuses cutting-edge RAG with Agent capabilities to create a superior context layer for LLMs - GitHub, accessed January 14, 2026, [https://github.com/infiniflow/ragflow](https://github.com/infiniflow/ragflow)
14. Welcome - GraphRAG, accessed January 14, 2026, [https://microsoft.github.io/graphrag/](https://microsoft.github.io/graphrag/)
15. How Our GraphRAG Reveals the Hidden Relationships of Jon Snow and the Mother of Dragons | RAGFlow, accessed January 14, 2026, [https://ragflow.io/blog/ragflow-support-graphrag](https://ragflow.io/blog/ragflow-support-graphrag)
16. Graph RAG · langgenius dify · Discussion #25289 - GitHub, accessed January 14, 2026, [https://github.com/langgenius/dify/discussions/25289](https://github.com/langgenius/dify/discussions/25289)
17. Dify x Brave Search: Supercharging AI Apps with Real-Time Search - Dify Blog, accessed January 14, 2026, [https://dify.ai/blog/dify-x-brave-search-supercharging-ai-apps-with-real-time-search](https://dify.ai/blog/dify-x-brave-search-supercharging-ai-apps-with-real-time-search)
18. Knowledge - Dify Docs, accessed January 14, 2026, [https://docs.dify.ai/en/guides/knowledge-base/readme](https://docs.dify.ai/en/guides/knowledge-base/readme)
19. dify/LICENSE at main · langgenius/dify - GitHub, accessed January 14, 2026, [https://github.com/langgenius/dify/blob/main/LICENSE](https://github.com/langgenius/dify/blob/main/LICENSE)
20. FastGPT/README_en.md at main - GitHub, accessed January 14, 2026, [https://github.com/labring/FastGPT/blob/main/README_en.md](https://github.com/labring/FastGPT/blob/main/README_en.md)
