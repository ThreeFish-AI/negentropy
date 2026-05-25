---
id: context-engineering
sidebar_position: 1
title: Context Engineering 通俗全解
last_update:
  author: Aurelius Huang
  created_at: 2025-12-19
  updated_at: 2026-05-22
  version: 1.5
  status: Reviewed
tags:
  - Context Engineering
  - 学术论文
  - 主流框架
---

> [!IMPORTANT]
>
> **Context Engineering（上下文工程）** 是构建可靠、可扩展 AI Agent 系统的核心学科，是 AI Agent 系统从"玩具"迈向"生产"的关键技术。
>
> 它从传统的"写 Prompt"演进为**系统性地设计和优化 AI 系统运行时所需的整个动态信息生态系统**——涵盖上下文（**Context**）的收集（**Collection**）、管理（**Management**）和使用（**Usage**）。是一个涉及记忆系统（**Memory**）、会话管理（**Session**）、状态持久化（**Persistence**）、知识检索（**RAG**）等模块的完整架构问题。

> [!NOTE]
>
> 本报告核心内容：
>
> - **理论框架**：从 Dey (2001) 的定义到 SII-GAIR (2025) 的形式化演进
> - **三大支柱**：Context 的 Collection、Management、Usage 完整技术栈
> - **框架横比**：Google ADK、Agno、LangGraph 的实现策略
> - **项目实践**：复刻 Vertex AI Agent Engine 的 `SessionService` 和 `MemoryService`，构建 Context Assembler 组件，集成至 Google ADK 框架
>
> **本调研基于**：
>
> - **学术论文**：
>   - 《Context Engineering 2.0: The Context of Context Engineering》<sup>[[1]](#ref1)</sup>
>   - 《Understanding and Using Context》<sup>[[2]](#ref2)</sup>
> - **主流框架**：
>   - Google ADK<sup>[[3]](#ref3)</sup><sup>[[4]](#ref4)</sup><sup>[[5]](#ref5)</sup><sup>[[6]](#ref6)</sup>
>   - Agno<sup>[[7]](#ref7)</sup><sup>[[8]](#ref8)</sup><sup>[[9]](#ref9)</sup>
>   - LangChain<sup>[[11]](#ref11)</sup>
>   - LangGraph<sup>[[11]](#ref11)</sup><sup>[[12]](#ref12)</sup>

---

## 1. Context Engineering 的学术定义

### 1.1 历史溯源

Context Engineering 并非 Agent 时代的新发明。根据 Dey (2001) 的开创性工作<sup>[[2]](#ref2)</sup>，早在 2000 年代初期，研究者就已经在探索"上下文感知计算"（Context-Aware Computing）。

> [!NOTE]
>
> **Context-Aware Computing**
>
> "Context is a poorly used source of information in our computing environments. As a result, we have an impoverished understanding of what context is and how it can be used." — Dey<sup>[[2]](#ref2)</sup>
>
> ---
>
> 在我们的计算环境中，上下文这一信息来源被使用得不够充分。因此，我们对于“上下文”究竟是什么以及如何运用它，都缺乏深入的理解。

> [!NOTE]
>
> **Dey 的定义 (2001)**
>
> **Context** is any information that can be used to characterize the situation of an entity. An entity is a person, place, or object that is considered relevant to the interaction between a user and an application, including the user and applications themselves.
>
> ---
>
> 上下文是任何可以用来描述实体情况的信息。实体可以是人、地点或对象，这些实体被认为与用户和应用程序间的交互是相关的，包括用户和应用程序本身。

### 1.2 核心定义

SII-GAIR 论文《Context Engineering 2.0: The Context of Context Engineering》<sup>[[1]](#ref1)</sup> 对 Context Engineering 给定了严谨的形式化定义：

> [!NOTE]
>
> **Context**
>
> 对于给定的用户 - 应用的交互，上下文 $C$ 的定义为：
>
> $$
>   C = \bigcup_{e \in E_{rel}} Char(e)
> $$
>
> **其中**：
>
> - $E$ —— **全部实体的集合**（类比：图书馆里的所有书籍）
> - $E_{rel} \subseteq E$ —— **与当前交互相关的实体子集**（类比：与当前问题相关的书籍）
> - $Char(e)$ —— **描述实体 $e$ 的信息集合**（类比：每本书的内容摘要、标签、作者等元信息）
> - $\bigcup$ —— **并集操作**（类比：把所有相关书籍的信息汇总在一起）
>
> 想象你是一位图书馆管理员，读者问你一个问题。你不会把整个图书馆的书都搬出来（$E$），而是只挑选与问题相关的书籍（$E_{rel}$），然后从每本书中提取关键信息（$Char(e)$），最后把这些信息汇总成一份回答（$C$）。
>
> **解读**：上下文 $C$ 是"可用于描述与用户和应用之间交互相关的实体情况的任何信息"。这包括用户输入、应用配置、环境状态、外部工具、记忆模块等。

> [!NOTE]
>
> **Context Engineering**
>
> 拥有了上下文（原材料）还不够，Context Engineering 是根据当前任务（$T$），对原始上下文（$C$）进行加工的一系列**工艺流程**（$f_{context}$：优化后的上下文处理函数）：
>
> $$
>   CE: (C, T) \rightarrow f_{context}
> $$
>
> **形式化定义**：
>
> $$
>   f_{context}(C) = F(\phi_1, \phi_2, \ldots, \phi_n)(C)
> $$
>
> 函数 $F$ 组合了多种操作 $\phi_i$：收集、存储、表示、多模态处理、复用、选择、共享及动态调整：
>
> - 通过传感器或其他渠道**收集**相关上下文信息
> - 高效地**存储和管理**上下文
> - 以一致且可互操作的格式**表示**上下文
> - 处理来自文本、音频、视觉的**多模态**输入
> - **集成和复用**过去的上下文（"Self-baking"）
> - **选择**最相关的上下文元素
> - 跨 Agent 或系统**共享**上下文
> - 基于反馈或学习模式**动态调整**上下文

### 1.3 发展阶段

可以把 Context Engineering 看作是 Agent 与人类沟通的艺术，这门艺术正经历着从笨拙的指令沟通到心有灵犀的进化。

论文 [[1]](#ref1) 将 Context Engineering 划分为四个时代：

```mermaid
gantt
    title Context Engineering 发展时代
    dateFormat YYYY
    section Era 1.0
    原始计算时代 (刚性/预定义格式) :done, 1990, 2020
    section Era 2.0
    Agent-Centric 时代 (自然语言/动态上下文) :active, 2020, 2030
    section Era 3.0
    Human-Level 智能 (深度意图理解) :2030, 2040
    section Era 4.0
    Superhuman 智能 (人机角色反转) :2040, 2050
```

| 时代        | 时间范围   | 智能水平                  | Context Engineering 特征                 | 角色的进化                                                                                        |
| :---------- | :--------- | :------------------------ | :--------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **Era 1.0** | 1990s-2020 | 原始计算，被动执行者      | 刚性、预定义格式（菜单选择、传感器输入） | 上下文作为"翻译"<br/>**呆板机器人**：只能听懂特定指令（"开灯"），说"太黑了"它会报错。             |
| **Era 2.0** | 2020-至今  | Agent-Centric，主动智能体 | 自然语言理解、推断隐含意图、动态上下文   | 上下文作为"指令"<br/>**聪明实习生**：能听懂"太黑了"是指要开灯，但记性不好，需要反复提醒背景信息。 |
| Era 3.0     | 未来       | Human-Level，可靠协作者   | 深度意图理解、最小显式上下文需求         | 上下文作为"场景"<br/>**默契老管家**：深度意图理解。不用你开口，看你眉头一皱就知道该倒茶了。       |
| Era 4.0     | 推测       | Superhuman，体贴的主人    | 机器引导人类、人机角色反转               | 上下文作为"世界"<br/>**人生导师**：比你更懂你自己。在你意识到之前，就主动为你规划最优路径。       |

> [!TIP]
>
> 智能越高 → 上下文处理能力越强 → 人机交互成本越低
>
> **当前挑战 (Era 2.0)**：
>
> - 理解自然语言输入
> - 推断隐含意图
> - 处理不完整信息
> - 在有限的 Context Window 中做出最优选择
>
> 核心任务是培养这位"聪明实习生"，让他**记性更好（Memory）、反应更准（Intent Inference）、干活更利索（Token Efficiency）**。

> [!TIP]
>
> **未来挑战 (Era 3.0)**：
>
> - **终身上下文保存**：如何可靠存储用户一生的交互上下文？
> - **语义一致性**：随着数据规模膨胀，如何保持语义的准确性？
> - **动态更新**：如何处理过时信息和知识冲突？
> - **隐私与安全**：如何在保护用户隐私的同时提供个性化服务？
>
> 如何保存用户**一生的上下文**？当数据量爆炸时，如何保证"管家"不产生幻觉？以及最关键的——如何确保它永远忠诚（隐私与安全）？

## 2. Context Engineering 的理论基础

要打造具备"默契老管家"特质的 Agent，我们不能只关注 Prompt 编写（Era 1.0 的思维），而必须构建完整的上下文生命周期。基于论文 [[1]](#ref1) 的定义与主流框架的最佳实践，Context Engineering 被系统性地解构为以下三大核心维度：

```mermaid
graph LR
    subgraph CE["🧠 Context Engineering"]
        subgraph Context Usage[上下文使用]
            CU["🔍 Usage<br>上下文使用"]
            CU --> CU1["语义检索"]
            CU --> CU2["意图推断"]
            CU --> CU3["动态组装"]
        end

        subgraph Context Management[上下文管理]
            CM["📦 Management<br>上下文管理"]
            CM --> CM1["分层记忆架构"]
            CM --> CM2["上下文压缩"]
            CM --> CM3["上下文隔离"]
            CM --> CM4["持久化存储"]
            CM --> CM5[多模态处理]
        end

        subgraph Context Collection[上下文收集]
            CC["📥 Collection<br>上下文收集 - 环境感知"]
            CC --> CC1["用户输入"]
            CC --> CC2["系统指令"]
            CC --> CC3["对话历史"]
            CC --> CC4["外部数据/RAG"]
            CC --> CC5["工具定义"]
            CC --> CC6[跨模态信息]
        end
    end

    style CC fill:#065f46,stroke:#34d399,color:#fff
    style CM fill:#7c2d12,stroke:#fb923c,color:#fff
    style CU fill:#581c87,stroke:#c084fc,color:#fff
```

### 2.1 Context Collection

作为上下文流转的第一站，**Context Collection（上下文收集）** 负责构建 Agent 的"感知世界"，解决"数据从何而来"的问题。

> [!TIP]
>
> **Context Collection：大厨备菜**
>
> 想象现在 Agent 是一位**大厨**，Context Collection 就是**在开火（推理）前汇集所有素材的过程**：既要听清客人的点单（**User Input**），又要遵循餐厅的烹饪 SOP（**System Instructions**），还得从储藏室取回陈年秘制酱料（**Memory**）和时令鲜蔬（**RAG**）。

这些"素材"主要来源于：

| 来源               | 描述                           | 框架实现示例                                                |
| :----------------- | :----------------------------- | :---------------------------------------------------------- |
| **用户输入**       | 当前任务或查询                 | ADK `user message`, Agno `input`                            |
| **系统指令**       | 规则、角色、行为准则           | ADK `system_instruction`, Agno `description`+`instructions` |
| **对话历史**       | 当前会话的短期记忆             | ADK `session.events`, Agno `chat_history`                   |
| **长期记忆**       | 跨会话的持久信息               | ADK `MemoryService`, Agno `enable_user_memories`            |
| **外部数据 (RAG)** | 实时获取的知识                 | LangChain `VectorStoreRetriever`, Agno `Knowledge`          |
| **工具定义**       | 可用工具的描述和格式           | ADK `FunctionTool`, Agno `tools`                            |
| **输出格式**       | 响应结构规范（如 JSON Schema） | ADK `expected_output`, Agno `response_model`                |

### 2.2 Context Management

收集好"素材"（Context Collection）只是第一步。如果厨房乱作一团，大厨也没法干活。**Context Management（上下文管理）** 的核心就是**高效的厨房收纳术**：确保案板上（短期）只放当下的菜，冷库里（长期）囤着常用的料，并且不同工种（隔离）互不干扰。

#### 2.2.1 Layered Memory Architecture

论文 [[1]](#ref1) 提出的**Layered Memory Architecture（分层记忆架构）**，本质上就是厨房的二级收纳体系：

> [!NOTE]
>
> 定义 1：**短期记忆 (Short-term Memory) —— 案板区/操作台**
>
> $$
>   M_s = f_{short}(c \in C : w_{temporal}(c) > \theta_s)
> $$
>
> - **特点**：高时间相关性（手边急需）。
> - **缺点**：空间有限，做完这道菜就会被清理。

> [!IMPORTANT]
>
> 解读：对应各框架的**对话历史 (Chat History)** 和 **会话状态 (Session State)**

> [!NOTE]
>
> 定义 2：**长期记忆 (Long-term Memory) —— 冷库/储藏室**
>
> $$
>   M_l = f_{long}(c \in C : w_{importance}(c) > \theta_l \land w_{temporal}(c) \leq \theta_s)
> $$
>
> - **特点**：高重要性，经过筛选和打包（压缩/抽象）。
> - **作用**：存放 VIP 客人喜好、季节性经典菜谱等需要持久保存的信息。

> [!IMPORTANT]
>
> 解读：对应各框架 **Memory Service** 中的 **持久化存储 (Persistent Storage)**

> [!NOTE]
>
> 定义 3：**记忆迁移 (Memory Transfer) —— 备菜入库**
>
> $$
>   f_{transfer}: M_s \rightarrow M_l
> $$
>
> - **巩固过程**：把案板上切好但没用完的优质食材，或者研发出的新酱料，打包放入冷库（高频访问或高重要性的短期记忆经处理后成为长期记忆）。
> - **触发条件**：高频使用、如果不记下来下次还得重新做（情感意义、与现有知识结构的相关性等因素）。

> [!IMPORTANT]
>
> 解读：对应 Google Memory Bank 中 **"Session → Insight" 的异步记忆提炼（巩固）过程**。

#### 2.2.2 Context Compression

| 策略                              | 描述                               | 优缺点                             | 框架支持             |
| :-------------------------------- | :--------------------------------- | :--------------------------------- | :------------------- |
| **Trimming**                      | 保留最近 K 条消息                  | ✅ 简单；❌ 丢失早期重要信息       | LangGraph, Agno      |
| **Summarization（人类可读摘要）** | 将历史摘要为精简自然语言           | ✅ 保留语义；❌ 丢失细节；计算开销 | ADK, Agno, LangGraph |
| **Tagging (标签化)**              | 从多维度标记信息（优先级、来源等） | ✅ 高效检索；❌ 可能过于刚性       |
| **Sliding Window**                | 滑动窗口摘要老旧事件               | ✅ 平衡保留与压缩                  | ADK                  |
| **Semantic Filter**               | 基于相关性过滤                     | ✅ 保留重要信息；❌ 可能遗漏       | 自定义实现           |
| **层次化笔记**                    | 树状结构组织信息                   | ✅ 清晰展示；❌ 不捕捉逻辑关联     |
| **QA 对压缩**                     | 将上下文转换为问答对               | ✅ 检索友好；❌ 破坏信息流         | 自定义实现           |

#### 2.2.3 Context Isolation

随着宴席（任务）规模扩大，一位主厨无法搞定所有菜品。**Context Isolation（上下文隔离）** 就是引入**后厨流水线分工**：

> [!TIP]
>
> **Sub-Agent 架构**
>
> 就像**甜点师（Sub-Agent A）**只关注面粉和糖，不需要知道**烤肉师（Sub-Agent B）**把牛排煎到了几分熟。
>
> 论文定义："Each sub-agent has its own focused context window, and the main agent coordinates through efficient communication."
>
> ---
>
> 每个 Sub-Agent 拥有独立的、聚焦的上下文窗口，主 Agent 通过高效通信协调各 Sub-Agent。

> [!IMPORTANT]
>
> 解读：对应 Google 的 **Agent-to-Agent Protocol**，以及 ADK 的 **Multi-Agent**、LangGraph 的 **Subgraph** 等设计。

### 2.3 Context Usage

素材备齐（Collection），收纳有序（Management），最后一步就是**Context Usage（上下文使用）——大厨的正式烹饪**。这是 Agent 展现"智能"的关键环节：如何从海量库存中精准抓取信息，并在有限的餐盘（Context Window）中呈现出最完美的料理（Prompt）。

#### 2.3.1 Retrieval and Selection

大厨炒菜不会把冷库里所有东西都倒进锅里。**Retrieval and Selection（记忆检索与选择）** 就是**根据当前菜单（Query）精准抓取食材**的过程。论文 [[1]](#ref1) 强调多维度的检索依据：

| 检索依据                 | 描述                       | 实现方式       |
| :----------------------- | :------------------------- | :------------- |
| **语义相似度**           | 基于向量嵌入的相似度搜索   | Vector Search  |
| **时间邻近性 (Recency)** | 最近使用的信息优先级更高   | 时间戳排序     |
| **访问频率 (Frequency)** | 高频访问的信息保持高可用性 | 访问计数器     |
| **重要性评分**           | 预计算的重要性权重         | LLM 评估       |
| **逻辑依赖**             | 追踪推理步骤之间的依赖关系 | 依赖图（图库） |
| **信息去重**             | 过滤传达相同含义的重复信息 | 语义去重       |
| **用户偏好**             | 根据用户反馈和习惯调整     |

#### 2.3.2 Proactive Intent Inference

顶级管家不需要主人开口，具备 Proactive Intent Inference（主动意图推断）能力。论文 [[1]](#ref1) 指出，Context Engineering 必须具备**主动性** —— 就像老练的服务员听到客人咳嗽，不仅递上水，还会默默关小冷气。

> [!TIP]
>
> **Proactive User Need Inference（主动用户需求推断）**
>
> - **学习用户偏好**：分析对话历史和个人数据，识别沟通风格、兴趣和决策模式
> - **从相关问题推断隐藏目标**：分析查询序列，预测更广泛的目标
> - **主动提供帮助**：检测用户困境（犹豫、多次尝试），主动提供工具或建议

#### 2.3.3 Dynamic Context Assembly

所有的素材筛选完毕后，需要通过 **Dynamic Context Assembler（动态上下文组装）** 进行**最终摆盘**，将其组装成 LLM 最易消化的格式（Formatted Prompt）。

```mermaid
graph LR
    subgraph Inputs["输入源"]
        I1["System Instruction"]
        I2["User Message"]
        I3["Chat History"]
        I4["Memories"]
        I5["Knowledge (RAG)"]
        I6["Tools"]
    end

    subgraph Assembler["Context Assembler"]
        A1["Token 预算计算"]
        A2["优先级排序"]
        A3["截断与填充"]
        A4["格式化输出"]
    end

    subgraph Output["输出"]
        O1["Formatted Prompt"]
    end

    I1 --> A1
    I2 --> A1
    I3 --> A1
    I4 --> A1
    I5 --> A1
    I6 --> A1
    A1 --> A2 --> A3 --> A4 --> O1

    style Inputs fill:#065f46,stroke:#34d399,color:#fff
    style Assembler fill:#7c2d12,stroke:#fb923c,color:#fff
    style Output fill:#581c87,stroke:#c084fc,color:#fff
```

## 3. Context Engineering 的主流实践

明白了"厨房理论"，我们就来看看**业界三大顶尖"厨具商"（Agent Framework）**是如何打造他们的厨房的。

### 3.1 Google ADK (Agent Development Kit)

**Google ADK 就像是一座标准化的工业级中央厨房**。它最显著的特点是提供了极度严谨的**分箱收纳体系（Context Hierarchy）**：

#### 3.1.1 核心 Context 体系

在 ADK 中，大厨不需要每次都重新找盒子，所有东西都有严格的标签：

```mermaid
graph TD
    subgraph ADK["Google ADK 记忆体系"]
        IC[Invocation Context] --> S[Session]
        IC --> ST[State]
        IC --> M[Memory]

        S --> SE["Events<br>时间序列消息"]
        S --> SS["session.state<br>会话级临时数据"]

        ST --> ST1["无前缀: Session Scope"]
        ST --> ST2["user: User Scope"]
        ST --> ST3["app: App Scope"]
        ST --> ST4["temp: Invocation Scope"]

        M --> MM[MemoryService]
        MM --> MM1[InMemoryMemoryService]
        MM --> MM2[VertexAiMemoryBankService]
    end

    style ADK fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style IC fill:#065f46,stroke:#34d399,color:#fff
    style MM fill:#7c2d12,stroke:#fb923c,color:#fff
```

| 概念         | 定义                        | 作用域   | 持久性                 |
| :----------- | :-------------------------- | :------- | :--------------------- |
| **Session**  | 单次进行中的用户-Agent 交互 | 当前会话 | 取决于 SessionService  |
| **State**    | 会话内的 Key-Value 数据     | 见前缀   | 见前缀                 |
| **Memory**   | 跨会话的可搜索知识库        | 跨会话   | 持久                   |
| **Event**    | 交互中的原子操作记录        | 当前会话 | 取决于 SessionService  |
| **Artifact** | 与会话关联的文件/数据块     | 当前会话 | 取决于 ArtifactService |

ADK 独创了一套 **'魔法便利贴'（Prefix-based State）** 机制。你只需要在 Key 上加不同的 **前缀**，系统就会自动把这张便利贴贴到不同的地方（作用域）：

| 前缀    | 作用域               | 持久性                 | 场景类比（便利贴贴在哪？）                             |
| :------ | :------------------- | :--------------------- | :----------------------------------------------------- |
| 无前缀  | 当前 Session         | 取决于 SessionService  | **餐桌上**：吃完这顿饭就清理了（任务进度、临时标志）   |
| `user:` | 跨该用户所有 Session | Database/VertexAI 持久 | **VIP 档案里**：老顾客下次来还有（用户偏好、配置）     |
| `app:`  | 跨该应用所有用户     | Database/VertexAI 持久 | **餐厅墙上**：所有人都得遵守（全局设置、模板）         |
| `temp:` | 当前 Invocation      | 不持久                 | **手心里**：做完这个动作就洗掉了（中间计算、临时变量） |

```python
# Google ADK State 使用示例 [5]
async def my_tool(ctx: ToolContext):
    # Session scope - 仅当前会话
    ctx.state["task_progress"] = 50

    # User scope - 跨会话持久化
    ctx.state["user:preferred_language"] = "zh-CN"

    # App scope - 全局配置
    ctx.state["app:max_retries"] = 3

    # Temp scope - 仅当前调用
    ctx.state["temp:intermediate_result"] = {...}
```

#### 3.1.2 Context Engineering

在 ADK 这个"中央厨房"中，原材料（Context）的流转有着严格的 SOP：

1. **Context Collection（按需领料）**

   ADK 并不把所有信息一次性堆给所有人，而是根据**工种（位置）**分发不同的**领料单（Context Object）**：

   | Context 类型          | 描述                         | 可访问位置                 | 角色类比                   |
   | :-------------------- | :--------------------------- | :------------------------- | :------------------------- |
   | **InvocationContext** | 完整调用上下文，包含所有信息 | Agent 的 `_run_async_impl` | **主厨**：全知全能         |
   | **CallbackContext**   | 回调中的可写上下文（可修改状态、存取 Artifact） | Agent/Model 回调           | **质检员**：可查看也可记录备注         |
   | **ToolContext**       | 工具执行时的可写上下文       | Function Tools             | **配菜员**：可操作局部状态 |
   | **ReadonlyContext**   | 只读上下文，用于表达式评估   | Agent Config 表达式        | **显示屏**：仅供参考       |

   ```python
   # Google ADK 上下文收集示例
   from google.adk.agents import Agent
   from google.adk.agents.callback_context import CallbackContext

   class MyAgent(Agent):
       async def _run_async_impl(self, ctx):
           # 从 InvocationContext 收集各类信息
           session = ctx.session                    # 会话
           state = ctx.session.state                # 会话状态
           user_content = ctx.user_content          # 用户输入
           agent = ctx.agent                        # Agent 配置

           # 从 Memory Service 检索长期记忆
           if ctx.memory_service:
               memories = await ctx.memory_service.search_memory(
                   query=user_content.parts[0].text
               )
   ```

2. **Context Compaction（台面清理）**

   为了防止"灶台"（Context Window）堆满，ADK 采用**滑动窗口（Sliding Window）**机制，定期清理陈旧的"果皮纸屑"（Old Events）。

   ```python
   # Google ADK Context Compaction（EventsCompactionConfig 定义于 google.adk.apps.app，截至 2026-05-23 已确认存在于 ADK 2.0.0 GA）
   # Google ADK Context Compaction
   from google.adk.apps.app import EventsCompactionConfig

   app = App(
       name='my-agent',
       root_agent=root_agent,
       events_compaction_config=EventsCompactionConfig(
           compaction_interval=3,  # 每 3 次调用触发压缩
           overlap_size=1,         # 保留前一窗口的 1 个事件
       ),
   )
   ```

3. **Context Caching（预制备菜）**

   对于那些体积巨大且反复使用的"食材"（如超长 System Prompt 或大文件），ADK 会将其暂存为**预制菜（Cache）**，避免每次都从零处理（Token Re-computation）。

   ```python
   # Google ADK Context Cache（ContextCacheConfig 定义于 google.adk.agents.context_cache_config，截至 2026-05-23 已确认存在于 ADK 2.0.0 GA）
   from google.adk.apps.app import App
   from google.adk.agents.context_cache_config import ContextCacheConfig

   app = App(
       name='my-agent',
       root_agent=root_agent,
       context_cache_config=ContextCacheConfig(
           min_tokens=2048,      # 触发缓存的最小 token 数
           ttl_seconds=600,      # 缓存存活时间 (10分钟)
           cache_intervals=5,    # 刷新间隔（使用次数）
       ),
   )
   ```

### 3.2 Agno（前身为 Phidata）

如果说 Google ADK 是工业级中央厨房，那么 **Agno 就是一个主打"懒人包"的高级自助餐厅**。它的设计哲学是**配置驱动（Configuration Driven）**——你不需要自己去地里拔萝卜，只需要在菜单上勾选你要的"套餐组件"，系统就会自动把菜做好。

#### 3.2.1 Context Collection（自助选餐）

Agno 的上下文收集就像是在**点自助餐**，所有功能都封装成了开箱即用的**开关（Options）**：

| 组件                   | 描述                                                    | 配置方式                      | 自助餐类比                               |
| :--------------------- | :------------------------------------------------------ | :---------------------------- | :--------------------------------------- |
| **System Message**     | 主上下文<br/>description、instructions、expected_output | Agent 构造参数                | **主菜**：定下餐厅的基调（川菜还是粤菜） |
| **User Message**       | 用户输入                                                | `Agent.run(input)`            | **客人的点单**                           |
| **Chat History**       | 对话历史                                                | `add_history_to_messages=True` | **上一轮的盘子**：参考客人刚吃了啥       |
| **Additional Context** | Few-shot 示例或其他补充等                               | `additional_context` 参数     | **佐料/小菜**：给这道菜加点料            |
| **Memory**             | 长期记忆                                                | `enable_user_memories=True`   | **会员记录**：老规矩，不加香菜           |
| **Knowledge**          | 外部知识                                                | `knowledge` 参数              | **百科全书**：不懂随时查                 |

```python
# Agno "自助点餐单" 示例
from agno.agent import Agent

agent = Agent(
    # [主菜] 设定角色和基调
    name="Helpful Assistant",
    role="Assistant",
    description="You are a helpful assistant",
    instructions=["Help the user with their question"],

    # [小菜] 加点 Few-shot 示例提味
    additional_context="""
        Here is an example:
        Request: What is the capital of France?
        Response: The capital of France is Paris.
    """,
    expected_output="Format response with `Response: <response>`",

    # [套餐加项] 勾选需要的配菜
    add_history_to_messages=True,        # 加上对话历史
    add_state_in_messages=True,          # 加上当前状态
    add_context=True,                    # 加上上下文依赖注入
    enable_session_summaries=True,       # 加上历史摘要（解腻）
    enable_user_memories=True,           # 加上会员记忆

    # [外挂] 允许查阅百科全书
    knowledge=my_knowledge_base,
)
```

#### 3.2.2 Memory & Knowledge（记忆与知识）

点完餐（Collection）后，如何记住客人的喜好？Agno 提供了一套智能的 **VIP 客户档案系统（Memory）**，并将其与**百科全书（Knowledge）**做了清晰的切割。

**1. Memory 模式：谁来写档案？**

Agno 提供两种维护客户档案的方式 <sup>[[8]](#ref8)</sup>：

| 模式                 | 配置                         | 行为                            | 档案员类比                                                                     |
| :------------------- | :--------------------------- | :------------------------------ | :----------------------------------------------------------------------------- |
| **Automatic Memory** | `enable_user_memories=True`  | 自动从对话中提取和召回记忆      | **隐形记录员**：默默站在旁边，听到"我不吃辣"就自动记入档案，完全不用大厨操心。 |
| **Agentic Memory**   | `enable_agentic_memory=True` | Agent 自主决定何时创建/更新记忆 | **大厨亲自记**：大厨（Agent）觉得这点很重要，主动掏出本子记下来（调用工具）。  |

```python
# Agno "智能档案" 示例 (v2 API)
from agno.agent import Agent
from agno.memory.v2.db.sqlite import SqliteMemoryDb
from agno.storage.sqlite import SqliteStorage

# Memory 与 Storage 是分离的两个子系统
memory_db = SqliteMemoryDb(table_name="agent_memories")
storage = SqliteStorage(table_name="agent_sessions")

agent = Agent(
    memory_db=memory_db,
    storage=storage,
    enable_user_memories=True,  # [隐形记录员] 上岗
)

# 场景：记录员自动工作
agent.print_response(
    "My name is Sarah and I prefer email over phone calls.",
    user_id="user-123"
)

# 场景：自动翻阅档案
agent.print_response(
    "What's the best way to reach me?",
    user_id="user-123"
)  # Agent 会翻看档案，回答 "Email"
```

> [!IMPORTANT]
>
> **基本概念区分：百科全书 vs 私人日记**
>
> Agno 严格区分了 **Knowledge** 和 **Memory**，切勿混淆：
>
> - **Knowledge (RAG)** = **百科全书/菜谱大全**。它是公共的、静态的知识（比如"法式鹅肝的做法"），用来增强 Agent 的业务能力。
> - **Memory** = **私人日记/客户档案**。它是私有的、动态的记录（比如"Sarah 不吃葱"），用来提升个性化体验。

### 3.3 LangChain / LangGraph

不管是中央厨房（ADK）还是自助餐厅（Agno），都是为你建好的房子。而 **LangChain/LangGraph 就像是"乐高积木王国"** —— 给你一地零件（工具），想盖摩天大楼还是霍比特人小屋，全看你的想象力。

LangChain 官方将 Context Engineering 组织为 Model Context / Tool Context / Life-cycle Context 三大类（参见 LangChain 官方文档 Context Engineering 页面）。以下为基于官方分类的概念化综合整理：

```mermaid
graph TD
    CE[Context Engineering] --> W["Writing<br>外部记事(外部存储)"]
    CE --> S["Selecting<br>按需翻找(动态检索)"]
    CE --> C["Compressing<br>打包压缩(压缩摘要)"]
    CE --> I["Isolating<br>分工隔离(上下文隔离)"]

    W --> W1["Scratchpad<br>草稿本(临时存储)"]
    W --> W2["LangGraph State<br>存档点(图状态持久化)"]

    S --> S1["Vector Search<br>相似积木(向量检索)"]
    S --> S2["Just-in-Time RAG<br>缺啥找啥(实时 RAG)"]

    C --> C1["Summarization<br>写游记(对话摘要)"]
    C --> C2["Token Pruning<br>扔掉废料(Token 修剪)"]

    I --> I1["Sub-Agent<br>各管一摊(子 Agent)"]
    I --> I2["Subgraph<br>独立房间(子图)"]
```

#### 3.3.1 Memory 机制（游戏存档）

可以将 **Memory 机制** 形象地类比为 **游戏进度存档**。在冒险游戏中，LangGraph 提供了两套不同维度的"存档"机制（持久化机制） <sup>[[11]](#ref11)[[12]](#ref12)</sup>：

| 类型                  | 机制             | 范围      | 用途/类比                                                                                                                             |
| :-------------------- | :--------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **Short-term Memory** | **Checkpointer** | Thread 内 | 对话历史、状态快照。<br/>**游戏存档点 (Save Point)**：随时可以回档重玩（Time Travel），记录每一关的状态，关机（会话结束）可能就没了。 |
| **Long-term Memory**  | **Store**        | 跨 Thread | 用户偏好、学习到的知识。<br/>**全成就奖杯库 (Global Trophy Room)**：不管开几个新存档，你解锁的成就和收集的图鉴都在。                  |

LangGraph 还提供了各种不同款式的 **"冒险背包"（Memory Types）**：

> ⚠️ **注意**: 以下为 LangChain v0.3.1 Legacy Memory 类型（于 v0.3.1 标记弃用，计划于 v1.0.0 移除），已被 LangGraph 的 Checkpointer + Store 架构取代，此处保留用于概念对比参考。

| Memory 类型                         | 描述                                                                                 | 适用场景             |
| :---------------------------------- | :----------------------------------------------------------------------------------- | :------------------- |
| **ConversationBufferMemory**        | 存储完整对话历史<br/>**无限次元袋**：啥都往里塞，不管多重。                          | 短途旅行（短对话）   |
| **ConversationBufferWindowMemory**  | 滑动窗口，仅保留最近 K 条<br/>**限定容量包**：新东西进来，旧东西挤出去。             | 轻装上阵（中等对话） |
| **ConversationSummaryMemory**       | 摘要历史对话<br/>**探险日记本**：东西都扔了，只记发生了什么。                        | 长篇史诗（长对话）   |
| **ConversationSummaryBufferMemory** | 混合：摘要旧对话 + 完整保留近期<br/>**混合战术包**：近期物品随身带，早期经历写日记。 | 平衡型（最佳实践）   |
| **VectorStoreRetrieverMemory**      | 向量存储，基于相似度检索<br/>**魔法召唤阵**：心念一动，相关物品自动飞来。            | 跨越时空的记忆       |

```python
# LangGraph 游戏存档点 (Checkpointer)
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres import PostgresSaver

# [试玩版存档] - 内存
checkpointer = InMemorySaver()

# [正式版云存档] - 数据库
checkpointer = PostgresSaver(conn)

# 编译游戏引擎
graph = builder.compile(checkpointer=checkpointer)

# [自动存档/读档机制]
# 只要配置了 thread_id，LangGraph 就会开启"RPG 模式"：
# 1. Load (读档): 自动读取该 thread_id 的历史状态
# 2. Auto-Save (自动存档): 每次节点(Node)执行完，自动保存最新状态
config = {"configurable": {"thread_id": "save-file-001"}}
graph.invoke(input_data, config)
```

```python
# LangGraph 成就/藏宝库 (Store)
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

# 游戏引擎由双核驱动：存档点 + 藏宝库
graph = builder.compile(checkpointer=checkpointer, store=store)

# 在关卡(Node)中存取宝物
def my_node(state, config, *, store):
    user_id = config["configurable"]["user_id"]
    namespace = (user_id, "memories")

    # 获得成就：喜欢披萨
    store.put(namespace, "preference", {"food": "pizza"})

    # 查攻略：我喜欢啥？
    memories = store.search(namespace, query="what do I like?")
```

#### 3.3.2 Context Engineering（冒险工具箱）

有了存档机制，LangGraph 还提供了一套 **"冒险工具箱"** 来处理上下文的流转：

1. **Context Collection（战前点验）**

   在执行任务（Node）前，Agent 需要确认身上的所有装备：

   - **State (背包)**：当前的血量、道具（对话历史）。
   - **Config (身份证)**：我是谁（User ID），我在哪个存档（Thread ID）。
   - **Store (成就库)**：我以前学过什么技能（长期记忆）。

   ```python
   # LangGraph "战前点验" 示例
   from langgraph.graph import StateGraph, MessagesState

   def my_node(state: MessagesState, config, *, store):
       # 1. 查背包 (State): 获取消息历史
       messages = state["messages"]

       # 2. 查身份证 (Config): 获取用户与存档标识
       user_id = config["configurable"]["user_id"]
       thread_id = config["configurable"]["thread_id"]

       # 3. 查成就库 (Store): 检索长期记忆
       namespace = (user_id, "memories")
       memories = store.search(namespace, query=messages[-1].content)

       return {"messages": [...]}
   ```

2. **Context Compression（整理背包）**

   冒险者的背包容量（Context Window）是有限的。当战利品太多时，必须进行 **"负重管理"** ——丢弃低价值的破石头（老旧消息），只保留核心道具。

   ```python
   # LangGraph 消息修剪 (整理背包)
   from langchain_core.messages import trim_messages

   # 设定背包最大负重 (Token Limit)
   trimmer = trim_messages(
       max_tokens=1000,
       strategy="last",  # 保留最新获得的道具
       token_counter=len,
   )

   # 在节点中使用
   def agent_node(state):
       # 自动丢弃超重的旧物品
       messages = trimmer.invoke(state["messages"])
       response = llm.invoke(messages)
       return {"messages": [response]}
   ```

3. **Context Isolation（独立副本）**

   当主线任务太复杂时，可以开启一个 **"独立副本"（Subgraph）**。在副本里，有独立的地图和状态栏。打通副本后，只把"掉落奖励"（最终结果）带回主世界，避免主地图变得混乱。

   ```python
   # LangGraph 副本挑战 (Subgraph)
   from langgraph.graph import StateGraph

   # [副本] 独立的科研任务，有独立的状态
   def create_research_subgraph():
       builder = StateGraph(ResearchState)
       builder.add_node("search", search_node)
       builder.add_node("analyze", analyze_node)
       return builder.compile()

   # [主世界]
   main_builder = StateGraph(MainState)
   # 玩家进入副本
   main_builder.add_node("research", create_research_subgraph())
   main_builder.add_node("respond", respond_node)
   ```

### 3.4 核心概念映射

| 概念           | Google ADK<sup>[[3]](#ref3)</sup> | Agno<sup>[[7]](#ref7)</sup>   | LangChain<sup>[[11]](#ref11)</sup> / LangGraph<sup>[[12]](#ref12)</sup> |
| :------------- | :-------------------------------- | :---------------------------- | :---------------------------------------------------------------------- |
| **会话容器**   | Session                           | Session (session_id)          | Thread (checkpointer)                                                   |
| **临时状态**   | session.state                     | session_state                 | State (graph state)                                                     |
| **对话历史**   | session.events                    | chat_history                  | messages                                                                |
| **长期记忆**   | MemoryService                     | Memory (enable_user_memories) | Long-term Memory Store                                                  |
| **知识库/RAG** | (需自行实现)                      | Knowledge                     | VectorStore / Retriever                                                 |
| **上下文缓存** | ContextCacheConfig                | 依赖 LLM Provider             | 依赖 LLM Provider                                                       |
| **上下文压缩** | EventsCompactionConfig            | session_summary               | trim_messages / summarize                                               |
| **持久化**     | SessionService                    | Database                      | Checkpointer                                                            |

### 3.5 框架横评

| 框架           | 优势                                                                                                                        | 劣势                                              |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| **Google ADK** | ✅ 清晰的 Service 抽象（SessionService, MemoryService）<br>✅ 与 Vertex AI 深度集成<br>✅ 多语言支持 (Python, Go, Java, TS) | ❌ MemoryBank 强依赖 Vertex AI<br>❌ 社区生态较新 |
| **Agno**       | ✅ 开发体验极佳（配置驱动）<br>✅ Memory 开箱即用<br>✅ Team/Workflow 多 Agent 支持                                         | ❌ 相对封闭的生态<br>❌ 文档深度有限              |
| **LangChain**  | ✅ 最成熟的生态系统<br>✅ 丰富的 Memory 类型<br>✅ 与各种 Vector DB 集成                                                    | ❌ 抽象层多，学习曲线陡<br>❌ Memory 碎片化       |
| **LangGraph**  | ✅ 状态管理优秀（checkpointer）<br>✅ 复杂工作流支持<br>✅ Context Engineering 策略完备<br>✅ 社区活跃                      | ❌ 配置复杂度高<br>❌ 调试困难                    |

### 3.6 选型路径

```mermaid
graph LR
    Q1{Google Cloud 集成?}
    Q2{复杂工作流?}
    Q3{快速开发?}

    Q1 -->|是| ADK["Google ADK"]
    Q1 -->|否| Q2

    Q2 -->|是| LG["LangGraph"]
    Q2 -->|否| Q3

    Q3 -->|是| AGNO["Agno"]
    Q3 -->|否| CUSTOM["自定义实现"]

    style ADK fill:#4285f4,stroke:#1a73e8,color:#fff
    style LG fill:#ff6b35,stroke:#e85a2e,color:#fff
    style AGNO fill:#10b981,stroke:#059669,color:#fff
    style CUSTOM fill:#6366f1,stroke:#4f46e5,color:#fff
```

## References

<a id="ref1"></a>[1] Q. Hua, L. Ye, D. Fu, Y. Xiao, X. Cai, Y. Wu, J. Lin, J. Wang, and P. Liu, "Context Engineering 2.0: The Context of Context Engineering," _arXiv preprint arXiv:2510.26493_, Oct. 2025. [Online]. Available: https://arxiv.org/abs/2510.26493

<a id="ref2"></a>[2] A. K. Dey, "Understanding and Using Context," _Pers. Ubiquitous Comput._, vol. 5, no. 1, pp. 4–7, 2001.

<a id="ref3"></a>[3] Google, "Google ADK - Context," 2025. [Online]. Available: https://google.github.io/adk-docs/context/

<a id="ref4"></a>[4] Google, "Google ADK - Sessions, State, Memory Overview," 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/

<a id="ref5"></a>[5] Google, "Google ADK - State," 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/state/

<a id="ref6"></a>[6] Google, "Google ADK - Sessions - Memory," 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/memory/

<a id="ref7"></a>[7] Agno, "Agno - Agent Context," 2025. [Online]. Available: https://docs.agno.com/agents/context

<a id="ref8"></a>[8] Agno, "Agno - Memory," 2025. [Online]. Available: https://docs.agno.com/agents/memory

<a id="ref9"></a>[9] Agno, "Agno - Knowledge," 2025. [Online]. Available: https://docs.agno.com/reference/knowledge/knowledge

<a id="ref10"></a>[10] Agno, "Agno - Sessions," 2025. [Online]. Available: https://docs.agno.com/sessions/overview

<a id="ref11"></a>[11] LangChain, "Context Engineering in Agents," _Docs by LangChain_, 2025. [Online]. Available: https://docs.langchain.com/oss/python/langchain/context-engineering

<a id="ref12"></a>[12] LangChain, "Memory Overview," _Docs by LangChain_, 2025. [Online]. Available: https://docs.langchain.com/oss/python/langgraph/memory
