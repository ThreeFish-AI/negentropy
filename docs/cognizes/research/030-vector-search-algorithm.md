---
id: vector-search-algorithm
sidebar_position: 3
title: 向量索引算法通俗全解
last_update:
  author: Aurelius Huang
  created_at: 2025-12-24
  updated_at: 2025-12-31
  version: 1.3
  status: Reviewed
tags:
  - Vector Database
  - ANN (Approximate Nearest Neighbor) Algorithms
  - Similarity Search
  - HNSW (Hierarchical Navigable Small World)
  - IVF (Inverted File)
  - PQ (Product Quantization)
  - Embedding
---

> [!IMPORTANT]
>
> **解读范围**：从 LLM 的缺陷出发，引出向量数据库的需求，然后以通俗的方式解读向量数据库的数学模型、算法原理、技术细节、性能对比、应用场景与选型推荐。

---

## 1. 向量索引二三事

### 1.1 天才博士的困境

你聘请了一位博闻强记的**天才博士（LLM）**。他通读了直至 2023 年底的所有人类书籍，才华横溢却又身处窘境——他被关在一个**没有互联网的房间里**。

当我们问他：“2024 年的奥运会冠军是谁？”时，他因为 2023 年以来与世隔绝（**记忆截止**）而一脸茫然；当我们塞给他一本几百页的新书让他立刻总结时，他因为**脑容量（Context Window）有限**而顾此失彼；更糟糕的是，当我们问及他不知道的领域时，为了面子，他偶尔通过一本正经地胡编乱造（**幻觉**）来应付你。

<details>
<summary>LLM 固有缺陷全景</summary>

以 GPT 为代表的 LLM（大语言模型）所面临的真实困境<sup>[[1]](#ref1)</sup> 包括：

```mermaid
graph LR
    %% Root Node
    root((LLM 固有缺陷)):::root
        %% Left Side: Predecessors (Flow: Left -> Root)
    %% Explicitly linking LeftNode --- Root places LeftNode to the left
    H(幻觉问题):::hallucination --- root
    T(知识时效性):::timeliness --- root
        %% Left Leaves (Flow: Leaf -> LeftNode)
    H1[生成虚假信息]:::hallucination --- H
    H2[编造不存在的事实]:::hallucination --- H
    H3[自信地给出错误答案]:::hallucination --- H
        T1[训练数据截止日期]:::timeliness --- T
    T2[无法获取实时信息]:::timeliness --- T
    T3[无法感知最新事件]:::timeliness --- T
        %% Right Side: Successors (Flow: Root -> Right)
    %% Explicitly linking Root --- RightNode places RightNode to the right
    root --- C(上下文窗口限制):::context
    root --- D(领域知识缺乏):::domain
    root --- R(推理能力局限):::reasoning
        %% Right Leaves (Flow: RightNode -> Leaft)
    C --- C1[有限的 Token 数量]:::context
    C --- C2[长文本处理困难]:::context
    C --- C3[长期记忆缺失]:::context
        D --- D1[通用知识为主]:::domain
    D --- D2[缺乏专业领域深度]:::domain
    D --- D3[无法访问私有数据]:::domain
        R --- R1[复杂数学推理困难]:::reasoning
    R --- R2[多步逻辑推理易出错]:::reasoning
    R --- R3[因果推理能力不足]:::reasoning
        classDef root fill:#eb2f96,stroke:#fff,stroke-width:4px,color:#fff
    classDef hallucination fill:#ff4d4f,stroke:#fff,color:#fff
    classDef timeliness fill:#fa8c16,stroke:#fff,color:#fff
    classDef context fill:#52c41a,stroke:#fff,color:#fff
    classDef domain fill:#1890ff,stroke:#fff,color:#fff
    classDef reasoning fill:#722ed1,stroke:#fff,color:#fff
```

| 缺陷类型                  | 具体表现                                            | 影响                                 |
| ------------------------- | --------------------------------------------------- | ------------------------------------ |
| **幻觉（Hallucination）** | 生成看似合理但实际错误的内容<sup>[[1]](#ref1)</sup> | 降低输出可信度，可能导致严重错误决策 |
| **知识截止日期**          | 无法获取训练数据之后的信息<sup>[[2]](#ref2)</sup>   | 无法回答时事问题，知识库逐渐过时     |
| **上下文窗口限制**        | 单次对话无法处理超长文本<sup>[[1]](#ref1)</sup>     | 无法维持长期对话记忆，大文档处理受限 |
| **领域知识缺乏**          | 缺少特定行业或私有数据知识<sup>[[3]](#ref3)</sup>   | 无法提供专业精准的领域回答           |
| **推理能力局限**          | 复杂逻辑和数学推理易出错<sup>[[1]](#ref1)</sup>     | 在需要精确计算的场景可靠性不足       |

</details>

### 1.2 博士的“图书馆”

为了让这位“天才但与世隔绝且脑容量有限的博士”更好的服务我们，我们需要将互联网这个“图书馆”中“新书本”的知识链接给他。但首先面临的问题是：计算机无法直接理解“书本”里内容的含义。

**Embedding（嵌入向量）** 便是解决这一难题的“数字翻译官”。它能将文本、图像、音频等非结构化数据，转译为计算机可计算的**语义坐标（高维向量）**，让计算机“读懂”字面背后的含义<sup>[[4]](#ref4)</sup>。

这里以猫、狗、汽车为例，我们分别在生命性和智能性两个维度的向量空间上使用 Embedding 表示它们：

```mermaid
quadrantChart
    title Semantic Vector Space
    x-axis "低生命性" --> "高生命性"
    y-axis "低智能性" --> "高智能性"
    quadrant-1 "智能生命体"
    quadrant-2 "高等智能"
    quadrant-3 "无生命物"
    quadrant-4 "简单生命体"
    "🐱 Cat [0.8, 0.7]": [0.8, 0.7]
    "🐶 Dog [0.85, 0.75]": [0.85, 0.75]
    "🚗 Car [0.1, 0.1]": [0.1, 0.1]
```

这里直观体现了语义相似对象在向量空间中聚集的特性：

- **"猫" (0.8, 0.7)** 与 **"狗" (0.85, 0.75)** 位于右上象限，语义距离仅 **0.07**
- **"汽车" (0.1, 0.1)** 位于左下象限，与"猫"语义距离达 **0.92**

如果我们引入更多的维度（比如形状、大小、颜色、能力等），就可以以 Embedding 来精准且全面地**语义化表示**任意对象。

Embedding 的核心意义在于：**语义相似的对象在向量空间中距离更近**<sup>[[5]](#ref5)</sup>。这种直观的“语义坐标化”过程，在数学上有严格的定义（**Embedding 的数学模型**）：

> [!NOTE]
>
> $$
>     f: X \rightarrow \mathbb{R}^d
> $$
>
> 即将输入空间 $X$ 中的对象映射到 $d$ 维实数向量空间 $\mathbb{R}^d$，向量化的过程可以表示为：
>
> $$
>     \text{embed}(x) = [e_1, e_2, ..., e_d] \in \mathbb{R}^d
> $$
>
> 其中：
>
> - $x$ 是输入对象（如文本、图像）
> - $d$ 是向量维度（常见值：128, 256, 384, 512, 768, 1024, 1536, 3072）
> - $e_i$ 是向量的第 $i$ 个分量

> [!TIP]
>
> Embedding 是**语义搜索**、**知识检索**、**聚类去重**等任务的基础：
>
> - **语义搜索**：通过向量距离找到语义相关的内容 —— _如搜索"如何提升代码质量"能匹配到"代码重构最佳实践"_
> - **知识检索**：从大规模知识库中检索相关信息 —— _如 RAG 系统从百万文档中秒级定位答案来源_
> - **聚类去重**：识别和分组相似内容 —— _如新闻聚合平台自动归类同一事件的不同报道_

有了 **Embedding** 这座连接语义与计算的桥梁，我们便有了为 **天才博士（LLM）** 外挂互联网这座“图书馆”（**外部知识库**）的能力——这便是 **RAG**。

### 1.3 博士的“图书管理员”

**RAG（Retrieval-Augmented Generation, 检索增强生成）** 的本质，就是给这位天才博士配备一位**极其高效的图书管理员**。

当用户提问时，管理员先利用 Embedding 在图书馆（向量数据库）中检索出最相关的几页资料，然后把**这些资料连同问题**一起递给博士。博士基于这些新鲜、准确的资料进行即时阅读和回答，从而有效解决了记忆截止和幻觉等固有缺陷<sup>[[2]](#ref2)</sup>：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'darkMode': true, 'mainBkg': '#1f2937', 'textColor': '#374151', 'lineColor': '#ffffff', 'signalColor': '#ffffff', 'signalTextColor': '#ffffff', 'noteBkgColor': '#1f2937', 'noteTextColor': '#ffffff', 'actorBkg': '#1f2937', 'actorBorder': '#ffffff', 'actorTextColor': '#ffffff'}, 'sequence': {'mirrorActors': false}}}%%
sequenceDiagram
    participant User as 🙋 用户
    participant RAG as 💁 图书管理员 (RAG)
    participant VDB as 📚 图书馆 (VectorDB)
    participant LLM as 👨‍🎓 天才博士 (LLM)

    Note over User, LLM: RAG 协同工作流程

    User->>RAG: 1. 提问："2024 奥运冠军是谁？"

    rect #374151
    Note right of RAG: 检索阶段
    RAG->>RAG: 把问题转化为"索书号" (Embedding)
    RAG->>VDB: 2. 按"索书号"查找相关书籍
    VDB-->>RAG: 3. 返回最相关的几页资料 (Top-K Chunks)
    end

    rect #1f2937
    Note right of RAG: 生成阶段
    RAG->>LLM: 4. 递交资料："博士，这是查到的资料和原本的问题，请回答"
    Note right of LLM: 阅读资料
    LLM-->>User: 5. 准确回答 (基于资料)
    end
```

将上述 RAG 协同过程抽象为各自独立的协作组件：

| RAG 组件       | 功能                       | 解决的 LLM 缺陷          |
| -------------- | -------------------------- | ------------------------ |
| **外部知识库** | 存储最新、专业的知识文档   | 知识时效性、领域知识缺乏 |
| **向量化**     | 将文档转换为语义向量       | 为相似性搜索提供基础     |
| **向量数据库** | 高效存储和检索向量         | 突破上下文窗口限制       |
| **语义检索**   | 找到与查询最相关的知识片段 | 提供事实依据，减少幻觉   |
| **上下文增强** | 将检索内容注入 LLM 提示    | 提供准确信息源           |

### 1.4 高维图书馆的“诅咒”

当我们将**图书馆（数据库）**从只有行和列的二维表格，升级到拥有成百上千个维度的**语义空间**时，必须面对一个反直觉的物理现象——**维度诅咒（Curse of Dimensionality）**。

这就像从**“在城市地图上找一家店（二维）”**变成了**“在茫茫宇宙中找一颗星（高维）”**。在如此广阔且复杂的空间里，传统的查找方法（如二分查找、B+树）会彻底迷失方向<sup>[[7]](#ref7)</sup>：

> [!WARNING]
>
> 随着维度增加，高维空间出现两个关键现象，导致传统数据库索引（如 KD-Tree, R-Tree）失效：
>
> 1. **距离集中效应**：高维下任意两点的距离差异消失，**所有点看起来都差不多远**。就像所有人距离你都是 99-100 米，"最近"和"最远"失去了界限。
> 2. **空间稀疏性**：空间体积随维度指数级膨胀，数据变得**极端稀疏**。就像将一滴水（数据）分散到整个太平洋（高维空间），传统格子划分法（索引）会完全失效。
>
> 具体表现：
>
> | 维度              | 数据特征 & 索引表现                                    | KD-Tree 效率对比暴力搜索    |
> | :---------------- | :----------------------------------------------------- | :-------------------------- |
> | **低维 (2-10)**   | 距离区分度高，空间划分有效                             | **快 100-1000x** (O(log N)) |
> | **中维 (10-100)** | 距离开始集中，索引剪枝能力大幅下降                     | **持平或略慢**              |
> | **高维 (>100)**   | **距离集中效应**显著，索引需访问几乎所有节点，完全失效 | **更慢** (因额外回溯开销)   |

因此，我们有必要引入专业的**向量数据库**来解决实际应用中的向量索引问题。

### 1.5 权衡利弊的“鉴赏家”

如果说传统数据库是严格的**会计师**（只认准确的 ID 和关键词），那么向量数据库则是直觉敏锐的**鉴赏家**（关注内容和语义的相似度）。

为了在海量的高维数据中，既保持这种敏锐的直觉（高召回率），又能在一眨眼间找到目标（低延迟），向量数据库进化出了以下核心“超能力”：

```mermaid
%%{init: {'theme': 'dark'}}%%
graph TB
    subgraph "向量数据库核心能力"
        A[高效向量存储]
        B[近似最近邻搜索 ANN]
        C[向量索引算法]
        D[混合查询支持]
        E[分布式扩展]
        F[实时更新]
    end

    A --> |"压缩量化"| A1[降低存储成本]
    B --> |"亚线性时间"| B1[毫秒级响应]
    C --> |"HNSW/IVF/PQ"| C1[高召回率]
    D --> |"向量+标量"| D1[精准过滤]
    E --> |"水平扩展"| E1[百亿级向量]
    F --> |"增量索引"| F1[实时可用]

    style B fill:#52c41a,color:#fff
    style C fill:#1890ff,color:#fff
```

为了实现这种极致的检索速度，计算机工程师做出了一个关键的权衡——**用“绝对精度的微小牺牲”换取“检索速度的数量级提升”**：

> [!IMPORTANT]
>
> **精确搜索 vs. 近似搜索**
>
> | 搜索类型                    | 时间复杂度       | 召回率 | 适用场景                |
> | --------------------------- | ---------------- | ------ | ----------------------- |
> | **暴力搜索（Brute Force）** | O(n × d)         | 100%   | 小数据集（<10 万）      |
> | **近似搜索（ANN）**         | O(log n) ~ O(√n) | 95-99% | 大规模数据集（>100 万） |
>
> **关键洞察**：在大规模场景下，我们愿意用少量的召回率损失（1-5%）换取数量级的性能提升。这正是 ANN 算法的核心价值。

那么，具体如何落地 ANN？就像**图书馆**不仅要藏书，更要**编目**。我们必须通过特定的算法将杂乱的向量数据进行**分类（聚类）**或**编码（哈希）**，才能让查找从“大海捞针”变成“按图索骥”。接下来的章节将剖析构建这套“空间索引系统”的三大基石算法：K-Means 聚类、LSH（局部敏感哈希）和 NSW（导航小世界图）。

---

## 2. 基础索引算法（向量索引的基石）

本章将通俗解读构建向量索引大厦的三块基石：**K-Means 聚类**、**LSH (局部敏感哈希)** 和 **NSW (导航小世界图)**。理解它们，是掌握 HNSW、IVF 等现代高阶算法的必经之路。

### 2.1 K-Means 聚类

#### 2.1.1 算法核心（选民站队）

面对海量数据，最直观的索引思路便是 **“物以类聚”**。

K-Means 就像是为数百万个向量选出 $K$ 个 **“代表”（Centroids）**。在查询时，如果不确定目标在哪里，我们只需先问这几个代表，就能快速缩小范围，而无需逐一排查。

选出这些最佳“代表”并不是一蹴而就的，而是一个 **“选民站队 $\leftrightarrow$ 代表调整”** 的反复协商过程：

```mermaid
graph LR
    Start[1. 随机提名] -->|"随机初始化 K 个代表"| Assign(2. 选民站队)
    Assign -->|"选民归入最近邻代表<br/>所在的队伍"| Update(3. 代表调整)
    Update -->|"队伍中心的选民晋升为代表"| Check{4. 是否稳定?}
    Check -->|"代表变动"| Assign
    Check -->|"代表未变"| Done[5. 选举完成]

    style Start fill:#bae7ff,color:#000000
    style Done fill:#d9f7be,color:#000000
    style Check fill:#fff7e6,color:#000000
```

> [!IMPORTANT]
>
> **K-Means 聚类算法** 的核心是将数据划分为 $K$ 个簇，用簇中心（Centroid）代表该簇所有向量<sup>[[9]](#ref9)</sup>。
>
> **数学目标**：最小化簇内方差和（Within-Cluster Sum of Squares, WCSS）：
>
> $$
>     J = \sum_{i=1}^{K} \sum_{x \in C_i} \|x - \mu_i\|^2
> $$
>
> 其中：
>
> - $K$ 是簇的数量
> - $C_i$ 是第 $i$ 个簇
> - $\mu_i$ 是第 $i$ 个簇的中心
> - $\|x - \mu_i\|^2$ 是向量 $x$ 到簇中心的欧几里得距离的平方

<details>
<summary>伪代码</summary>

```python
def kmeans(vectors, k, max_iters=100):
    # 1. 随机初始化 K 个中心
    centroids = random_select(vectors, k)

    for _ in range(max_iters):
        # 2. 分配：每个向量分配到最近的中心
        clusters = assign_to_nearest(vectors, centroids)

        # 3. 更新：重新计算中心
        new_centroids = compute_centroids(clusters)

        # 4. 检查收敛
        if converged(centroids, new_centroids):
            break
        centroids = new_centroids

    return centroids, clusters

```

</details>

#### 2.1.2 码本（向量字典）

> [!TIP]
>
> 想象一张包含 1600 万种颜色的照片（原始数据）。为了压缩，我们制作了一张只包含 256 种典型颜色的 **标准调色板（码本）** 来近似表示所有颜色。调色板中的每一种标准色块，就是一个 **码字 (Codeword)**。这样的好处是：
>
> - **数据压缩**：在存储时，不再记录每个像素复杂的 RGB 值（浮点数），而是仅记录它最接近的那个标准色在调色板中的 **编号 ID**。
> - **存储效率**：用极小的 ID（整数）替代了庞大的浮点数数组，虽损失微小精度，但换取了数十倍的存储空间。

K-Means 的关键是**选举少数的代表来近似表示全量的对象**，这种方式能够实现惊人的 **数据压缩**。这便是 **向量量化（Vector Quantization）** 的核心思想。

> [!NOTE]
>
> **码本制作三部曲**
>
> ```mermaid
> graph TD
>    subgraph "压缩效果"
>        ORIG[原始: 6KB/向量] --> COMP[压缩后: 1.25 字节/向量]
>    end
>
>    subgraph "向量量化过程"
>        V[原始向量<br/>1536 维 × N 个] --> KM[K-Means<br/>K=1024]
>        KM --> CB[码本<br/>包含 1024 个标准色]
>        KM --> ID[压缩存储<br/>仅存 10-bit ID]
>    end
>
>    style COMP fill:#52c41a,color:#fff
>    style KM fill:#1890ff,color:#fff
> ```
>
> 1. **采样**：从海量数据中抽取训练集。
> 2. **聚类**：运行 K-Means 得到 $K$ 个中心（生成调色板）。
> 3. **编码**：将所有向量替换为最近中心的 ID（填色）。

影响码本质量的因素：

| 参数         | 作用               | 典型值          | 权衡                                   |
| ------------ | ------------------ | --------------- | -------------------------------------- |
| **K**        | 簇的数量，决定精度 | 256, 1024, 4096 | 越大越精确，存储越多                   |
| **初始化**   | 中心点初始选择策略 | **K-Means++**   | 智能分散初始点，避免局部最优，收敛更快 |
| **迭代次数** | 最大迭代轮数       | 10-100          | 越多越精确，耗时越久                   |

### 2.2 LSH（Locality Sensitive Hashing, 局部敏感哈希）

#### 2.2.1 算法核心（局部冲突）

如果说 K-Means 是精细的 **“选代表”**，那么 LSH 则是快速的 **“粗分桶”**。

它的核心逻辑与我们熟知的传统哈希（如 MD5、SHA）截然相反：传统哈希追求 **“蝴蝶效应”**（输入微小改变，输出天翻地覆）；而 LSH 追求 **“稳定映射”**（输入微小改变，输出保持不变），从而让相似的向量落入同一个“哈希桶”中。

> [!IMPORTANT]
>
> **LSH 的核心思想是“刻意制造局部冲突”**：相似的向量以高概率被哈希到同一个桶，不相似的向量以低概率被哈希到同一个桶<sup>[[10]](#ref10)</sup>。
>
> ```mermaid
> graph LR
>     subgraph Traditional["🔴 传统哈希 (如 MD5) - 最小化冲突"]
>         direction LR
>         A["'apple'"] --> H1(Hash)
>         B["'apply'"] --> H1
>         H1 --> |分散| T1["0x5e..."]
>         H1 --> |分散| T2["0x8a..."]
>     end
>
>     subgraph LSH_Box["🟢 LSH (局部敏感) - 最大化冲突"]
>         direction LR
>         C["'apple'"] --> H2(LSH)
>         D["'apply'"] --> H2
>         H2 --> |聚合| L1["Bucket 01"]
>     end
>
>     style L1 fill:#d9f7be,stroke:#52c41a,color:#000000
>
>     Traditional --> LSH_Box
>
>     style T1 fill:#ffccc7,stroke:#ff4d4f,color:#000000
>     style T2 fill:#ffccc7,stroke:#ff4d4f,color:#000000
>
> ```

使得数学式定义为：

> [!NOTE]
>
> 一个哈希函数族 $\mathcal{H}$ 是 $(d_1, d_2, p_1, p_2)$ 敏感的，当且仅当对任意 $v_1, v_2 \in \mathbb{R}^d$：
>
> - 如果 $\text{dist}(v_1, v_2) \leq d_1$，则 $P[h(v_1) = h(v_2)] \geq p_1$
> - 如果 $\text{dist}(v_1, v_2) \geq d_2$，则 $P[h(v_1) = h(v_2)] \leq p_2$
>
> 其中 $d_1 < d_2$ 且 $p_1 > p_2$。
>
> 这个数学定义可以翻译成 **"两个承诺"**：
>
> - 承诺一（**对近邻负责**）： 如果两个向量非常像（距离小于 $d_1$），那么我保证它们大概率（概率大于 $p_1$）会被分到同一个桶里。
> - 承诺二（**对远邻负责**）： 如果两个向量非常不像（距离大于 $d_2$），那么我保证它们小概率（概率小于 $p_2$）会被分到同一个桶里。

#### 2.2.2 Random Projection（随机超平面投影）

那么，如何构造这样神奇的哈希函数？最直观的方法就是 **“切蛋糕”**。

> [!TIP]
>
> 想象向量空间是一块巨大的多维蛋糕，我们闭着眼睛随机切几刀（随机超平面）。离得很近的两个点（相似向量），大概率会被保留在同一块切片里；而离得很远的点，则很容易被某一刀切开。

> [!NOTE]
>
> **随机超平面投影**是**余弦相似度**测量方式场景下的最常用 LSH 方法<sup>[[10]](#ref10)</sup>。其**随机投影流程**如下：
>
> ```mermaid
> graph LR
>     subgraph "随机投影 LSH"
>         V[向量 v] --> P1[投影到超平面 1]
>         V --> P2[投影到超平面 2]
>         V --> P3[投影到超平面 k]
>
>         P1 --> |"v·r1 > 0 → 1"| B1[1]
>         P2 --> |"v·r2 < 0 → 0"| B2[0]
>         P3 --> |"v·r3 > 0 → 1"| B3[1]
>
>         B1 & B2 & B3 --> HC[哈希码: 101]
>     end
> ```
>
> 1. **生成随机超平面**：生成 $k$ 个随机单位向量 $r_1, r_2, ..., r_k$
> 2. **计算哈希码**：对每个输入向量 $v$，计算 $h_i(v) = \text{sign}(v \cdot r_i)$
> 3. **构建哈希表**：将具有相同哈希码的向量放入同一个桶
> 4. **查询**：将查询向量哈希，检索同一桶中的候选向量
>
> 有一个著名的结论：两个向量被随机超平面分割开的概率，直接与它们之间的夹角 $\theta$ 正相关：
>
> $$
>   P(h(x) \neq h(y)) = \frac{\theta}{\pi}
> $$
>
> 这恰好对应了余弦距离（夹角大小），因此认为随机超平面投影是专门针对余弦相似度这种相似度量方式的索引算法。

<details>
<summary>伪代码</summary>

```python
class RandomProjectionLSH:
    def __init__(self, dim, num_planes, num_tables):
        self.num_tables = num_tables
        # 每个哈希表有不同的随机超平面
        self.hyperplanes = [
            np.random.randn(num_planes, dim)
            for _ in range(num_tables)
        ]
        self.tables = [{} for _ in range(num_tables)]

    def hash(self, vector, table_idx):
        # 计算向量与超平面的点积符号
        projections = self.hyperplanes[table_idx] @ vector
        return tuple((projections > 0).astype(int))

    def insert(self, vector, label):
        for i in range(self.num_tables):
            hash_code = self.hash(vector, i)
            if hash_code not in self.tables[i]:
                self.tables[i][hash_code] = []
            self.tables[i][hash_code].append(label)

    def query(self, vector, k):
        candidates = set()
        for i in range(self.num_tables):
            hash_code = self.hash(vector, i)
            if hash_code in self.tables[i]:
                candidates.update(self.tables[i][hash_code])
        # 对候选集进行精确距离计算，返回 Top-K
        return refine_and_rank(candidates, vector, k)
```

</details>

#### 2.2.3 LSH 参数调优（捕鱼策略）

LSH 的效果高度依赖参数设置，这就像制定 **“捕鱼策略”**：

- **$k$ (比特数) $\approx$ 渔网网眼的密度**：
  网眼越密（$k$ 越大），区分度越高，但太密可能导致“漏鱼”（召回率下降）；网眼越疏，越容易捕获，但会捞进很多杂物（精度下降）。
- **$L$ (哈希表数) $\approx$ 撒网的次数**：
  一次捞不到，就多撒几次网（$L$ 增多）。撒网次数越多，捕获目标的概率越高（召回率提升），但同时也增加了体力和时间的消耗（计算和存储成本增加）。

| 参数              | 含义             | 影响                             |
| ----------------- | ---------------- | -------------------------------- |
| **k（比特数）**   | 每个哈希码的位数 | 越大桶越细，召回降低，精度提高   |
| **L（哈希表数）** | 独立哈希表的数量 | 越多召回率越高，但内存和时间增加 |
| **桶大小**        | 每个桶的容量     | 太大查询慢，太小可能漏掉相似项   |

> [!TIP]
>
> **召回率与哈希表数量的关系**：
>
> $$
>     P[\text{找到近邻}] = 1 - (1 - p^k)^L
> $$
>
> 其中 $p$ 是两个相似向量被单个超平面分到同一侧的概率。

#### 2.2.4 LSH 变体

| LSH 变体              | 适用距离度量   | 特点                                       |
| --------------------- | -------------- | ------------------------------------------ |
| **Random Projection** | 余弦相似度     | 使用随机超平面<sup>[[10]](#ref10)</sup>    |
| **MinHash**           | Jaccard 相似度 | 适用于集合数据<sup>[[10]](#ref10)</sup>    |
| **SimHash**           | 汉明距离       | 适用于文档去重<sup>[[10]](#ref10)</sup>    |
| **p-stable LSH**      | Lp 距离        | 适用于 L1/L2 距离<sup>[[10]](#ref10)</sup> |

### 2.3 NSW（Navigable Small World, 导航小世界图）

#### 2.3.1 算法核心（人脉捷径）

LSH 是靠 **“运气”**（概率）撞大运，而 NSW 则是靠 **“人脉”**（图关系）找捷径。

这基于著名的 **“六度分隔”** 理论：任意两个人之间平均只需要通过 6 个中间人就能建立联系。在向量世界里，如果我们能构建这样一张 **“小世界网络”**，就能从任意起点出发，通过几次跳跃快速找到目标<sup>[[11]](#ref11)</sup>。

```mermaid
graph TB
    subgraph "小世界图特性"
        A[节点] --> B[局部连接]
        A --> C["长程连接 (**捷径**)"]
        B --> D["高聚类系数<br/>邻居之间高度互连"]
        C --> E["短路径长度<br/>O(log n) 跳数"]
    end

    style D fill:#bae7ff,stroke:#1890ff,color:#000000
    style E fill:#d9f7be,stroke:#52c41a,color:#000000
```

#### 2.3.2 NSW 图构建（新人融入）

构建 NSW 的过程，就像一个**新人融入社交圈**的过程。当一个新节点（新向量）加入时，它不能孤立存在，必须建立连接：

```mermaid
flowchart LR
    A[新人加入 v] --> B[1. 随机搭讪: 选入口点]
    B --> C[2. 朋友介绍: <br/>贪婪搜索 M 个近邻]
    C --> D[3. 建立友谊: 双向连接]
    D --> E[融入完成]

    style C fill:#1890ff,color:#fff
```

1. **随机搭讪**：随机找个现有节点作为入口。
2. **朋友介绍**：通过入口点，不断认识“更接近自己兴趣”的朋友（贪婪搜索）。
3. **建立友谊**：找到最投缘的 $M$ 个朋友，建立双向联系。

这样，随着新人不断加入，整个网络就自然形成了既有小圈子又有远方朋友的结构。

<details>
<summary>伪代码</summary>

```python
class NSW:
    def __init__(self, M=16):
        self.M = M  # 每个节点的最大邻居数
        self.graph = {}

    def insert(self, vector, label):
        if len(self.graph) == 0:
            self.graph[label] = {'vector': vector, 'neighbors': []}
            return

        # 1. 贪婪搜索找到当前 M 个最近邻居
        neighbors = self.greedy_search(vector, self.M)

        # 2. 建立双向连接
        self.graph[label] = {'vector': vector, 'neighbors': neighbors}
        for n in neighbors:
            self.graph[n]['neighbors'].append(label)
            # 如果邻居数超过 M，移除最远的
            if len(self.graph[n]['neighbors']) > self.M:
                self._prune_neighbors(n)

    def greedy_search(self, query, k, entry=None):
        if entry is None:
            entry = random.choice(list(self.graph.keys()))

        visited = set()
        candidates = [(self._distance(query, entry), entry)]
        results = []

        while candidates:
            dist, current = heapq.heappop(candidates)
            if current in visited:
                continue
            visited.add(current)
            results.append((dist, current))

            # 探索邻居
            for neighbor in self.graph[current]['neighbors']:
                if neighbor not in visited:
                    d = self._distance(query, neighbor)
                    heapq.heappush(candidates, (d, neighbor))

        return [r[1] for r in sorted(results)[:k]]
```

</details>

#### 2.3.3 NSW 的搜索（接力问路）

NSW 的搜索就像是一场 **“接力问路”**。

我们不需要遍历整个数据海洋，而是从入口点开始，每次都向当前的邻居们打听：“你们谁离目的地（查询向量）最近？”然后迅速跳到那个最接近的邻居身上。由于“长程捷径”的存在，这种跳跃通常能以惊人的速度逼近目标。

```mermaid
graph LR
    subgraph "NSW 贪婪搜索"
        direction LR
        Q[查询向量] --> E[入口点]
        E --> |"移动到更近邻居"| N1[节点1]
        N1 --> |"继续移动"| N2[节点2]
        N2 --> |"继续移动"| N3[节点3]
        N3 --> |"局部最优"| R[返回结果]
    end

    style Q fill:#ffd591,color:#000000
    style R fill:#b7eb8f,color:#000000
```

#### 2.3.4 NSW 复杂度分析

| 指标       | 复杂度           | 说明                         |
| ---------- | ---------------- | ---------------------------- |
| 构建时间   | O(n × log n × M) | n 个向量，每个搜索 O(log n)  |
| 搜索时间   | O(log^k n)       | k 是小世界指数，通常 k ≈ 1-2 |
| 空间复杂度 | O(n × M)         | 每个节点存储 M 个邻居        |

**NSW 的局限性（扁平地图的困境）**：

虽然 NSW 表现不错，但它本质上还是一张 **“扁平的地图”**。当数据规模膨胀到亿级时，单纯依靠“问路”会出现问题：

1. **陷入死胡同（局部最优）**：大概率跳到一个局部最近点，却发现周围没有路通向真正的全局最近点。
2. **缺乏高速公路**：所有的跳跃都在同一层级进行，缺乏一种“先坐飞机到城市，再坐车到街道”的分层导航机制。

为了解决“扁平”问题，我们需要在这张地图上架设 **“立体高架桥”** —— 这正是下一章 **HNSW** 的核心思想。

---

## 3. 高级索引算法（向量索引的落地）

本章介绍三种最重要的高级索引算法（也是实际向量数据库最常用的）：HNSW（分层导航小世界图）、IVF（倒排文件索引）系列和 PQ（积量化）。

### 3.1 HNSW（Hierarchical Navigable Small World, 分层导航小世界图）<sup>[[12]](#ref12)</sup>

#### 3.1.1 算法核心（立体交通）

如果说 NSW 是错综复杂的地面交通网，那么 HNSW 就是在此基础上修建了 **“立体交通体系”**（飞机-高铁-汽车）。

它通过引入 **Skip List（跳表）** 的思想，将图结构分层：

- **顶层（国际航线）**：节点稀疏，负责超长距离的“洲际跳转”，快速锁定大概区域。
- **中层（高速公路）**：节点较密，负责区域内的快速接近。
- **底层（社区街道）**：包含所有节点，负责最后几百米的精准定位。

这种结构让搜索变成了：**“先坐飞机到城市 $\rightarrow$ 再开车到社区 $\rightarrow$ 最后步行找门牌”**，从而实现了极致的检索效率。

```mermaid
graph LR
    subgraph "HNSW 多层结构"
        L3["Layer 3 (最稀疏)<br/>长距离跳跃"]
        L2["Layer 2<br/>中等密度"]
        L1["Layer 1<br/>较密集"]
        L0["Layer 0 (最密集)<br/>所有节点"]
    end

    Q[查询] --> L3
    L3 --> |"快速定位区域"| L2
    L2 --> |"逐步细化"| L1
    L1 --> |"精确搜索"| L0
    L0 --> R[最终结果]

    style L3 fill:#ffe58f,color:#000000
    style L0 fill:#91d5ff,color:#000000
    style R fill:#b7eb8f,color:#000000
```

> [!TIP]
>
> **层级“晋升”机制**：就像公司的组织架构一样，HNSW 的层级也是金字塔形的：
>
> - 所有人都属于底层员工（Layer 0）。
> - 通过“抛硬币”（概率函数）决定谁能晋升为经理（Layer 1）、总监（Layer 2）甚至 CEO（顶层）。
> - 这种机制保证了高层节点的稀疏性，从而构建出高效的跳跃网络。
>
> **层级概率**：每个节点被分配到第 $l$ 层的概率为：
>
> $$
>     P(\text{level} = l) = \frac{1}{m_L} \cdot \left(\frac{1}{m_L}\right)^{l-1} = \left(\frac{1}{m_L}\right)^l
> $$
>
> 其中 $m_L$ 是层级因子（通常为 $\frac{1}{\ln(M)}$，M 是最大连接数）。

#### 3.1.2 HNSW 图构建（精准空降）

HNSW 插入新节点的过程，就像是一次 **“新住户搬家融入社区”** 的过程：

1. **快速定位（找小区）**：从最顶层（宏观地图）开始，只问路不交友。快速跳跃，找到目标大概所在的区域。这就像先确定要搬到哪个城市、哪个行政区。
2. **逐层落户（建社交）**：当到达了为你分配的 **“最高社交层级”**（比如你被判定为“热心朝阳群众”，层级较高）时，就开始 **“停下来交朋友”**。
3. **全面融入**：从这一层开始，一直到最底层（Layer 0），在每一层你都要找到周围离你最近的 $M$ 个邻居，并与他们交换联系方式（建立双向连接）。这样，不仅你在每层都有了圈子，同时也成为了别人的“捷径”。

```mermaid
flowchart TD
    Start[新节点 q 入场] --> LevelCalc[1. 晋升判定: <br/>随机决定最大层级 L_max]

    subgraph Phase1 ["第一阶段: 高空速降 (只搜不连)"]
        direction LR
        P1_Search[贪婪搜索: 快速逼近] --> P1_Down[逐层下降]
        P1_Down --> |"未到 L_max"| P1_Search
    end

    subgraph Phase2 ["第二阶段: 地面建联 (边搜边连)"]
        direction LR
        P2_Layer["到达层级 L_max"] --> P2_Search[每层搜索: <br/>ef_construction 个邻居]
        P2_Search --> P2_Link[建立连接: <br/>选 M 个最近邻居]
        P2_Link --> P2_Prune[启发式剪枝: <br/>保持连接虽然少但优质]
        P2_Prune --> P2_Next{还有下一层?}
        P2_Next --> |Yes| P2_Down[继续下降] --> P2_Search
        P2_Next --> |No| End[插入完成]
    end

    LevelCalc --> Phase1
    Phase1 --> |"到达 L_max"| Phase2

    style LevelCalc fill:#e6f7ff,stroke:#1890ff,color:#000000
    style P2_Link fill:#d9f7be,stroke:#52c41a,color:#000000
    style P2_Prune fill:#fff7e6,stroke:#fa8c16,color:#000000
```

> [!NOTE]
>
> **启发式剪枝 (Heuristic Pruning)**：**"不仅选最近的，还要选分布广的"** 的邻居选择策略。
>
> 假设你要在微信里选 5 个朋友做“紧急联系人”（建立连接）。**普通策略（只看距离）** 选了 5 个住在你楼下的邻居。如果你要联系住在另一个城市的人，消息传不出去，因为你的圈子太窄了（局部最优陷阱）。
>
> **启发式剪枝策略（HNSW 的做法）** 则先选了 1 个楼下邻居，然后想选第 2 个邻居时："哎，第 2 个邻居虽然也离你很近，但他离第 1 个邻居也近！既然你可以通过第 1 个邻居找到他，那就不需要直接连他了。可以连一个虽然稍远一点，但方向完全不同的人（比如住在隔壁区的同学）。"
>
> 通过这种 **“喜新厌旧”**（偏好那些不能通过现有邻居快速到达的点）的策略，HNSW 构建的图既有短边（保留细节），又有长边（跨越区域），大大提升了搜索时的“导航”效率。
>
> 启发式剪枝的核心目的是优化图的 **连通性**，防止 **“抱团”** 现象（即所有邻居都聚在一起），从而在图中建立更高效的“高速公路”。

<details>
<summary>伪代码</summary>

```python
class HNSW:
    def __init__(self, M=16, ef_construction=200, ml=None):
        self.M = M                       # 每层最大连接数
        self.M0 = 2 * M                  # Layer 0 最大连接数
        self.ef_construction = ef_construction  # 构建时搜索宽度
        self.ml = ml or 1 / math.log(M)  # 层级因子
        self.layers = []
        self.entry_point = None
        self.max_level = 0

    def _random_level(self):
        """随机生成节点所在的最高层级"""
        level = 0
        while random.random() < self.ml and level < self.max_level + 1:
            level += 1
        return level

    def insert(self, vector, label):
        level = self._random_level()

        if self.entry_point is None:
            self.entry_point = label
            self.max_level = level
            self._add_node(label, vector, level)
            return

        # Phase 1: 从顶层贪婪搜索到目标层
        ep = self.entry_point
        for l in range(self.max_level, level, -1):
            ep = self._search_layer(vector, ep, 1, l)[0]

        # Phase 2: 在目标层及以下建立连接
        for l in range(min(level, self.max_level), -1, -1):
            candidates = self._search_layer(vector, ep, self.ef_construction, l)
            neighbors = self._select_neighbors(vector, candidates, self.M if l > 0 else self.M0, l)
            self._add_connections(label, neighbors, l)
            ep = candidates[0]

        # 更新入口点
        if level > self.max_level:
            self.entry_point = label
            self.max_level = level

    def _select_neighbors(self, vector, candidates, M, level):
        """启发式邻居选择：兼顾距离和多样性"""
        # Simple heuristic: 选择最近的 M 个
        # Advanced: 可以使用 RNG（Relative Neighborhood Graph）启发式
        return sorted(candidates, key=lambda c: self._distance(vector, c))[:M]
```

</details>

#### 3.1.3 HNSW 的搜索（卫星变焦）

HNSW 的搜索过程，就像在 **Google Earth** 上找一家烤鸭店：

1. **太空视角（顶层）**：转动地球仪，快速锁定到了“亚洲”（不用看美洲）。
2. **高空视角（中层）**：放大地图，快速定位到“中国 $\rightarrow$ 北京 $\rightarrow$ 朝阳区”。
3. **街景视角（底层）**：进入街道，精确寻找“xx 烤鸭店”。

通过这种 **“由粗到细、逐层放大”** 的方式，避免在茫茫数据中盲目寻找。

```mermaid
graph TB
    %% Define Layers
    subgraph L2 ["Layer 2: 太空视角 (宏观)"]
        direction LR
        P0(( )) --> |"1. 贪婪跳跃"| P1(( ))
        P1 --> |"跨洲际"| P2(( ))
        P2 -.-> |"锁定亚洲"| Down1(⬇️)
    end

    subgraph L1 ["Layer 1: 高空视角 (区域)"]
        direction LR
        P3(( )) --> |"2. 贪婪跳跃"| P4(( ))
        P4 --> |"跨省市"| P5(( ))
        P5 -.-> |"锁定北京"| Down2(⬇️)
    end

    subgraph L0 ["Layer 0: 街景视角 (精细)"]
        direction LR
        P6(( )) --> |"3. 局部搜索"| P7(( ))
        P7 --> |"ef_search"| Target((📍 目标))
    end

    Entry((入口)) --> L2
    L2 --> |"降落"| L1
    L1 --> |"降落"| L0

    %% Styling
    linkStyle 0,1,3,4,6,7 stroke:#1890ff,stroke-width:2px;
    linkStyle 2,5,8 stroke:#fa8c16,stroke-width:2px,stroke-dasharray: 5 5;

    classDef l2 fill:#fff7e6,stroke:#ffd591,color:#000
    classDef l1 fill:#e6f7ff,stroke:#69c0ff,color:#000
    classDef l0 fill:#f6ffed,stroke:#b7eb8f,color:#000

    class L2 l2
    class L1 l1
    class L0 l0

    classDef highlight fill:#ffccc7,stroke:#ff4d4f,color:#000;
    class Target highlight;
```

<details>
<summary>伪代码</summary>

```python
def search(self, query, k, ef_search=None):
    ef = ef_search or k

    # Phase 1: 从顶层贪婪下降
    ep = self.entry_point
    for l in range(self.max_level, 0, -1):
        ep = self._search_layer(query, ep, 1, l)[0]

    # Phase 2: 在 Layer 0 进行宽度优先搜索
    candidates = self._search_layer(query, ep, ef, 0)

    return sorted(candidates, key=lambda c: self._distance(query, c))[:k]

def _search_layer(self, query, entry_point, ef, level):
    visited = {entry_point}
    candidates = [(self._distance(query, entry_point), entry_point)]
    result = list(candidates)

    while candidates:
        dist, current = heapq.heappop(candidates)

        # 如果当前距离大于结果中最远的距离，停止
        if len(result) >= ef and dist > result[-1][0]:
            break

        # 探索邻居
        for neighbor in self._get_neighbors(current, level):
            if neighbor not in visited:
                visited.add(neighbor)
                d = self._distance(query, neighbor)
                if len(result) < ef or d < result[-1][0]:
                    heapq.heappush(candidates, (d, neighbor))
                    result.append((d, neighbor))
                    result = sorted(result)[:ef]

    return [r[1] for r in result]
```

</details>

#### 3.1.4 HNSW 参数调优

HNSW 的参数调优本质上是在做 **“质量与速度”的极限拉扯**。我们可以将其看作是 **修建和运营高速公路** 的权衡：

- **$M$ (车道数)**：车道越多（连接越多），路网越四通八达（召回率高），但造价越贵（内存消耗大，构建慢）。
- **`ef_construction` (施工标准)**：地基打得越深、勘测越仔细（搜索越广），路面质量越好（索引更优），但工期也会显著拉长。
- **`ef_search` (导航搜索范围)**：在开车导航时，搜索的范围越大（查看更多备选路线），越容易找到最佳出口（高召回），但计算耗时也越久（高延迟）。

| 参数                | 含义           | 推荐值  | 影响                           |
| ------------------- | -------------- | ------- | ------------------------------ |
| **M**               | 每层最大邻居数 | 16-64   | 越大召回越高，但构建和搜索更慢 |
| **ef_construction** | 构建时搜索宽度 | 100-200 | 越大索引质量越高               |
| **ef_search**       | 搜索时探索宽度 | 10-1000 | 越大召回越高，延迟越大         |
| **ml**              | 层级因子       | 1/ln(M) | 控制层级分布                   |

**性能与召回率权衡**：

```mermaid
graph LR
    subgraph Knobs ["🎛️ 参数调节 (加大投入)"]
        direction TB
        K1["M (车道数): 16 ➔ 64"]
        K2["ef (搜索宽): 100 ➔ 800"]
    end

    subgraph Impact ["⚖️ 权衡结果 (双刃剑)"]
        direction TB
        Good["✅ 召回率 (Recall)<br/>95% ➔ 99.9%"]
        Bad["⚠️ 延迟 (Latency)<br/>1ms ➔ 10ms"]
        Cost["📉 内存/构建 (Cost)<br/>增加 2-4 倍"]
    end

    K1 ==> Good & Bad & Cost
    K2 ==> Good & Bad

    style Good fill:#d9f7be,stroke:#52c41a,color:#000
    style Bad fill:#fff1f0,stroke:#ff4d4f,color:#000
    style Cost fill:#fffbe6,stroke:#fa8c16,color:#000
    style K1 fill:#e6f7ff,stroke:#1890ff,color:#000
    style K2 fill:#e6f7ff,stroke:#1890ff,color:#000
```

#### 3.1.5 HNSW 复杂度分析

| 指标     | 复杂度                  | 说明                         |
| -------- | ----------------------- | ---------------------------- |
| 构建时间 | O(n × log n × M × ef_c) | ef_c = ef_construction       |
| 搜索时间 | O(log n × ef × M)       | 实际通常 < 1ms               |
| 内存占用 | O(n × M × L)            | L 是平均层数 ≈ log(n)/log(M) |

### 3.2 IVF（Inverted File Index, 倒排文件索引）系列

#### 3.2.1 算法核心（分而治之）

如果说 **HNSW** 是靠 **“社交网络”** 找人的人脉，那么 **IVF** 就是靠 **“分而治之”** 找书的 **“图书馆索引”**。

**IVF** 使用聚类算法（通常是 K-Means）将向量空间划分为多个 Voronoi 区域（簇），查询时只搜索最相关的几个区域<sup>[[13]](#ref13)</sup>。

```mermaid
graph TB
    subgraph S["🔍 找一本《乔布斯传》"]
        direction TB
        Q[🔍《乔布斯传》] --> FIND[1. 目录匹配:<br/>定位最近的 nprobe 个分类]
        FIND --> SEARCH[2. 局部查找:<br/>只搜'科技'和'传记'书架]
        SEARCH --> RESULT[✅ 找到目标]
    end

    subgraph I["IVF: 图书馆分类索引"]
        direction TB
        DATA["📚 原始书库 (N 本书)"] --> CLUSTER[K-Means 自动分类]

        CLUSTER --> |"历史类"| C1[🗂️ 书架 1]
        CLUSTER --> |"科技类"| C2[🗂️ 书架 2]
        CLUSTER --> |"..."| C3[🗂️ 书架 ...]
        CLUSTER --> |"艺术类"| CK[🗂️ 书架 K]

        C1 --> V1[📖 书本列表 1]
        C2 --> V2[📖 书本列表 2]
        CK --> VK[📖 书本列表 K]
    end

    style CLUSTER fill:#1890ff,color:#fff
    style FIND fill:#fa8c16,color:#fff
```

**工作流程**：

1. **分类（聚类）**：先将所有书本（向量）按内容归类，分别放入 $K$ 个不同的“书架”（簇/Bucket）。
2. **检索（查表）**：找书时，先确定这本书最可能出现在哪几个书架（`nprobe` 个最近的簇），然后**只去这几个书架**里逐本翻找。
3. **效果**：直接忽略了绝大多数无关的书架，从而将搜索范围从“整个图书馆”缩小到了“几个书架”。

**数学表述**：

1. **索引构建**：使用 K-Means 将 $n$ 个向量划分为 $K$ 个簇。
2. **查询**：给定查询向量 $q$，首先找到距离 $q$ 最近的 `nprobe` 个簇中心，仅在这些簇包含的向量中进行精确搜索。
3. **效果**：搜索复杂度从 $O(n)$ 降为 $O(K + \text{nprobe} \times \frac{n}{K})$。

#### 3.2.2 IVFFlat

IVFFlat（Inverted File with Flat vectors）是 IVF 家族中最基础的成员，它就像是一个 **珍藏完整原本的图书馆**。

- **IVF (倒排)**：书本按主题分架摆放（聚类），找书时只需看特定的几个书架。
- **Flat (平铺)**：书架上放的是厚重的 **完整原本**（完整向量），没有做任何删减或压缩。

这种方式虽然保证了内容的 **原汁原味**（精度高），但也意味着书架必须很大（内存占用高），且每次对比都要阅读全文（计算慢）。

> [!NOTE]
>
> IVF 与 IVFFlat 两个概念容易混淆，其实它们是 **“骨架”** 与 **“血肉”** 的关系：
>
> - **IVF (索引结构)**：决定了 **“怎么找”**（通过聚类缩小范围）。
> - **Flat (存储方式)**：决定了 **“存什么”**（存储未压缩的原始向量）。
>
> **IVFFlat** 就是两者的结合。如果我们把存储方式换成由 PQ（积量化）压缩后的编码，就变成了 **IVF-PQ**（下一节介绍），那时候书架上放的就是“缩印本”了。

<details><summary>伪代码</summary>

```python
class IVFFlat:
    def __init__(self, nlist):
        self.nlist = nlist  # 簇的数量
        self.centroids = None
        self.inverted_lists = [[] for _ in range(nlist)]

    def train(self, vectors):
        """使用 K-Means 训练聚类中心"""
        self.centroids = kmeans(vectors, self.nlist)

    def add(self, vectors, labels):
        """将向量分配到对应的簇"""
        for vec, label in zip(vectors, labels):
            cluster_id = self._find_nearest_centroid(vec)
            self.inverted_lists[cluster_id].append((label, vec))

    def search(self, query, k, nprobe):
        """搜索最近的 k 个向量"""
        # 1. 找到最近的 nprobe 个簇
        nearest_clusters = self._find_nearest_centroids(query, nprobe)

        # 2. 在这些簇中精确搜索
        candidates = []
        for cluster_id in nearest_clusters:
            for label, vec in self.inverted_lists[cluster_id]:
                dist = self._distance(query, vec)
                candidates.append((dist, label))

        # 3. 返回 Top-K
        return sorted(candidates)[:k]
```

</details>

#### 3.2.3 IVF 参数调优（图书管理）

IVF 的参数配置，本质上是在调整 **“书架的密度”** 和 **“翻找的耐心”**：

- **`nlist` (书架数量)**：
  - 分得太少（`nlist` 小）：每个书架的书像山一样高，找起来累死人（桶内搜索慢）。
  - 分得太多（`nlist` 大）：书架太多，光是定位“在哪个书架”都要花半天（聚类中心匹配慢）。
  - **经验法则**：通常设置为 $\sqrt{n}$，保持平衡。
- **`nprobe` (翻找范围)**：
  - 翻得少（`nprobe` 小）：速度快，但如果书被归类到了隔壁书架（边界效应），就漏掉了（召回率低）。
  - 翻得多（`nprobe` 大）：越保险，召回率越高，但越接近全量搜索（速度变慢）。

| 参数         | 建议值                 | 说明                      |
| ------------ | ---------------------- | ------------------------- |
| **nlist**    | sqrt(n) 或 4×sqrt(n)   | 簇的数量，n 是向量数      |
| **nprobe**   | nlist×0.01 ~ nlist×0.1 | 查询时搜索的簇数          |
| **训练数据** | min(n, 256×nlist)      | 用于 K-Means 训练的样本数 |

**nlist 经验公式**：

| 数据规模       | nlist 建议值 | nprobe 建议值 |
| -------------- | ------------ | ------------- |
| n < 1M         | 1,000        | 10-50         |
| 1M ≤ n < 10M   | 4,096        | 50-100        |
| 10M ≤ n < 100M | 16,384       | 100-200       |
| n ≥ 100M       | 65,536       | 200-500       |

### 3.3 PQ（Product Quantization，积量化）

#### 3.3.1 算法核心（拼图画像）

PQ 的核心思想是 **“切分组合”**，就像警方的 **拼图画像还原真凶**：

1. **切分 (Product)**：把一个复杂的 $d$ 维长向量（比如一张人脸照片），切分成 $M$ 个小段（比如眼睛、鼻子、嘴巴）。
2. **量化 (Quantization)**：对每个部位，我们只提供 256 种“标准零件”（Codebook）。
   - 这个人的“眼睛”最像“标准眼 No.5”，那就记下 `5`。
   - 这个人的“鼻子”最像“标准鼻 No.88”，那就记下 `88`。
3. **压缩**：原本需要存储大量浮点数的原始向量，现在只需要存储几个简短的 **ID 号**（如 `[5, 88, ...]`）。

虽然损失了一些细节（精度略降），但存储空间瞬间缩小了几十倍。

**PQ（Product Quantization，积量化）** 是一种极具效率的向量压缩技术，将高维向量分割为多个子向量，分别量化后用紧凑的码字表示<sup>[[13]](#ref13)</sup>。

```mermaid
graph TB
    subgraph "PQ 编码过程"
        V["原始向量<br/>128 维"]
        V --> S1["子向量 1<br/>16 维"]
        V --> S2["子向量 2<br/>16 维"]
        V --> S8["...<br/>子向量 8<br/>16 维"]

        S1 --> Q1["量化<br/>K=256"]
        S2 --> Q2["量化<br/>K=256"]
        S8 --> Q8["量化<br/>K=256"]

        Q1 --> C1["码字: 42"]
        Q2 --> C2["码字: 189"]
        Q8 --> C8["码字: 73"]

        C1 & C2 & C8 --> CODE["PQ 编码: [42,189,...,73]<br/>8 字节"]
    end

    style V fill:#ffe58f,color:#000000
    style CODE fill:#b7eb8f,color:#000000
```

**数学表述**：将 $d$ 维向量分割为 $M$ 个子向量，每个子向量独立进行 K-Means 聚类（训练出 $M$ 个各自的码本）：

$$
    v = [v_1, v_2, ..., v_M], \quad v_i \in \mathbb{R}^{d/M}
$$

存储时，每个子向量 $v_i$ 用其最近的聚类中心 ID（码字）$q_i$ 替代：

$$
    \text{Code}(v) = [q_1(v_1), q_2(v_2), ..., q_M(v_M)]
$$

#### 3.3.2 PQ 的压缩率

PQ 的压缩效果就像把一本 **500 页的厚书（原始向量）**，浓缩成了一张 **8 页的小纸条（PQ 编码）**。

- **原始版**：需要 512 字节来记录完整信息。
- **PQ 版**：只需要 8 字节（8 个 ID）就能描述大致轮廓。

这种 **64 : 1** 的极致压缩，使得单机内存装下亿级数据成为可能。

假设原始向量为 $d=128$ 维 FP32（512 字节），使用 $M=8$ 个子空间，每个子空间 $K=256$ 个聚类中心：

| 项目         | 计算                          | 结果           |
| ------------ | ----------------------------- | -------------- |
| **原始向量** | 128 × 4 字节                  | 512 字节       |
| **PQ 编码**  | 8 × 1 字节（log2(256)=8 bit） | **8 字节**     |
| **压缩倍率** | 512 / 8                       | **64 倍**      |
| **码本大小** | 8 × 256 × 16 × 4 字节         | 128 KB（共享） |

#### 3.3.3 PQ 的搜索（价目表速查）

PQ 为了极致的计算速度，发明了一种 **“查表速算”** 的技巧 —— **ADC（Asymmetric Distance Computation，非对称距离计算）**。

这就像收银员的 **“扫码算账”**：

1. **预制价目表（Pre-compute）**：当查询向量 $q$ 到来时，先计算它与所有 256 个“标准零件”（聚类中心）的距离。这就像收银员手里拿到了一张今天的《商品价目表》。
2. **扫码求和（Lookup & Sum）**：对于数据库中的压缩向量（只是一串 ID，如 `[5, 88]`），不需要做复杂的几何计算，只需去《价目表》里查 ID=5 和 ID=88 的数值，然后 **加起来** 就行。

运算量从大量的浮点乘加（计算 $d$ 维距离），变成了极简的 **查表求和**（$M$ 次加法），速度提升显著。

**数学表述**：

1. **预计算**：生成查询向量 $q$ 到每个子空间所有 $K$ 个码字的距离表 $D$。

$$
    D_{ij} = \|q_i - c_{ij}\|^2, \quad i \in [1,M], j \in [1,K]
$$

2. **查表计算**：对每个编码向量，通过查表累加距离。

$$
    \|q - \tilde{v}\|^2 \approx \sum_{i=1}^{M} D_{i, \text{code}_i(v)}
$$

<details>
<summary>伪代码</summary>

```python
class ProductQuantization:
    def __init__(self, d, M, Ks=256):
        self.d = d       # 向量维度
        self.M = M       # 子空间数量
        self.Ks = Ks     # 每个子空间的聚类数
        self.ds = d // M  # 子向量维度
        self.codebooks = None  # M 个码本，每个 Ks × ds

    def train(self, vectors):
        """训练 M 个独立的码本"""
        self.codebooks = []
        for m in range(self.M):
            sub_vectors = vectors[:, m*self.ds:(m+1)*self.ds]
            centroids = kmeans(sub_vectors, self.Ks)
            self.codebooks.append(centroids)

    def encode(self, vector):
        """将向量编码为 M 个码字"""
        codes = []
        for m in range(self.M):
            sub_vec = vector[m*self.ds:(m+1)*self.ds]
            code = self._find_nearest(sub_vec, self.codebooks[m])
            codes.append(code)
        return np.array(codes, dtype=np.uint8)

    def compute_distance_table(self, query):
        """预计算查询到所有码字的距离表"""
        table = np.zeros((self.M, self.Ks))
        for m in range(self.M):
            sub_query = query[m*self.ds:(m+1)*self.ds]
            for k in range(self.Ks):
                table[m, k] = np.sum((sub_query - self.codebooks[m][k])**2)
        return table

    def search_with_table(self, table, codes, k):
        """使用距离表计算近似距离"""
        distances = []
        for i, code in enumerate(codes):
            dist = sum(table[m, code[m]] for m in range(self.M))
            distances.append((dist, i))
        return sorted(distances)[:k]
```

</details>

#### 3.3.4 IVFPQ：IVF + PQ 组合（强强联手）

IVFPQ 是将 IVF 的 **“分而治之”** 与 PQ 的 **“极致压缩”** 完美结合的产物（如 Faiss 标配）。

它就像建立了一个 **“现代化微缩档案馆”**：

1. **分类归档 (IVF)**：先把档案按类别分到不同的柜子（减少搜索范围）。
2. **存差值 (Residual)**：柜子里不存完整档案，只存 **“该档案与标准模板（聚类中心）的差异”**。因为同类档案长得很像，存“差异”比存“全貌”数值更小，更易量化。
3. **微缩拍摄 (PQ)**：把这些“差异数据”进一步切分、量化，拍成极小的 **“微缩胶卷”**（PQ Code）。

```mermaid
graph TD
    subgraph "IVFPQ: 存差值的微缩档案"
        V[原始向量] --> IVF[1. IVF 聚类: 找到所属中心 C]
        IVF --> R_Calc[2. 计算残差: <br/>R = 向量 - 中心 C]
        R_Calc --> PQ[3. PQ 量化: </br>对残差 R 进行压缩]
        PQ --> Store["📦 存储: {簇ID, PQ编码}"]
    end

    style IVF fill:#1890ff,color:#fff
    style PQ fill:#52c41a,color:#fff
    style R_Calc fill:#fa8c16,color:#fff
```

**核心优势**：

- **搜索快**：IVF 排除了大部分无关数据。
- **省内存**：PQ 把向量压缩了 几十倍。
- **精度高**：**残差编码**（$r = v - c$）使得量化的对象数值范围更小、分布更集中，从而大幅降低了量化误差。

#### 3.3.5 PQ 变体（各显神通）

PQ 虽然强大，但并非万能。为了在 **精度、速度、内存** 之间找到更极致的平衡，衍生出了多种变体。

这就像我们 **保存一张高清照片（向量）的不同策略**：

- **PQ (标准版)**：**“切块找替身”**。把照片切成 16 小块，每块用一个“标准贴纸”代替。
- **OPQ (进阶版)**：**“旋转再切块”**。切之前先 **找好角度**（旋转坐标轴），顺着纹理切，保留更多细节。
- **SQ (极速版)**：**“降低分辨率”**。不切块，直接把数据精度从“高清 (FP32)”降级为“标清 (INT8)”，简单粗暴，计算最快。
- **RQ (精修版)**：**“层层修补”**。先画个大概轮廓，再画细节，再画毛孔……用多层残差不断逼近原图。
- **RaBitQ (极限版)**：**“黑白简笔画”**。直接处理成 0 和 1（二值化），极致省地，但只剩骨架。

| 算法       | 核心特性      | 适用场景   | 优势与代价                  |
| :--------- | :------------ | :--------- | :-------------------------- |
| **PQ**     | 基础分块      | 通用大规模 | 基准方案，平衡性最好        |
| **OPQ**    | **旋转** + PQ | 高精度要求 | 召回率更高，但预处理变慢    |
| **SQ**     | **标量** 降准 | 简单快速   | 计算极快，但压缩率有限 (4x) |
| **RQ**     | **残差** 逼近 | 极高精度   | 还原度高，但搜索很慢        |
| **RaBitQ** | **二值** 化   | 内存受限   | 极限压缩 (32x+)，精度损失大 |

---

## 4. 磁盘索引与 GPU 加速（空间与时间的突破）

当数据规模超出内存容量，或需要极致性能时，需要考虑磁盘索引和 GPU 加速方案。

### 4.1 DiskANN：突破内存限制的图索引

#### 4.1.1 算法核心（前店后厂）

前面的算法（如 HNSW）都像把所有商品都摆在 **市中心昂贵的展示厅（内存）** 里，虽然拿取方便，但租金太贵，放不下多少东西。

**DiskANN** 的思路是 **“展示厅 + 仓库”** 的混合模式：

```mermaid
graph LR
    subgraph "DiskANN: 前店后厂架构"
        direction TB

        subgraph Store["🏢 展示厅 (RAM)"]
            direction LR
            Entry["🚪 导航入口"]
            Catalog["📖 平板目录 (PQ 压缩向量)"]
            Entry --> Catalog
        end

        subgraph Warehouse["🏭 大仓库 (SSD)"]
            direction LR
            Map["🗺️ 仓库地图 (Adjacency List)"]
            FullGoods["📦 真实商品 (完整向量)"]
            Map --> FullGoods
        end

        Q[客户查询] --> Store
        Store --> |"1. 快速粗选"| Robot[🤖 取货指令]
        Robot --> Warehouse
        Warehouse --> |"2. 精准再验"| Result[✅ 交付]
    end
    style Store fill:#ffffff,stroke:#1890ff,stroke-width:2px,color:#1890ff
    style Warehouse fill:#ffffff,stroke:#fa8c16,stroke-width:2px,color:#fa8c16

    classDef ram fill:#e6f7ff,stroke:#69c0ff,color:#000
    classDef ssd fill:#fff7e6,stroke:#ffc069,color:#000
    classDef action fill:#f6ffed,stroke:#b7eb8f,color:#000
    classDef query fill:#fff,stroke:#000,color:#000

    class Entry,Catalog ram
    class Map,FullGoods ssd
    class Robot,Result action
    class Q query
```

1. **内存（展示厅）**：只放一本薄薄的 **“商品目录”**（压缩的 PQ 向量），用来快速查阅。
2. **SSD（大仓库）**：把占地方的 **“真实商品”**（完整向量和图结构）都堆在便宜的郊区仓库（SSD）里。
3. **搜索**：先在目录上选好，再派机器人去仓库精准取货。

**效果**：用不到 1/10 的内存，就能管理 10 倍的数据量，且速度损失很小。

**DiskANN** 由微软研究院开发，专为解决 **十亿级向量无法完全载入内存** 的问题而设计<sup>[[16]](#ref16)</sup>。

#### 4.1.2 Vamana 图构建（超级单层）

如果说 HNSW 是 **“多层立交桥”**，那么 Vamana 就是 **“含超长隧道的平面地铁网”**。

**“如果你的朋友 A 离 B 很近，你就没必要直接连 B 了（借道 A 即可）。要把宝贵的名额留给那些——现在的圈子接触不到的远方朋友 C。”**

```mermaid
flowchart LR
    subgraph "Vamana 建图: 打造超级捷径"
        direction LR
        Init[1. 随机初始化] --> Iter[2. 迭代优化]
        Iter --> Search[3. 贪婪搜索: 找一群候选人]
        Search --> Prune[4. α-RNG 剪枝: <br/>踢掉'借道也能到'的冗余邻居<br/>保留'方向独特'的远方朋友]
        Prune --> Link[5. 建立双向连接]
        Link --> Check{收敛?}
        Check -->|No| Iter
        Check -->|Yes| Finish[输出: 稀疏但高效的图]
    end

    style Prune fill:#fff7e6,stroke:#fa8c16,color:#000
```

Vamana 通过这种 **“喜新厌旧、去重求远”** 的策略，在**单层图**中构建出了类似“小世界”的高效导航能力。这便是极具侵略性的 **$\alpha$-RNG 剪枝策略**，强行在图中打通了许多 **“远距离捷径”**。Vamana 这种单层图结构特别利于减少磁盘的随机读取次数，因此非常适合**磁盘索引**。

> [!TIP]
>
> **$\alpha$-RNG 剪枝的核心逻辑**：
>
> 对于候选邻居 $p$，如果存在另一个已选邻居 $p'$ 满足：
>
> $$
>     \alpha \cdot d(p, p') < d(v, p)
> $$
>
> 意味着 $p$ 和 $p'$ 离得太近（冗余，可以通过 $p'$ 快速到达 $p$），则 **剔除 $p$**。
>
> 参数 $\alpha \geq 1$ 越大，允许保留的边越长（修的捷径越多），图的鲁棒性越强。

#### 4.1.3 DiskANN 性能特性（卡车 vs 赛车）

如果说 HNSW 是 **“F1 赛车”（极速但昂贵）**，那么 DiskANN 就是 **“重型卡车”（能装且经济）**。

- **HNSW**：为了追求亚毫秒级的极致速度，必须把所有东西（图 + 向量）都塞进昂贵的内存里，就像赛车为了速度不惜一切成本。
- **DiskANN**：为了装下 10 亿级的数据，巧妙地利用了廉价的 SSD。虽然速度稍慢（几毫秒），但 **“载货量”** 是 HNSW 的几十倍，且成本极低。

| 特性         | 数值              | 说明           |
| ------------ | ----------------- | -------------- |
| **数据规模** | 10 亿+ 向量       | 存储在 SSD 上  |
| **内存占用** | 约 8-16 字节/向量 | 仅存储 PQ 编码 |
| **搜索延迟** | 1-5 毫秒          | 95%+ 召回率    |
| **索引构建** | 数小时（十亿级）  | 可并行构建     |

**DiskANN vs. HNSW**：

| 维度     | HNSW (F1 赛车) | DiskANN (重型卡车)          |
| :------- | :------------- | :-------------------------- |
| **存储** | 全部在内存     | 图+全向量在 SSD，压缩在内存 |
| **内存** | ~100 字节/向量 | ~10 字节/向量 (**1/10**)    |
| **延迟** | 亚毫秒 (<1ms)  | 毫秒级 (1-5ms)              |
| **召回** | 极高 (99%+)    | 高 (95%+)                   |
| **规模** | <1 亿向量      | **1-100 亿向量**            |

### 4.2 ScaNN：Google 的高效向量搜索

#### 4.2.1 算法核心（各向异性）

如果说传统 PQ 是追求完美的 **“照相机”**（力求画面与原物分毫不差），那么 ScaNN 就是懂考试的 **“押题王”**。

**ScaNN (Scalable Nearest Neighbors)** 是 Google 提出的高效算法，其杀手锏是 **各向异性向量量化（Anisotropic Vector Quantization）**。

简单来说，它打破了传统算法对待误差“众生平等”的执念，**有策略地“忽视”了对内积计算影响不大的垂直方向上的量化误差**，从而在关键的平行方向保留了极高的精度。

```mermaid
graph LR
    subgraph "ScaNN: 三阶段量化"
        direction LR
        Query[查询] --> P[1. 分区筛选<br/>Partitioning]
        P --> |"选 Top-N 分区"| Q[2. 各向异性量化<br/>Anisotropic VQ]
        Q --> |"快速算分"| R[3. 精确重排<br/>Rescoring]
        R --> |"Top-K"| Result[最终结果]
    end

    style Q fill:#e6f7ff,stroke:#1890ff,color:#000
    style R fill:#fff7e6,stroke:#fa8c16,color:#000
```

- **传统 PQ (照相机)**：试图最小化 **重构误差**（几何距离）。它“公平”地优化所有分量，无论这个分量对最终得分有没有用。
- **ScaNN (押题王)**：试图最小化 **内积误差**（最终得分）。它意识到，**只有和查询 $q$ 平行的分量**才影响最终得分。因此，它 **“偏心”** 地容忍在垂直方向（对得分无影响）上有较大误差，从而把宝贵的精度全部分配给对得分影响最大的方向。

**结果**：这种 **“有的放矢”** 的策略，让 ScaNN 在同等压缩率下，排序精度吊打传统 PQ。

**数学直觉**：

- 传统 PQ 优化目标：$\min \sum \|v - \tilde{v}\|^2$ （让 $\tilde{v}$ 在空间上接近 $v$）
- ScaNN 优化目标：$\min \sum (\langle q, v \rangle - \langle q, \tilde{v} \rangle)^2$ （让 $\tilde{v}$ 的内积得分接近 $v$）

#### 4.2.2 Anisotropic VQ（手影戏原理）

为了理解“各向异性”和“内积优化”的关系，最贴切的类比是 **手影戏**。

我们的目标是用手势在墙上 **投影** 出一只逼真的 **“老鹰”**（获得精准的内积得分）。

- **传统 PQ (死板的雕塑家)**：它认为 **手必须真的长得像老鹰**。它试图在三维空间里把手“整容”成老鹰的样子。因为手的结构限制（码本有限），“整容”后的手必然四不像，投影出来的影子自然也模糊不清。
- **ScaNN (聪明的手影师)**：它意识到 **只要墙上的“影子”像老鹰就行**，手长什么样根本不重要。
  - **策略**：它允许手在 **光线照射的方向**（垂直方向/观察者看不到的死角）上随意扭曲、变形。
  - **魔法**：它把所有的“误差”和“不像”，统统藏在了 **光线看不到的深度方向** 里。

**结果**：虽然你的手看起来奇形怪状（重构误差很大），但墙上的影子却栩栩如生（内积排序精度极高）。

```mermaid
graph LR
    subgraph "传统 PQ: 3D 模仿"
        direction LR
        H1[🖐️ 手] --> |"死磕 3D 形状<br/>(所有方向都学)"| E1[🦅 3D 雕塑鹰]
        E1 --> |"投影"| S1[❓ 模糊的影子]
    end

    subgraph "ScaNN: 2D 投影"
        direction LR
        H2[🖐️ 手] --> |"只学 2D 轮廓<br/>(误差藏在光线里)"| E2[👌 奇怪的手势]
        E2 --> |"投影"| S2[✅ 完美的鹰影]
    end

    style S2 fill:#d9f7be,stroke:#52c41a,color:#000
```

#### 4.2.3 ScaNN 性能基准（速读冠军）

得益于这套聪明的评分系统（各向异性量化），ScaNN 在处理向量搜索时，就像一位 **“速读冠军”** 参加阅卷：

- **速度极快**：一眼扫过试卷就能打分（单核 QPS 破 3 万），比死抠字眼（计算全几何距离）的传统考官快好几倍。
- **眼光毒辣**：虽然读得快，但对好学生（Top-K）是一个不漏（召回率 95%+）。

根据官方基准测试<sup>[[17]](#ref17)</sup>：

| 数据集         | 向量数 | 维度 | QPS（单线程） | 召回率 |
| -------------- | ------ | ---- | ------------- | ------ |
| **SIFT-1M**    | 100 万 | 128  | **50,000+**   | 95%    |
| **GIST-1M**    | 100 万 | 960  | **10,000+**   | 95%    |
| **GloVe-1.2M** | 120 万 | 100  | **30,000+**   | 95%    |

### 4.3 GPU 加速索引

#### 4.3.1 GPU IVF 系列（人海战术）

如果说 CPU 是 **“几位数学教授”**（擅长复杂逻辑，但核心少），那么 GPU 就是 **“成千上万的小学生”**（擅长简单计算，但人多势众）。

Faiss 利用 GPU 的这种 **大规模并行能力**，将 IVF 索引中海量的距离计算任务分配给成千上万个核心同时处理，从而实现了 **几十倍** 的速度提升<sup>[[18]](#ref18)</sup>。

| 索引类型         | 描述               | QPS 提升 | 显存需求              |
| ---------------- | ------------------ | -------- | --------------------- |
| **GPU_IVF_FLAT** | GPU 加速的 IVFFlat | 10-50x   | 存储全向量 (高显存)   |
| **GPU_IVF_PQ**   | GPU 加速的 IVFPQ   | 5-20x    | 存储 PQ 编码 (低显存) |
| **GPU_IVF_SQ8**  | GPU 加速的标量量化 | 10-30x   | 存储 INT8 向量 (中等) |

#### 4.3.2 CAGRA：NVIDIA 的图索引（无人机蜂群）

以往认为图搜索逻辑复杂（需要频繁跳转），只适合 CPU。但 NVIDIA 的 **CAGRA (Cuda Accelerated GRAph-based index)** 打破了这一刻板印象<sup>[[18]](#ref18)</sup>。

如果说 CPU HNSW 是身手敏捷的 **“跑酷高手”**，那么 GPU CAGRA 就是铺天盖地的 **“无人机蜂群”**。

```mermaid
graph LR
    subgraph GPU ["🛸 GPU CAGRA: 无人机蜂群 (并行)"]
        direction LR
        Q_Batch["Query Batch<br/>(1000+ 个查询)"] --> |"饱和式覆盖"| GP((GPU Cores))
        GP --> |"瞬时完成"| R_Batch["Result Batch"]
    end

    subgraph CPU ["🏃 CPU HNSW: 跑酷高手 (串行)"]
        direction LR
        Q1[Query 1] --> |"精细规划路径"| N1((逐个跳跃))
        N1 --> R1[Result 1]
    end

    style Q_Batch fill:#76b900,stroke:#fff,color:#000
    style GP fill:#e6f7ff,stroke:#1890ff,color:#000
```

- **CPU HNSW (跑酷高手)**：单兵作战，反应极快。适合为 **单个用户** 带路，能瞬间做出判断找到终点（追求极致 **低延迟**）。
- **GPU CAGRA (无人机蜂群)**：集团作战，吞吐惊人。适合 **成千上万个用户** 同时问路，虽然启动稍微慢一些，但能一口气处理海量请求（追求极致 **高吞吐**）。

**CAGRA vs. CPU HNSW**：

| 维度         | CPU HNSW (跑酷高手) | GPU CAGRA (无人机蜂群) |
| :----------- | :------------------ | :--------------------- |
| **单次延迟** | **极低** (1ms)      | 较低 (1-5ms)           |
| **吞吐量**   | 一般 (1k-10k QPS)   | **恐怖** (100k+ QPS)   |
| **硬件成本** | 高内存 CPU 服务器   | GPU 服务器             |
| **最佳战场** | 实时搜索、小并发    | **推荐系统、大并发**   |

---

## 5. 相似度的度量（一尺丈量万物）

相似度的度量方式决定了我们眼中的“相似”究竟意味着什么。正确的相似度度量对向量搜索结果有着决定性影响。选择正确的 **“尺子”**（度量方式）往往比选择算法更重要。

### 5.1 L2 Distance（直尺测量）

#### 5.1.1 核心直觉

**L2 Distance（欧几里得距离）** 就像是用一把 **“直尺”** 连接两点，量出的 **绝对直线距离**。

- **关注点**：**“位置的绝对差异”**。
- **类比**：就像**量体裁衣**。不管衣服的款式（方向）多么相似，只要肩宽、袖长等**尺寸数据（坐标值）**相差很大，这件衣服穿在身上就是“不合身”（距离远）。L2 关注的是**数值的绝对吻合度**。

> [!NOTE]
>
> **数学定义**<sup>[[19]](#ref19)</sup>
>
> $$
>     d_{L2}(a, b) = \sqrt{\sum_{i=1}^{d}(a_i - b_i)^2} = \|a - b\|_2
> $$

#### 5.1.2 几何意义

```mermaid
graph LR
    subgraph "L2 几何意义: 多维差异聚合"
        direction LR
        A("点 A (x=1, y=1)")
        B("点 B (x=4, y=5)")

        A -- "Δx (维度 x 差异) = 3" --> B
        A -- "Δy (维度 y 差异) = 4" --> B
        A -- "📏 L2 距离 = √(3²+4²) = 5" --- B

        linkStyle 0 stroke-dasharray: 5 5,color:#fff
        linkStyle 1 stroke-dasharray: 5 5,color:#fff
        linkStyle 2 stroke-width:3px,stroke:#1890ff,color:#1890ff
    end
```

#### 5.1.3 特性与应用

| 特性/场景    | 说明                                                                       |
| :----------- | :------------------------------------------------------------------------- |
| **尺度敏感** | **对数值大小极其敏感**。如 `(1,1)` 和 `(100,100)` 距离很远，哪怕方向相同。 |
| **维度诅咒** | 在高维空间中，点与点之间的距离趋于均匀，区分度下降。                       |
| **适用场景** | **物理位置**（地图）、**图像像素差异**（找茬）、**聚类分析**（K-Means）。  |

```python
def euclidean_distance(a, b):
    # 直观：平方和开根号
    return np.sqrt(np.sum((a - b) ** 2))
```

### 5.2 Cosine Similarity（量角器测量）

#### 5.2.1 核心直觉

如果 L2 是用“尺子”量距离，那么 **Cosine Similarity（余弦相似度）** 就是用 **“量角器”** 测角度。

- **关注点**：**“方向的一致性”**（忽略“长短”）。
- **类比**：就像 **两人指月**。
  - 一个是手臂长的大人（向量模长很大），一个是手臂短的小孩（向量模长很小）。
  - 只要他们都指向同一个月亮（夹角为 0），余弦相似度就是 **100%**。
  - **L2 距离** 会认为这两人差别很大（手臂长度差太多），而 **余弦** 认为他们完全一样（关注点相同）。

> [!NOTE]
>
> **数学定义**<sup>[[19]](#ref19)</sup>：
>
> $$
>     \cos(\theta) = \frac{a \cdot b}{\|a\| \cdot \|b\|} = \frac{\sum_{i=1}^{d} a_i \cdot b_i}{\sqrt{\sum_{i=1}^{d} a_i^2} \cdot \sqrt{\sum_{i=1}^{d} b_i^2}}
> $$
>
> **余弦距离**是相似度的补充：
>
> $$
>     d_{\cos}(a, b) = 1 - \cos(\theta)
> $$

#### 5.2.2 几何意义

```mermaid
graph TB
    subgraph "Cosine: 关注夹角"
        O((原点))
        A((向量 A <br/> Short))
        B((向量 B <br/> Long))
        Q((向量 Q <br/> Short))

        O --> A
        O --> B
        O --> Q

        linkStyle 0 stroke:#1890ff,stroke-width:2px;
        linkStyle 1 stroke:#52c41a,stroke-width:4px;
        linkStyle 2 stroke:#52c41a,stroke-width:2px;

        %% Label: Q and B have different lengths but same direction
        Q -.- |"方向相近 (Sim=0.8)"| B
    end
```

#### 5.2.3 特性与应用

| 特性/场景      | 说明                                                                        |
| :------------- | :-------------------------------------------------------------------------- |
| **尺度无关性** | **对长度不敏感**。长文章和短摘要，只要主题（方向）一致，相似度就高。        |
| **范围直观**   | $[-1, 1]$。`1`=方向相同，`0`=毫无关系（正交），`-1`=完全相反。              |
| **高维友好**   | 在高维空间表现稳定                                                          |
| **适用场景**   | **语义搜索**（文本匹配）、**推荐系统**（用户兴趣方向）、**NLP**（词向量）。 |

```python
def cosine_similarity(a, b):
    # 点积除以模长积
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    return dot_product / (norm_a * norm_b)
```

### 5.3 Dot Product / Inner Product（有效做功）

#### 5.3.1 核心直觉

如果说余弦只看 **“方向（质）”**，那么 **Dot Product（又称 Inner Product，点积，内积）** 就是兼顾 **“质与量”** 的综合指标。

- **关注点**：同时衡量 **“方向的一致性”** 和 **“本身模长的大小”**。
- **类比**：就像 **推车做功**。
  - **方向**：你推的方向准不准？（与目标是否一致）
  - **力度**：你用的力气大不大？（向量的模长）
  - **点积**：**你对车前进的实际贡献量**。只有 **方向对** 且 **力气大**，点积才会最大。

这在 **推荐系统** 中极具价值：我们既希望推荐的内容 **匹配用户兴趣**（方向对），又希望推荐的内容 **本身质量高/热度高**（模长大）。

> [!NOTE]
>
> 数学定义<sup>[[19]](#ref19)</sup>
>
> **点积**（内积）直接计算两个向量对应元素的乘积之和：
>
> $$
>     \langle a, b \rangle = a \cdot b = \sum_{i=1}^{d} a_i \cdot b_i
> $$
>
> **与余弦相似度的关系**：
>
> $$
>     a \cdot b = \|a\| \cdot \|b\| \cdot \cos(\theta)
> $$
>
> **关键洞察**：
>
> - 当向量 **已归一化**（$\|a\| = \|b\| = 1$）时，点积 **等于** 余弦相似度
> - 当向量 **未归一化** 时，点积同时考虑方向和长度

#### 5.3.2 几何意义

**点积的几何本质** 是 **“投影与放大”**。

$$
    A \cdot B = \underbrace{(|A| \cos \theta)}_{\text{A 在 B 上的投影}} \times \underbrace{|B|}_{\text{B 的长度}}
$$

它衡量了 **向量 A 在向量 B 方向上“积累”了多少有效贡献**。

```mermaid
graph LR
    subgraph "点积物理图解: 推车做功"
        direction LR
        O((起点))
        Push((推力 F))
        Car((车位移 S))
        Effective((有效推力))

        O --> |"💪 推力 F (手臂方向)"| Push
        O ==> |"🚗 车位移 S (前进方向)"| Car

        Push -.- |"浪费的力 (垂直做无用功)"| Effective
        O == "⚡️ 有效推力 (F·cosθ)" ==> Effective

        linkStyle 0 stroke:#1890ff
        linkStyle 1 stroke:#52c41a,stroke-width:3px
        linkStyle 3 stroke:#fa8c16,stroke-width:3px
        style Effective size:0,opacity:0
    end
```

#### 5.3.3 特性与应用

点积最大的特性是 **“对强度的奖励”**（Scale Sensitive）。

- **类比**：**“带货能力”**。
  - **方向（匹配度）**：产品是否符合粉丝口味？
  - **模长（影响力）**：博主本身的粉丝基数大不大？
  - **结果**：**大 V（长向量）** 带对了货，成交额（点积）会远远高于小博主。在推荐系统中，这意味着点积能天然地把 **热门/高质量** 的内容排在前面。

| 特性/场景    | 说明                                                                            |
| :----------- | :------------------------------------------------------------------------------ |
| **赢家通吃** | **模长敏感**。长向量（高热度 Item）更容易获得高分，天然适合做排序（Ranking）。  |
| **计算极速** | **最简单的运算**。纯加乘，无开方、无除法，能极大利用 CPU/GPU 的 SIMD 指令加速。 |
| **核心战场** | **推荐系统**（兼顾兴趣与质量）、**注意力机制**（Transformer 的 $Q K^T$）。      |

```python
def dot_product(a, b):
    # 简单粗暴，速度最快
    return np.dot(a, b)

# 归一化后的点积 = 余弦相似度
def normalized_dot_product(a, b):
    a_norm = a / np.linalg.norm(a)
    b_norm = b / np.linalg.norm(b)
    return np.dot(a_norm, b_norm)
```

### 5.4 Manhattan Distance / L1 Distance（出租车路径）

#### 5.4.1 核心直觉

如果说 L2 是 **“直升机航线”**（两点间直飞），那么 **L1（曼哈顿距离）** 就是 **“出租车路径”**。

- **场景**：在一个规划整齐的棋盘式城市（如曼哈顿街区），司机不能穿墙而过（走对角线）。
- **计算**：必须沿着街道拐弯抹角。距离 = **横向走的街区数 + 纵向走的街区数**。
- **意义**：它是所有维度差异的 **简单累加**，没有任何“平方放大”效应，这让它对 **异常值（Outliers）** 不那么敏感（鲁棒性更强）。

> [!NOTE]
>
> 数学定义<sup>[[19]](#ref19)</sup>
>
> **曼哈顿距离**（也称 L1 距离、城市街区距离）计算两点之间沿坐标轴的绝对差值之和：
>
> $$
>     d_{L1}(a, b) = \sum_{i=1}^{d} |a_i - b_i| = \|a - b\|_1
> $$

#### 5.4.2 几何意义

```mermaid
graph TB
    subgraph "曼哈顿距离 vs. 欧几里得距离"
        A["点 A (0,0)"] --> |"L1: |3|+|4|=7"| B["点 B (3,4)"]
        A --> |"L2: √(9+16)=5"| B
    end

    style A fill:#ffe58f,color:#000000
    style B fill:#b7eb8f,color:#000000
```

#### 5.4.3 特性与应用（公平判罚）

L1 与 L2 最大的区别在于对错误的 **“惩罚机制”**。

- **L2 (严厉老师)**：通过 **平方** 放大错误。哪怕只在一个维度上偏离很远（异常值），距离就会爆炸式增长（$10^2=100$）。
- **L1 (公平老师)**：按 **绝对值** 累加。错多少计多少，不额外惩罚严重错误（$10=10$）。

这使得 L1 在处理 **高维稀疏数据**（如文本关键词，只有少数维度有值）时，比 L2 更稳健，不容易被个别极端值带偏。

```mermaid
xychart-beta
    title "惩罚对比：L2(陡峭曲线) vs L1(平缓直线)"
    x-axis "单维度误差大小" [1, 2, 3, 4, 5]
    y-axis "计算出的距离贡献" 0 --> 25
    line [1, 4, 9, 16, 25]
    line [1, 2, 3, 4, 5]
```

| 特性/场景      | 说明                                                                     |
| :------------- | :----------------------------------------------------------------------- |
| **鲁棒性**     | **对异常值不敏感**。适合数据噪声较大，或不希望少数极端值主导结果的场景。 |
| **稀疏性友好** | 在高维稀疏向量（如 TF-IDF）中，L1 往往比 L2 能更好地保持区分度。         |
| **核心战场**   | **高维稀疏数据**（文本分类）、**城市路径规划**。                         |

```python
def manhattan_distance(a, b):
    # 绝对值求和
    return np.sum(np.abs(a - b))
```

### 5.5 Hamming Distance（找茬计数器）

#### 5.5.1 核心直觉

**Hamming Distance（汉明距离）**就像是玩 **“大家来找茬”**。它不关心数值差多少，只关心 **“有几个位置不同”**。

- **类比**：**拼写检查**。
  - 单词 "CAT" 和 "HAT"：只有 1 个字母不同（C $\to$ H），汉明距离 = 1。
  - 单词 "1011" 和 "1001"：只有第 3 位不同（1 $\to$ 0），汉明距离 = 1。
- **本质**：衡量将一个字符串变成另一个字符串，最少需要 **替换** 几次。

> [!NOTE]
>
> 数学定义<sup>[[25]](#ref25)</sup>
>
> **汉明距离** 计算两个等长序列中对应位置不同元素的数量：
>
> $$
>     d_H(a, b) = \sum_{i=1}^{d} \mathbf{1}[a_i \neq b_i]
> $$
>
> 其中 $\mathbf{1}[\cdot]$ 是指示函数，当条件为真时返回 1，否则返回 0。

#### 5.5.2 二进制向量的高效计算

对于二进制向量，汉明距离可以通过异或（XOR）运算和位计数高效实现：

$$
d_H(a, b) = \text{popcount}(a \oplus b)
$$

```python
def hamming_distance_binary(a, b):
    """二进制向量的汉明距离"""
    xor_result = np.bitwise_xor(a, b)
    return np.sum(xor_result)

def hamming_distance_general(a, b):
    """通用汉明距离"""
    return np.sum(a != b)
```

#### 5.5.3 特性与应用（极速比特）

汉明距离的杀手锏是 **“硬件级的快”**。

- **类比**：**开关状态检查**。比较两排开关有多少个状态（开/关）不同。
- **神技 (XOR + POPCNT)**：CPU 拥有专门的硬件指令（`POPCNT`），能像“一键扫描”一样，在 **几纳秒** 内直接告诉你结果。这比用肉眼一个个去数（循环对比）快了成百上千倍。
- **结果**：它是 **海量数据去重** 和 **指纹比对** 的绝对首选。

| 特性/场景    | 说明                                                                                        |
| :----------- | :------------------------------------------------------------------------------------------ |
| **硬件加速** | **极速计算**。利用位运算（XOR）和硬件指令，速度远超浮点运算。                               |
| **如影随形** | **二进制哈希 (LSH/SimHash)** 的天作之合。先将高维向量哈希成二进制串，再用汉明距离极速筛选。 |
| **适用场景** | **文档去重**（SimHash）、**图像指纹**（pHash）、**DNA 序列比对**。                          |

```python
def hamming_distance_binary(a, b):
    # 利用位运算异或 (XOR) -> 统计 1 的个数
    xor_result = np.bitwise_xor(a, b)
    return np.sum(xor_result)
```

### 5.6 Jaccard Similarity（朋友圈重合度）

#### 5.6.1 核心直觉

**Jaccard Similarity（Jaccard 相似度）** 衡量的就是 **“朋友圈重合度”**（即 IoU，Intersection over Union）。

- **类比**：你和新朋友对比通讯录。
  - **分子（交集）**：你们有多少个 **共同好友**？
  - **分母（并集）**：你们两人的通讯录加起来，一共有多少个 **不重复的人**？
- **直觉**：只看共同好友数（交集）是不够的，必须除以总人数（并集）。Jaccard 给出了一个 0 到 1 的 **公平重合比例**。

> [!NOTE]
>
> 数学定义<sup>[[26]](#ref26)</sup>
>
> **Jaccard 相似度**（也称 Jaccard 系数）衡量两个集合的交集与并集之比：
>
> $$
>     J(A, B) = \frac{|A \cap B|}{|A \cup B|} = \frac{|A \cap B|}{|A| + |B| - |A \cap B|}
> $$
>
> **Jaccard 距离** 是其补集：
>
> $$
>     d_J(A, B) = 1 - J(A, B)
> $$

#### 5.6.2 几何意义

```mermaid
graph TB
    subgraph "Jaccard 相似度"
        A["集合 A: {1,2,3,4}"]
        B["集合 B: {3,4,5,6}"]
        I["交集: {3,4}<br/>2 个元素"]
        U["并集: {1,2,3,4,5,6}<br/>6 个元素"]
        R["J(A,B) = 2/6 = 0.33"]
    end

    A --> I
    B --> I
    A --> U
    B --> U
    I --> R
    U --> R

    style R fill:#52c41a,color:#fff
```

#### 5.6.3 MinHash 加速（抽样代言人）

面对海量集合，逐个元素对比（Exact Jaccard）太慢。MinHash 的核心思路是 **“选出代表，快速估算”**。

- **类比**：**“幸运抽奖”**。
  - 不用比对所有人，而是举办 $K$ 场 **“随机抽奖”**（哈希函数）。
  - 每场抽奖，两个集合各自派出 **“号码最小”** 的元素作为代表。
  - **原理**：如果两个集合重合度高，他们很有可能派出 **同一个代表**。
  - **结果**：统计 **“代表相同”** 的比例，即可近似等于 Jaccard 相似度。这把 $O(N)$ 的集合运算变成了 $O(K)$ 的签名比对。

```python
def jaccard_similarity(set_a, set_b):
    """精确 Jaccard 相似度 (Baseline)"""
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0

def jaccard_similarity_binary(a, b):
    """二进制向量的 Jaccard 相似度"""
    intersection = np.sum(a & b)
    union = np.sum(a | b)
    return intersection / union if union > 0 else 0
```

#### 5.6.4 特性与应用（忽略双无）

Jaccard 最独特的性格是 **“只看拥有的，不看缺失的”**。

- **类比**：**“购物车对比”**。
  - **有效信号**：我们都买了“可乐”，这说明口味相似（交集）。
  - **无效信号**：我们都没买“私人飞机”，这 **毫无意义**。不能因为成千上万种商品我们都没买，就得出“我们很像”的结论。
- **优势**：这一点让它在处理 **稀疏数据** 时完胜 Hamming 距离（Hamming 会把“都没买”的 0-0 匹配也算作相似，导致结果虚高）。

> [!TIP]
>
> **深度思考：分母会被海量“未购商品”稀释吗？**
>
> **不会。** 这是 Jaccard 最容易被误解但也最强大的地方。
>
> - **分母**是 $|A \cup B|$（两人**实际涉及**的商品总和），而**不是**全集 $U$（商城所有商品）。
> - **举例**：淘宝有 10 亿商品。用户 A 买了 5 件，用户 B 买了 5 件。
>   - **Jaccard 分母**：最大只有 $5+5=10$。那 10 亿件没买的商品 **完全不参与计算**。
>   - **反例**：如果用简单的匹配系数（如 Hamming 翻转），那 10 亿件“都没买”的商品会算作“相同”，导致两人的相似度无限接近 100%，这显然是荒谬的。

| 特性/场景    | 说明                                                                                          |
| :----------- | :-------------------------------------------------------------------------------------------- |
| **非对称性** | **忽略“双无” (0-0)**。只关注存在的元素（1-1），特别适合物品全集很大、但用户只选了几个的场景。 |
| **集合度量** | 天然支持 **不定长集合** 的比较（如文章由不同数量的词组成）。                                  |
| **核心战场** | **推荐系统**（隐式反馈）、**文档去重**（Shingling）、**生物基因对比**。                       |

### 5.7 度量方式横评（选型指南）

面对琳琅满目的度量方式，选型的核心在于 **“你想量什么？”**。

- **物理派（一把尺）**：**L2、Manhattan**。
  - **核心**：关注 **“绝对距离”**。
  - **潜台词**：“你离我物理距离有多远？”（适合图像像素、空间坐标）
- **语义派（指南针）**：**Cosine、Dot Product**。
  - **核心**：关注 **“方向/态度”**。
  - **潜台词**：“咱们是不是一路人？”（适合文本语义、用户兴趣）
- **集合派（计数器）**：**Hamming、Jaccard**。
  - **核心**：关注 **“重合/差异数量”**。
  - **潜台词**：“咱们有多少共同点？”（适合文档去重、二进制指纹）

#### 5.7.1 综合对比表

| 度量方式           | 类比          | 取值范围             | 适用场景       | 复杂度     | 杀手锏 (Killer Feature)            |
| :----------------- | :------------ | :------------------- | :------------- | :--------- | :--------------------------------- |
| **欧几里得 (L2)**  | **拉直尺**    | $[0, +\infty)$       | 连续/图像      | $O(d)$     | 最符合直觉的物理距离               |
| **余弦 (Cosine)**  | **量角器**    | $[-1, 1]$            | 文本/语义      | $O(d)$     | 处理不同长度文本（归一化）         |
| **点积 (Dot)**     | **推车做功**  | $(-\infty, +\infty)$ | 推荐/Attention | $O(d)$     | **速度最快**，奖励高热度 (Ranking) |
| **曼哈顿 (L1)**    | **出租车**    | $[0, +\infty)$       | 稀疏/高维      | $O(d)$     | 对异常值鲁棒 (Robust)              |
| **汉明 (Hamming)** | **找茬/开关** | $[0, d]$             | 二进制/Hash    | $O(d/64)*$ | **硬件加速** (XOR+POPCNT) 极速去重 |
| **Jaccard**        | **购物车**    | $[0, 1]$             | 集合/Set       | $O(d)$     | **忽略“双无”**，稀疏集合首选       |

> \*注：汉明距离在二进制向量上可使用 CPU 硬件指令 (POPCNT) 实现 64 位并行计算，速度极快（接近 $O(d/64)$）。

#### 5.7.2 归一化：殊途同归

在工程实践中，**“归一化”** (Normalization) 是一座神奇的桥梁，它能让物理派、语义派和点积派 **握手言和**。

- **直觉**：当你把所有向量都“修剪”成同样的长度（投影到单位球面上，$\|v\| = 1$），**“方向的差异”就直接决定了“距离的远近”**。此时，尺子（L2）、量角器（Cosine）和做功（Dot）给出的 **排序结果完全一致**。
- **数学本质**：
  当 $\|a\| = \|b\| = 1$ 时：
  $$
      d_{L2}^2(a,b) = \|a-b\|^2 = \underbrace{\|a\|^2 + \|b\|^2}_{常数 2} - 2\underbrace{(a\cdot b)}_{\text{点积/Cos}}
  $$
  这说明 $L2$ 距离越小，点积（余弦）就越大。
- **工程推论**：既然排序效果一样，首选计算最快的 **点积**（这解释了为什么现代 Embedding 模型通常输出归一化向量）。

```mermaid
graph LR
    subgraph "归一化后的殊途同归"
        direction LR
        L2[L2 距离]
        COS[余弦相似度]
        DOT[点积]

        L2 == "排序等价" ==o COS
        COS == "排序等价" ==o DOT
    end

    style L2 fill:#91d5ff,stroke:#0050b3,color:#000000
    style COS fill:#b7eb8f,stroke:#389e0d,color:#000000
    style DOT fill:#ffd591,stroke:#d46b08,color:#000000
```

#### 5.7.3 决策树：三问定终身

如果说前面的分析是 **“理论课”**，那么这棵决策树就是 **“实战锦囊”**。面对复杂的业务场景，你只需要像 **“医生分诊”** 一样，回答三个核心问题，就能找到最合适的度量工具。

1. **是否归一化？** （这是通往“极速计算”的捷径，直接用点积）
2. **长度有意义吗？** （代表权重/热度？用点积；代表噪音？要消除）
3. **看重语义还是物理？** （语义找方向用 Cosine，物理找位置用 L2）

```mermaid
flowchart LR
    START[开始选型] --> Q1{"Q1: 向量已归一化?"}
    Q1 --> |是| USE_DOT["<b>点积 (Dot)</b><br/>最快且等价余弦"]
    Q1 --> |否| Q2{"Q2: 长度(模长)<br/>有业务含义?"}
    Q2 --> |"是 (如热度/权重)"| USE_IP["<b>点积 (Dot)</b><br/>奖励长向量"]
    Q2 --> |"否 (长度是噪音)"| Q3{"Q3: 任务类型?"}
    Q3 --> |文本/语义搜索| USE_COS["<b>余弦 (Cosine)</b><br/>看方向忽略长度"]
    Q3 --> |图片/空间坐标| USE_L2["<b>欧几里得 (L2)</b><br/>看绝对距离"]

    style USE_DOT fill:#52c41a,color:#fff,stroke:#fff
    style USE_COS fill:#1890ff,color:#fff,stroke:#fff
    style USE_L2 fill:#91d5ff,color:#000,stroke:#000
    style USE_IP fill:#fa8c16,color:#fff,stroke:#fff
```

#### 5.7.4 业界最佳实践（抄作业指南）

如果你不想从头推导，最稳妥的办法是参考 **“业界标准答案”**。不同的模型架构通常有其“原生适配”的度量方式，“顺势而为”往往能事半功倍。

| 模型/任务                   | 推荐度量          | 核心逻辑                                                        |
| :-------------------------- | :---------------- | :-------------------------------------------------------------- |
| **OpenAI (text-embedding)** | **余弦 (Cosine)** | 官方训练目标即为 Cosine，且输出通常已归一化（此时等价于 Dot）。 |
| **Sentence-BERT / CLIP**    | **余弦 (Cosine)** | 语义/图文匹配任务的核心是 **“方向对齐”**，而非长度。            |
| **推荐系统 (MF / Youtube)** | **点积 (Dot)**    | 需要保留 **“热门商品”** 的模长权重 (Logits/Confidence)。        |
| **计算机视觉 (ResNet/VGG)** | **欧几里得 (L2)** | 传统 CNN 特征提取通常未归一化，关注特征空间的 **绝对距离**。    |

---

## 6. 混搜策略（全脑协同）

纯向量搜索虽然强大，但它擅长“模糊联想”（右脑），却拙于“精确匹配”（左脑）。这就是为什么现代 RAG 系统必须使用 **混合搜索**。

### 6.1 核心直觉：左右脑协同

**Hybrid Search（混合搜索）** 就像是人类的 **“全脑思考”**。

- **右脑 (Vector)**：负责 **“懂你意思”**。它知道“苹果”和“水果”有关，不管你关键词有没有输对。
- **左脑 (Keyword/Filter)**：负责 **“抠字眼”** 和 **“查户口”**。它确保特定的专有名词（如 `Error 503`）必须出现，或者时间必须在 `2024` 年。

只有两者结合，才能既 **“找得全”**（召回率高），又 **“找得准”**（精确度高）。

```mermaid
graph TB
    subgraph "混合搜索: 全脑协同"
        direction TB
        subgraph RightBrain ["右脑 (感性/语义)"]
            direction TB
            VS["<b>向量搜索</b><br/>语义/模糊/神似"]
        end

        subgraph LeftBrain ["左脑 (理性/精确)"]
            direction TB
            KS["<b>关键词搜索</b><br/>字面/倒排索引"]
            MF["<b>元数据过滤</b><br/>WHERE 条件/规则"]
        end
    end

    Q[用户查询] --> VS
    Q --> KS
    Q --> MF

    VS --> FUSION["结果融合<br/>(RRF / Rerank)"]
    KS --> FUSION
    MF --> FUSION
    FUSION --> R[最终排序结果]

    style VS fill:#1890ff,color:#fff,stroke:#fff
    style KS fill:#fa8c16,color:#fff,stroke:#fff
    style MF fill:#722ed1,color:#fff,stroke:#fff
    style FUSION fill:#52c41a,color:#fff,stroke:#fff

    style RightBrain fill:#e6f7ff,stroke:#1890ff,stroke-dasharray: 5 5,color:#1890ff
    style LeftBrain fill:#fff7e6,stroke:#fa8c16,stroke-dasharray: 5 5,color:#fa8c16
```

### 6.2 过滤策略（招聘的艺术）

在向量搜索中叠加条件（如 `WHERE city='Shanghai'`），核心矛盾在于 **“什么时候执行过滤”**。这就像 **企业招聘**：

- **向量搜索**：**面试官**。寻找“能力最匹配”的人（模糊、语义）。
- **过滤器**：**HR**。检查“硬性指标”（学历、居住地，精确）。

#### 6.2.1 Post-filtering（后过滤：先面试，再查证）

**策略**：面试官先海选出 Top-50（向量搜索），HR 再把不符合硬性条件的人剔除。

- **痛点**：**“白忙活”**。聊了半天，发现最优秀的前几名都不符合条件。原本想招 10 人，剔除后可能只剩 2 人（Result < K）。
- **适用**：过滤条件 **很宽松**（绝大多数人都合格）时，这是实现最简单且高效的做法。

```mermaid
sequenceDiagram
    %%{init: {'sequence': {'mirrorActors': false}}}%%
    participant Q as 面试官 (Vector)
    participant F as HR (Filter)
    participant R as 录用名单

    Q->>Q: 1. 先海选面试 (Top-K')
    Q->>F: 2. 推荐候选人
    F->>F: 3. 剔除不合格者 (Filter)
    F-->>R: 4. 剩余合格者 (可能不足 K 个)
```

```python
def post_filtering_search(query, k, filter_func):
    # 多抓一些人来面试 (margin)，防止被 HR 筛光了
    candidates = vector_index.search(query, k * margin)
    # HR 进行硬性过滤
    return [c for c in candidates if filter_func(c)][:k]
```

#### 6.2.2 Pre-filtering（预过滤：先查证，再面试）

**策略**：HR 先把所有不符合条件的人筛掉，面试官只在 **合格者名单** 中挑选。

- **优势**：**“精准高效”**。保证选出来的每个人都符合条件，且一定能招满 K 个人。
- **适用**：过滤条件 **很严格**（合格者很少）时，必须采用此策略，否则 Post-filtering 会筛空。

```mermaid
sequenceDiagram
    %%{init: {'sequence': {'mirrorActors': false}}}%%
    participant F as HR (Filter)
    participant Q as 面试官 (Vector)
    participant R as 录用名单

    F->>F: 1. 筛选合格简历
    F->>Q: 2. 提供合格 ID 列表 (Bitmap)
    Q->>Q: 3. 只在名单内面试 (Search in Subset)
    Q-->>R: 4. 最终录用 (Top-K)
```

```python
def pre_filtering_search(query, k, filter_condition):
    # HR 先干活：拿到所有合格 ID
    valid_ids = metadata_index.query(filter_condition)
    # 面试官只在圈定范围内搜
    return vector_index.search_in_subset(query, valid_ids, k)
```

#### 6.2.3 决策指南：看“含鱼量”下网

选择过滤策略的核心在于 **“合格率 (Selectivity)”**，即这片海里有多少鱼是你想要的。

```mermaid
flowchart LR
    START[开始决策] --> Q1{"Q1: 过滤后还剩多少数据?<br/>(Selectivity)"}
    Q1 --> |"很多 (> 50%)"| POST["<b>Post-filtering</b><br/>先搜后筛 (撒大网)"]
    Q1 --> |"很少 (< 10%)"| PRE["<b>Pre-filtering</b><br/>先筛后搜 (精准定位)"]
    Q1 --> |"中等 (10-50%)"| Q2{"Q2: 必须严格返回 Top-K?"}
    Q2 --> |是| PRE
    Q2 --> |"否 (大概就行)"| POST

    style POST fill:#ffd591,color:#000,stroke:#d46b08
    style PRE fill:#91d5ff,color:#000,stroke:#0050b3
```

- **Post-filtering (撒大网)**：适用于 **“鱼多”**（合格率 > 50%）。
  - **策略**：不管三七二十一先捞一网（Top-K'），哪怕扔掉几条不合格的（过滤），剩下的也足够吃。
- **Pre-filtering (先探鱼)**：适用于 **“鱼少”**（合格率 < 10%）。
  - **策略**：必须先用声纳定位（元数据索引），锁定那几条珍稀的鱼，再精准下网。否则用撒大网的方式，可能捞上来全是杂鱼，一条能用的都没有（结果为空）。

| 场景                        | 推荐策略           | 核心理由                                         |
| :-------------------------- | :----------------- | :----------------------------------------------- |
| **大众筛选** (如 `性别=男`) | **Post-filtering** | 只是简单排除一半人，随便抓几个替补就行。         |
| **小众筛选** (如 `ID=9527`) | **Pre-filtering**  | 大海捞针，必须先用 ID 索引定位，否则根本搜不到。 |

### 6.3 高阶混合过滤

#### 6.3.1 Single-Stage Filtering（单阶段过滤：带路障的导航）

这是 Qdrant 等现代向量库的杀手锏。它不再把“搜索”和“过滤”割裂开，而是像 **“实时路况导航”**：

- **机制**：在 HNSW 图遍历的每一步，**一边找路，一边看路牌**。
- **效果**：如果发现某个节点（路口）不符合过滤条件（如 `❌`），只是不把它加入最终结果，但依然可以通过它去找到其他符合条件的邻居（或者智能跳过）。这就既避免了 Post-filtering 的召回不足，又避免了 Pre-filtering 的 **索引碎片化**。

```mermaid
graph LR
    subgraph "导航过程：实时避开不合规节点"
        direction LR
        N1[节点1<br/>符合] --> N2[节点2<br/>❌ 不符合]
        N2 -.-> |"路径探索"| N3[节点3<br/>✅ 符合]
        N1 --> |"直接跳转(如有边)"| N3
        N3 --> N4[节点4<br/>✅ 符合]
    end

    style N2 fill:#ff4d4f,color:#fff,stroke-dasharray: 5 5
    style N3 fill:#52c41a,color:#fff
```

#### 6.3.2 分区索引（物理隔离：独立的档案室）

对于 **多租户 (SaaS)** 场景，最简单的提效手段不是算法，而是 **“物理隔离”**。

- **策略**：别把所有公司的文件堆在一个大仓库里。给每个租户（Tenant）建一个 **独立的档案室**（独立索引）。
- **优势**：搜 Tenant A 的数据时，根本不受 Tenant B 的干扰。性能随数据量线性扩展，且天然隔离更安全。

```sql
-- PostgreSQL + pgvector：为不同房客建不同房间
CREATE INDEX idx_tenant_1 ON items
  USING hnsw (embedding vector_cosine_ops)
  WHERE tenant_id = 1;

CREATE INDEX idx_tenant_2 ON items
  USING hnsw (embedding vector_cosine_ops)
  WHERE tenant_id = 2;
```

### 6.4 向量 + 全文的结果融合（殿试放榜）

当 **“右脑”**（向量）和 **“左脑”**（关键词）分别给出了两份不同的推荐名单时，我们需要一位 **“决策者”**（Fusion）来拍板名单的最终排序。

#### 6.4.1 融合方法：从独裁到民主

| 融合方法                        | 类比                  | 核心逻辑                                                                                                   |
| :------------------------------ | :-------------------- | :--------------------------------------------------------------------------------------------------------- |
| **线性加权 (Linear Weighting)** | **“老板拍板” (独裁)** | **指定权重**（如 $\alpha=0.7$）。<br>问题：两者的分数范围不同（Cos 是 0-1，BM25 可能是 0-100），很难调平。 |
| **倒数排名融合 (RRF)**          | **“公平投票” (民主)** | **只看排名，不看分数**。<br>不管你考了多少分，只看你是第几名。排名越靠前，票的分量越重。                   |
| **学习排序 (LTR)**              | **“AI 裁判”**         | 用另一个模型来专门学习如何给这两人打分（成本最高）。                                                       |

#### 6.4.2 Reciprocal Rank Fusion (RRF)：无需调参的魔法

RRF 是目前最流行的融合算法，因为它 **不需要归一化** 分数，完全基于排名。

- **直觉**：**“第一名很贵，第十名很水”**。
  - 第一名的票非常有价值（$1/61$）。
  - 第十名的票价值衰减很快。
  - 如果一个文档在两份名单里**都排前几名**，它的总分就会暴涨，从而脱颖而出。

$$
    RRF(d) = \sum_{r \in R} \frac{1}{k + r(d)}
$$

其中：

- $R$ 是所有排序列表
- $r(d)$ 是文档 $d$ 在排序列表 $r$ 中的排名
- $k$（通常为 60）：平滑因子，防止排名第一及第二的差距过大。

```python
def reciprocal_rank_fusion(rankings, k=60):
    """
    rankings: [["doc_A", "doc_B"], ["doc_B", "doc_C"]] (多位专家的排名)
    """
    scores = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            # 排名越高 (rank 越小)，得分越高
            # 1/(60+0) > 1/(60+9)
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank)

    return sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
```

#### 6.4.3 Weaviate 混合搜索示例

```python
# Weaviate 让用户选择“偏听偏信”还是“兼听则明”
results = client.query.get("Article", ["title", "content"]).with_hybrid(
    query="机器学习最新进展",
    alpha=0.5,  # 0.5 = 左右脑平等对话（BM25 与 向量同权）；1.0 = 只听右脑的（纯向量）
    fusion_type="rankedFusion"  # 使用 RRF 排名融合
).with_limit(10).do()
```

---

## 7. 性能基准盘点

评估向量数据库的性能，就像 **“测试一辆赛车”**。你不能只看最高时速（QPS），还得看操控精准度（Recall）和油耗（内存）。

### 7.1 核心性能指标

| 指标                      | 定义                 | 重要性         | 类比                                                             |
| :------------------------ | :------------------- | :------------- | :--------------------------------------------------------------- |
| **召回率 (Recall)**       | 返回的真正近邻占比   | 准确性核心指标 | **操控精准度**，100 次转弯，有几次压到了最佳路线？（准确性核心） |
| **QPS (Throughput)**      | 每秒处理的查询数     | 高并发场景关键 | **最高时速**，引擎全速运转时，一秒能跑多远？（高并发能力）       |
| **延迟 (Latency)**        | 单次查询响应时间     | 用户体验关键   | **百公里加速**，踩下油门到推背感出现要多久？（用户体验关键）     |
| **内存占用 (Memory)**     | 索引和数据的内存消耗 | 成本控制       | **油耗/车价**，跑这一趟要烧多少钱？（成本控制）                  |
| **构建时间 (Build Time)** | 创建索引所需时间     | 数据更新效率   | **改装耗时**，甚至还没上赛道，光进站改装要多久？（数据更新效率） |

#### 7.1.1 召回率与 QPS 的权衡（速度与精度的博弈）

这就像 **“开车过弯”**：车速越快（QPS 高），视野越模糊，越容易错过最佳路线（Recall 低）。

```mermaid
---
config:
    xyChart:
        width: 800
        height: 400
        xAxis:
            titlePadding: 10
            labelPadding: 5
        yAxis:
            titlePadding: 10
            labelPadding: 5
---
xychart-beta
    title "HNSW 性能调优：召回率 vs QPS (ef_search 参数影响)"
    x-axis "Recall (精度)" ["85%", "95%", "99%", "99.5%"]
    y-axis "QPS (速度)" 0 --> 55000
    line [50000, 20000, 5000, 1500]
```

> [!TIP]
>
> **老司机的建议：追求“性价比”**
>
> - **85% Recall**：飙车模式。速度极快，但容易漏掉重要信息。
> - **95% Recall (推荐)**：**黄金平衡点**。速度适中，精度足够商用。
> - **99% Recall**：强迫症模式。为了最后 4% 的精度，性能暴跌 4 倍（得不偿失）。

#### 7.1.2 延迟分布（拒绝“长尾效应”）

**P99 延迟** 就像 **“堵车概率”**。平均 15 分钟到家没用，如果每周有一天可能要堵车 1 小时（P99 高），用户就会骂娘。

生产环境对这种**尾延迟（Tail Latency）**，也就是 P95/P99 延迟<sup>[[22]](#ref22)</sup> 尤为敏感：

| 延迟指标 | 含义               | 目标值（推荐） |
| -------- | ------------------ | -------------- |
| **P50**  | 中位数延迟         | < 5ms          |
| **P95**  | 95% 请求的延迟上限 | < 20ms         |
| **P99**  | 99% 请求的延迟上限 | < 50ms         |
| **MAX**  | 最大延迟           | < 200ms        |

### 7.2 主流数据库基准

基于公开基准数据（SIFT-1M，128 维，Recall@10=95%）<sup>[[22]](#ref22)</sup>，各路“车队”的成绩单如下：

#### 7.2.1 百万级赛道 (RAM Base)

| 数据库 (车队)   | QPS (时速) | P99 (操控) | 内存 (油耗) | 类比与点评                                                                      |
| :-------------- | :--------- | :--------- | :---------- | :------------------------------------------------------------------------------ |
| **Milvus**      | ~18,000    | 5ms        | ~2 GB       | **F1 赛车**。为性能而生，综合实力强悍，但维护较复杂（组件多）。                 |
| **Weaviate**    | ~10,000    | 12ms       | ~2.2 GB     | **豪华 SUV**。功能丰富（多模态/模块化），舒适但车身略重。                       |
| **Qdrant**      | ~14,000    | 8ms        | ~1.8 GB     | **高性能跑车**。Rust 引擎极稳，单机性能优异，启动快，轻量灵活。                 |
| **pgvector**    | ~3,000     | 25ms       | ~1.5 GB     | **家用轿车**。从买菜（CRUD）到代步（搜索）一台车搞定，生态极好，够用就好。      |
| **VectorChord** | ~16,000    | 6ms        | ~1.2 GB     | **改装神车 (GTI)**。针对 PG 极致优化的“钢炮”，在特定赛道（1M 规模）甚至能超跑。 |
| **Pinecone**    | (云端)     | 20ms+      | N/A         | **网约车 (Uber)**。随叫随到，不用自己保养，但得忍受早晚高峰（网络延迟）。       |

#### 7.2.2 亿级赛道 (SSD Base)

| 数据库       | 规模   | QPS    | P99    | 类比与备注                                                                         |
| :----------- | :----- | :----- | :----- | :--------------------------------------------------------------------------------- |
| **Milvus**   | 1 亿+  | ~2,500 | < 5ms  | **高铁网络**。重型基建（分布式微服务），虽然造价高、维护难，但兼具极速与超大运力。 |
| **Weaviate** | 1 亿+  | ~1,800 | < 20ms | **模块化列车**。虽然极速不是最快，但稳重可靠，适合混合负载。                       |
| **Qdrant**   | 1 亿+  | ~4,500 | < 10ms | **越野拉力车**。Rust 引擎在 SSD 上依然表现出色，Memmap 技术让它能跑烂路。          |
| **Pinecone** | 10 亿+ | 弹性   | < 50ms | **全球物流网**。Serverless 架构，彻底屏蔽了底层载具，即用即付。                    |
| _DiskANN_    | 10 亿  | ~500   | < 15ms | **重型卡车**。单机拉 10 亿数据的性价比之王，速度慢点但能通过。                     |

### 7.3 索引算法：选哪种交通工具？

| 索引类型    | 类比车型       | 查询速度           | 内存成本         | 召回率 | 适用场景                                                        |
| :---------- | :------------- | :----------------- | :--------------- | :----- | :-------------------------------------------------------------- |
| **Flat**    | **压路机**     | 极慢 (O(N))        | 高 (100%)        | 100%   | **< 10 万**。数据极少，决不能出错，或者作为 Ground Truth 基准。 |
| **IVFFlat** | **公交车**     | 快 (O(√N))         | 高 (100%)        | 99%    | **< 1000 万**。数据量中等，内存充足，不想折腾复杂参数。         |
| **IVFPQ**   | **地铁**       | 快 (O(√N))         | **极低** (5-10%) | 90-95% | **无上限**。内存极其有限（压缩 10-64 倍），能接受精度轻微受损。 |
| **HNSW**    | **磁悬浮**     | **极快** (O(logN)) | **极高** (150%+) | 99%+   | **< 1 亿**。土豪首选（内存大户），为了极致速度不惜一切代价。    |
| **DiskANN** | **集装箱货轮** | 较快 (SSD I/O)     | **极低** (10%)   | 95%+   | **10 亿+**。海量数据，利用 SSD 廉价存储，实现高性价比。         |

---

## 8. 选型实践（购车指南）

### 8.1 决策导航：看人下菜碟

面对琳琅满目的向量数据库，选型的逻辑其实和 **“买车”** 一样简单，核心取决于 **“你想拉多少货（规模）”** 和 **“你是否有专业驾照（运维）”**。

```mermaid
flowchart LR
    START[开始选型] --> Q1{数据规模？}

    Q1 --> |"小 (< 100万)"| SMALL[便利区]
    Q1 --> |"中 (1亿级)"| MEDIUM[性能区]
    Q1 --> |"大 (> 10亿)"| LARGE[成本区]

    SMALL --> Q2{已有 Postgres?}
    Q2 --> |"是 (最推荐)"| PG["<b>pgvector</b><br/>(家用轿车)"]
    Q2 --> |否| Q3{Python 原型?}
    Q3 --> |是| LITE["<b>Chroma / LanceDB</b><br/>(滑板车)"]
    Q3 --> |否| QDRANT_L["Qdrant 本地版"]

    MEDIUM --> Q4{有运维团队?}
    Q4 --> |"有 (老司机)"| SELF["<b>Milvus / Qdrant</b><br/>(自驾超跑)"]
    Q4 --> |"无 (小白)"| CLOUD["<b>Zilliz / Pinecone</b><br/>(打车/云服务)"]

    LARGE --> Q5{预算充足?}
    Q5 --> |"土豪"| MILL_C["<b>Milvus Cluster</b><br/>(超级车队)"]
    Q5 --> |"有限"| DISK["<b>DiskANN</b><br/>(远洋货轮)"]

    style PG fill:#a0d911,stroke:#5b8c00,color:#fff
    style DISK fill:#fa8c16,stroke:#ad4e00,color:#fff
    style SELF fill:#1890ff,stroke:#0050b3,color:#fff
```

- **< 100 万（出门买菜）**：**便利至上**。
  - 别买重卡去买菜。如果你已经有 PostgreSQL（家用轿车），直接装上 pgvector（后备箱）是最香的。
  - 如果是 Python 原型开发，用 LanceDB/Chroma（电动滑板车）足矣。
- **1000 万 - 1 亿（高速通勤）**：**性能至上**。
  - 这时你需要专业的跑车或 SUV。Qdrant/Weaviate/Milvus 是首选。
  - 如果不想自己修车（运维弱），就打车（用 Cloud 服务）。
- **> 10 亿（远洋货运）**：**成本与规模至上**。
  - 这时每公里的油耗（内存成本）都很关键。DiskANN（货轮）是省钱利器。

### 8.2 场景化推荐：穿对鞋走对路

选数据库就像 **“穿鞋”**：爬山穿登山靴，跑步穿跑鞋。

#### 8.2.1 RAG / 知识库问答（图书管理员）

这是最典型的 **“查资料”** 场景。需要极高的 **语义理解** 和 **混合搜索** 能力（既要查关键字，又要查意思）。

| 需求维度   | 推荐方案                | 核心理由                                                             |
| :--------- | :---------------------- | :------------------------------------------------------------------- |
| **省心党** | **Pinecone Serverless** | **“电子书阅读器”**。开机即用，不用管服务器，按页付费。               |
| **全能党** | **Weaviate**            | **“智能书柜”**。自带 embedding 模型，把“整理书”和“找书”全包了。      |
| **实惠党** | **pgvector**            | **“家用书架”**。如果你本来就用 Postgres 存文章，直接加个插件最顺手。 |

> [!TIP]
>
> **标配装备**：
>
> - **索引**：HNSW（为了准）
> - **相似度**：Cosine（看语义）
> - **切片**：512 tokens + 10% 重叠（防断章取义）

#### 8.2.2 电商 / 推荐系统（带货主播）

这是 **“拼手速”** 的场景。流量巨大，延迟必须低，而且通常需要结合 **用户标签**（过滤）。

| 需求维度     | 推荐方案                | 核心理由                                                         |
| :----------- | :---------------------- | :--------------------------------------------------------------- |
| **极致性能** | **Milvus + GPU**        | **“F1 车队”**。扛得住双 11 的流量洪峰，毫秒级响应。              |
| **灵活过滤** | **Qdrant**              | **“越野车”**。在复杂的 User ID / Tags 过滤条件下，依然跑得飞快。 |
| **海量商品** | **DiskANN (in Vamana)** | **“货轮”**。商品上亿时，为了省钱（内存），必须用 SSD。           |

> [!TIP]
>
> **标配装备**：
>
> - **索引**：IVFPQ（为了快和省）或 HNSW
> - **相似度**：IP (点积，直接关联热度)
> - **策略**：Post-filtering（因为符合条件的一抓一大把）

#### 8.2.3 图像 / 多模态搜索（艺术鉴赏）

这是 **“看细节”** 的场景。向量维度通常很高（512-1024+），对精度要求极高。

| 需求维度     | 推荐方案                 | 核心理由                                                      |
| :----------- | :----------------------- | :------------------------------------------------------------ |
| **多模态**   | **Weaviate + Multi2Vec** | **“多功能画廊”**。直接支持搜图、搜视频，不用自己搞模型转换。  |
| **人脸识别** | **Milvus**               | **“精密显微镜”**。对 1:1 比对的精度要求极高，原生支持多向量。 |

> [!TIP]
>
> **标配装备**：
>
> - **维度**：512-768 (CLIP/ViT)
> - **归一化**：**必须**（为了用点积加速 Cosine 计算）
> - **索引**：HNSW（精度优先）

### 8.3 成本估算参考（养车账单）

买车容易养车难，算算不同规模下的 **“停车费”**（存储与计算成本）。

| 数据规模      | 方案选择          | 月供估算         | 类比与点评                                                                      |
| :------------ | :---------------- | :--------------- | :------------------------------------------------------------------------------ |
| **10 万级**   | Pinecone Starter  | **$0 (免费)**    | **路边免费车位**。随便停，也就是练练手，不能当真。                              |
| **100 万级**  | pgvector (自建)   | **$50 (低)**     | **自家车库**。利用现有的 Postgres，只需多付点电费（资源），最划算。             |
| **1000 万级** | Milvus (自建)     | **$200 (中)**    | **租私家车位**。需要专门的服务器资源，得有人打理。                              |
| **1 亿级**    | Zilliz Cloud      | **$1,000+ (高)** | **代客泊车 (Valet)**。贵是贵了点，但有专人伺候（托管），（**未必**）省心。      |
| **10 亿级**   | DiskANN vs. Cloud | **$2k vs. $10k** | **自建停车场 vs 机场 VIP**。海量数据下，自建（DiskANN）比托管能省下一辆法拉利。 |

### 8.4 技术栈匹配（充电桩适配）

选数据库要把 **“充电口”** 对上，别硬插。

| 你的技术栈     | 完美适配                  | 匹配理由（类比）                                                               |
| :------------- | :------------------------ | :----------------------------------------------------------------------------- |
| **Python**     | **全兼容**                | **“万能插座”**。AI 领域的通用语，所有向量库都把 Python SDK 捧在手心里。        |
| **PostgreSQL** | **pgvector, VectorChord** | **“原厂配件”**。无需改装，直接无缝集成到现有的数据库引擎中。                   |
| **Node.js**    | **Pinecone / Weaviate**   | **“Type-C 接口”**。JSON 风格的 API 设计亲和力极佳，像写 Web 后端一样顺手。     |
| **Kubernetes** | **Milvus / Qdrant**       | **“集装箱标准”**。天生就是云原生的，虽然部署重（Operator），但扩容就像堆积木。 |

---

## 9. 向量库体验（上路试驾）

### 9.1 PostgreSQL + pgvector（给老车装导航）

如果你手头已经有一辆 **PostgreSQL（家用轿车）**，最经济实惠的方案不是去买辆新跑车，而是直接 **“加装一个导航模块”**（pgvector 插件）。

#### 9.1.1 启动车辆（Docker）

```bash
# 一键启动带 pgvector 的 PostgreSQL
docker run -d \
  --name pgvector \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  ankane/pgvector
```

#### 9.1.2 系统改装（SQL）

给你的车机系统升级：激活软件、定义坐标、下载离线地图。

```sql
-- 1. 安装导航软件 (启用插件)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 定义坐标系 (创建表)
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    -- 这里的 1536 就像是 GPS 的精度，对应 OpenAI 模型
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 构建路网 (HNSW 索引)
-- 不建索引也能跑，但得把地图翻烂了找 (全表扫描)
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

#### 9.1.3 上路试驾（Python）

现在开始驾驶：把文字变成坐标 (Embedding)，然后计算“最近”的距离。

```python
import psycopg2
from openai import OpenAI

# 初始化
client = OpenAI()
conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/postgres")

def get_embedding(text):
    """获取文本的嵌入向量 (GPS 定位)"""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def insert_document(title, content):
    """插入文档 (收藏地点)"""
    embedding = get_embedding(content)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (title, content, embedding) VALUES (%s, %s, %s)",
            (title, content, embedding)
        )
    conn.commit()

def search_documents(query, top_k=5):
    """语义搜索 (导航去哪)"""
    query_embedding = get_embedding(query)
    with conn.cursor() as cur:
        # <=> 是 pgvector 专用的距离运算符
        cur.execute("""
            SELECT id, title, 1 - (embedding <=> %s::vector) AS similarity
            FROM documents
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """, (query_embedding, query_embedding, top_k))
        return cur.fetchall()

# 使用示例
insert_document("AI 介绍", "人工智能是计算机科学的一个分支...")
results = search_documents("什么是机器学习")
print(results)
```

### 9.2 Milvus（组建赛车队）

如果要追求极致性能（F1 级别），光改家用代步车（Postgres）就不够了，你需要组建一支专业的 **Milvus 赛车队**。这不仅是一辆车，而是一个包含 **指挥塔 (etcd)**、**器材仓库 (MinIO)** 和 **引擎 (Milvus)** 的完整系统。

#### 9.2.1 搭建基地（Docker Compose）

```yaml
# docker-compose.yml
version: "3.5"

services:
  # 1. 指挥塔：负责调度和记录系统状态 (元数据)
  etcd:
    image: quay.io/coreos/etcd:v3.5.5
    environment:
      - ETCD_AUTO_COMPACTION_MODE=revision
      - ETCD_AUTO_COMPACTION_RETENTION=1000
    volumes:
      - etcd_data:/etcd

  # 2. 器材仓库：存放大量的向量数据文件 (对象存储)
  minio:
    image: minio/minio:RELEASE.2023-03-20T20-16-18Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/minio_data
    command: minio server /minio_data

  # 3. 赛车引擎：核心计算单元
  milvus:
    image: milvusdb/milvus:v2.3.3
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    volumes:
      - milvus_data:/var/lib/milvus
    ports:
      - "19530:19530" # API 端口
      - "9091:9091" # 管理端口
    depends_on:
      - etcd
      - minio

volumes:
  etcd_data:
  minio_data:
  milvus_data:
```

#### 9.2.2 下场比赛（Python）

有了车队，下一步就是制定 **比赛策略**（Schema 和索引）并 **下场跑圈**（插入和搜索）。

```python
from pymilvus import MilvusClient, DataType

# 1. 连接指挥塔
client = MilvusClient(uri="http://localhost:19530")

# 2. 制定车辆规格 (Schema Blueprint)
schema = client.create_schema(auto_id=True, enable_dynamic_field=True)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("embedding", DataType.FLOAT_VECTOR, dim=1536)
schema.add_field("title", DataType.VARCHAR, max_length=512)

# 3. 引擎调校 (索引参数)
# 就像调整赛车的空气动力学套件，决定了是跑得快(HNSW)还是更省油(IVF)
index_params = client.prepare_index_params()
index_params.add_index(
    field_name="embedding",
    index_type="HNSW",
    metric_type="COSINE",
    params={"M": 16, "efConstruction": 256}
)

# 4. 组装车辆 (创建 Collection)
client.create_collection(
    collection_name="documents",
    schema=schema,
    index_params=index_params
)

# 5. 注入燃料 (插入数据)
data = [
    {"embedding": [0.1] * 1536, "title": "文档1"},
    {"embedding": [0.2] * 1536, "title": "文档2"},
]
client.insert(collection_name="documents", data=data)

# 6. 全速冲刺 (搜索)
results = client.search(
    collection_name="documents",
    data=[[0.15] * 1536],
    limit=5,
    output_fields=["title"]
)
print(results)
```

### 9.3 Faiss（手搓发动机）

如果你是那种喜欢 **“自己动手造车”** 的硬核极客，或者只需要一个轻量的 **嵌入式引擎**，那么 Faiss 是你的不二之选。它不是整车，而是那个 **V12 发动机缸体**，能不能跑起来全看你代码怎么写。

#### 9.3.1 采购零件（安装）

```bash
pip install faiss-cpu  # 经济适用版
# 或
pip install faiss-gpu  # 赛道性能版（需要 CUDA 显卡支持）
```

#### 9.3.2 组装与试车（Python）

Faiss 的核心在于 **“选对变速箱”**（索引类型），不同的索引决定了它是拖拉机还是法拉利。

```python
import numpy as np
import faiss

# 1. 设定规格
d = 128                        # 气缸数 (向量维度)
nb = 100000                    # 燃料量 (数据库向量数)
nq = 10                        # 比赛圈数 (查询向量数)

np.random.seed(42)
xb = np.random.random((nb, d)).astype('float32')
xq = np.random.random((nq, d)).astype('float32')

# 2. 选择变速箱 (创建索引)

# 方案 A: Flat 索引 (直驱)
# 暴力搜索，精度 100%，但速度慢，像压路机
index_flat = faiss.IndexFlatL2(d)

# 方案 B: IVF 索引 (公交线路)
# 需要先“勘测地形” (Train)，把数据通过聚类划分已知的“站点” (nlist)
nlist = 100
quantizer = faiss.IndexFlatL2(d)
index_ivf = faiss.IndexIVFFlat(quantizer, d, nlist)
# 必须先训练！让索引知道数据的分布情况
index_ivf.train(xb)

# 方案 C: HNSW 索引 (高速路网)
# 构建图结构，像导航一样跳跃式搜索，不用训练，既快又准
index_hnsw = faiss.IndexHNSWFlat(d, 32)  # M=32 (高速路口连接数)

# 3. 注入燃料 (添加向量)
index_flat.add(xb)
index_ivf.add(xb)
index_hnsw.add(xb)

# 4. 下场跑圈 (搜索)
k = 5  # 寻找最近的 5 个对手

# Flat 搜索
D_flat, I_flat = index_flat.search(xq, k)

# IVF 搜索 (调节探测范围)
# nprobe=10 表示只去 10 个最近的公交站找，搜得越少越快，但也越容易漏
index_ivf.nprobe = 10
D_ivf, I_ivf = index_ivf.search(xq, k)

# HNSW 搜索
D_hnsw, I_hnsw = index_hnsw.search(xq, k)

# 5. 成绩对比
print(f"Flat (基准): {I_flat}")
print(f"IVF  (近似): {I_ivf}")
print(f"HNSW (极速): {I_hnsw}")

# 6. 封存引擎 (保存索引)
faiss.write_index(index_hnsw, "hnsw.index")
loaded_index = faiss.read_index("hnsw.index")
```

### 9.4 性能调优速查表（车队技师手册）

车买了，队组了，跑得快不快还得看 **“调校”**。以下是一份老技师的 **Pit Stop 检查清单**：

| 调优部位                   | 检查项          | 技师建议（类比与实操）                                                                      |
| :------------------------- | :-------------- | :------------------------------------------------------------------------------------------ |
| **车身减重**<br>(Data)     | **向量维度**    | **选轻量化材质**。能用 768 维就别用 1536 维，车身越轻，过弯（计算）越快。                   |
|                            | **归一化**      | **平衡配重**。使用 Cosine 或 IP 距离时必须归一化，否则车辆重心不稳（结果跑偏）。            |
| **变速箱**<br>(Index)      | **索引选型**    | **看路况选波箱**。数据 < 100 万选 HNSW（双离合，快但贵）；数据大选 IVFPQ（CVT，省油平顺）。 |
|                            | **HNSW `M`**    | **挡位数量**。16-32 是黄金区间。挡位太多（M 大）虽然极速高，但太占地儿（内存）。            |
|                            | **`ef_build`**  | **出厂磨合**。建索引时别急，设到 100-200 (`ef_construction`) 让零件磨合好，精度耐用性更高。 |
| **驾驶习惯**<br>(Query)    | **`ef_search`** | **油门深度**。想要在弯道超车（高召回），就得深踩油门（调大参数），代价是费油（高延迟）。    |
|                            | **批量查询**    | **拼车出行**。一次拉 10 个人（Batch Search）比跑 10 趟单程效率高得多。                      |
| **赛道支持**<br>(Hardware) | **内存容量**    | **轮胎预热**。热数据（HNSW/IVF 质心）必须全在内存（热熔胎），碰到 Swap（冷胎）直接打滑。    |
|                            | **磁盘 IO**     | **铺装路面**。DiskANN 必须跑在 NVMe SSD（专业赛道）上，HDD（土路）会把悬挂颠散架。          |

---

## 附录：核心概念俗解

### 索引原理：图书馆模型

为了理解向量数据库的内部运作，我们可以将其想象成一个 **“管理严苛的图书馆”**。

> [!NOTE]
>
> **全流程通俗演绎**
>
> 1. **索引构建（新书上架）**：
>    当新数据（比如一本《三体》）入库时，管理员不会把它随便扔在地上（那叫无索引），而是先提取它的特征（计算向量），判定它属于“科幻类”（聚类/哈希），然后精准地插到 **K 区-03 架** 的位置上（写入索引结构）。
>
> 2. **向量查询（按图索骥）**：
>    当你查询“黑暗森林法则”时，管理员不需要把馆里 100 万本书全翻一遍（全表扫描），而是根据索引指引，直奔 **K 区-03 架**（ANN 搜索），在那个极小的范围内瞬间挑出最相关的几本书（召回 Top-K）。

### 索引算法全景

如果说图书馆是 **“运作模型”**，那具体的 **“排架规则”** 就是 **算法**。不同的规则决定了你是找得快、存得少，还是找得准。

```mermaid
%%{init: {'theme': 'dark'}}%%
graph LR
    subgraph "向量索引家族"
        direction LR
        ROOT[索引算法]

        %% 左侧分支
        TREE["🌲 树<br/>(空间划分)"] --- ROOT
        HASH["#️⃣ 哈希<br/>(概率分桶)"] --- ROOT

        %% 左侧叶子
        KD[KD-Tree] --- TREE
        ANNOY[Annoy] --- TREE

        LSH[LSH] --- HASH

        %% 右侧分支
        ROOT --- QUANT["📉 量化<br/>(数据压缩)"]
        ROOT --- GRAPH["🔗 图<br/>(近邻导航)"]

        %% 右侧叶子
        QUANT --- PQ[PQ<br/>乘积量化]
        QUANT --- SQ[SQ<br/>标量量化]

        GRAPH --- HNSW[HNSW<br/>分层图]
        GRAPH --- DISK[DiskANN<br/>磁盘图]
    end

    style HNSW fill:#52c41a,color:#fff
    style PQ fill:#1890ff,color:#fff
    style DISK fill:#fa8c16,color:#fff
```

| 索引流派       | 代表算法           | 时间开销  | 空间开销 | 召回率 | 通俗类比                                                                    | 核心特点与代价                                                                |
| :------------- | :----------------- | :-------- | :------- | :----- | :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| **空间划分派** | 树：**KD-Tree**    | O(log n)  | 中       | 高     | **“二十个问题”**。<br/>把空间一分为二，不断切分，直到找到目标。             | 适合低维数据。<br/>在高维空间下，切分变得极其困难（维度诅咒）。               |
| **概率分桶派** | 哈希：**LSH**      | O(1) 平均 | 低-中    | 中     | **“粗略归类”**。<br/>把红袜子扔红桶，蓝袜子扔蓝桶。                         | **极快但粗糙**。<br/>为了速度牺牲了精度，稍微不同一点就可能扔错桶。           |
| **数据压缩派** | 量化：**PQ / SQ**  | O(K × M)  | 极低     | 中-高  | **“图片马赛克”**。<br/>把高清图变成缩略图，存储变小了，但细节丢了。         | **省内存神器**。<br/>常与其他算法（如 IVF）结合使用，是工业界降低成本的关键。 |
| **近邻导航派** | 图：**HNSW**       | O(log n)  | 高       | 极高   | **“六度人脉”**。<br/>通过朋友找朋友，跳跃式接近目标，直到找到最相似的那个。 | **性能王者**。<br/>找得快、找得准，代价是需要维护复杂的朋友圈关系（费内存）。 |
| **混合流派**   | 复合：**IVF + PQ** | O(√n × M) | 低       | 高     | **“分区+压缩”**。<br/>先大致分片（IVF），再压缩存储（PQ）。                 | **性价比之选**。<br/>在速度、精度和成本间取得了最佳平衡，大规模场景首选。     |

### 向量风格：数据的不同“画风”

把向量比作一幅画，不同的向量类型就是不同的 **绘画风格**。

| 向量类型                           | 画风类比        | 存储效率      | 精度 | 核心特征                                                         | 典型应用                         |
| :--------------------------------- | :-------------- | :------------ | :--- | :--------------------------------------------------------------- | :------------------------------- |
| **Dense Vector**<br>(稠密向量)     | **油画 (全彩)** | 中            | 高   | **画布铺满**。每一寸都有色彩（非零值），信息量最大，但也最占地。 | 语义搜索 (BERT/OpenAI embedding) |
| **Sparse Vector**<br>(稀疏向量)    | **素描 (留白)** | 高            | 高   | **大量留白**。只描绘关键线条（关键词），画纸大片空白（零值）。   | 关键词搜索 (TF-IDF/BM25)         |
| **Binary Vector**<br>(二值向量)    | **剪影 (黑白)** | 极高（1-bit） | 低   | **非黑即白**。只记录轮廓（0 或 1），极其抽象和精简。             | 快速去重 (SimHash)               |
| **Quantized Vector**<br>(量化向量) | **缩略图**      | 高            | 中   | **细节模糊**。把高清图压缩成小图，看个大概逻辑（聚类中心）。     | 内存优化 (PQ 编码)               |

### 向量精度：分辨率的抉择

向量的每个维度（数字）存得越细，精度越高，但开销也越大。这就像选择视频的 **分辨率**。

```mermaid
graph BT
    subgraph "精度 vs 空间"
        direction LR
        F32[Float32<br/>4K 原画]
        F16[Float16<br/>1080P]
        I8[Int8<br/>480P]
        B1[Binary<br/>像素画]
    end

    F32 --> |"体积 100%"| APP1[基准：精确计算]
    F16 --> |"体积 50%"| APP2[主流：推理加速]
    I8 --> |"体积 25%"| APP3[高性能：大规模存储]
    B1 --> |"体积 3%"| APP4[极致：极致压缩]

    style F32 fill:#1890ff,color:#fff
    style I8 fill:#52c41a,color:#fff
```

| 精度类型   | 类比 (分辨率)  | 空间 (每维) | 相对误差 | 计算速度 | 特性                                                   | 推荐场景            |
| :--------- | :------------- | :---------- | :------- | :------- | :----------------------------------------------------- | ------------------- |
| **FP32**   | **4K 原盘**    | 4 字节      | 基准     | 基准     | **毫发毕现**。数字小数点后保留 7 位，精准但庞大。      | 科学计算、模型训练  |
| **FP16**   | **1080P 高清** | 2 字节      | <0.1%    | 1.5-2x   | **肉眼难辨**。精度几乎无损，显存占用减半。             | GPU 推理 (默认首选) |
| **BF16**   | **电竞高刷屏** | 2 字节      | <0.5%    | 1.5-2x   | **防撕裂**。牺牲一点精度换取数值范围，不仅快还防溢出。 | 混合精度训练        |
| **INT8**   | **480P 流畅**  | 1 字节      | <1%      | 2-4x     | **极速加载**。精度有损，但速度快 4 倍，大规模可接受。  | 生产环境 (量化后)   |
| **Binary** | **像素图标**   | 1/8 字节    | 5-10%    | 10-32x   | **看个轮廓**。极致压缩，用于第一轮海选。               | 超大规模初筛        |

---

## References

<a id="ref1"></a>[1] T. Brown et al., "Language models are few-shot learners," in _Adv. Neural Inf. Process. Syst._, vol. 33, pp. 1877–1901, 2020.

<a id="ref2"></a>[2] P. Lewis et al., "Retrieval-augmented generation for knowledge-intensive NLP tasks," in _Adv. Neural Inf. Process. Syst._, vol. 33, pp. 9459–9474, 2020.

<a id="ref3"></a>[3] Amazon AWS, "What is retrieval augmented generation (RAG)?" _AWS Documentation_, 2024. [Online]. Available: https://aws.amazon.com/what-is/retrieval-augmented-generation/

<a id="ref4"></a>[4] T. Mikolov et al., "Efficient estimation of word representations in vector space," _arXiv preprint arXiv:1301.3781_, 2013.

<a id="ref5"></a>[5] N. Reimers and I. Gurevych, "Sentence-BERT: Sentence embeddings using siamese BERT-networks," in _Proc. Conf. Empirical Methods Nat. Lang. Process._, pp. 3982–3992, 2019.

<a id="ref6"></a>[6] V. Karpukhin et al., "Dense passage retrieval for open-domain question answering," in _Proc. Conf. Empirical Methods Nat. Lang. Process._, pp. 6769–6781, 2020.

<a id="ref7"></a>[7] Writer, "What is a vector database?" _Writer AI Glossary_, 2024. [Online]. Available: https://www.ai21.com/glossary/foundational-llm/vector-database/

<a id="ref8"></a>[8] Milvus Documentation, "Vector index overview," 2024. [Online]. Available: https://milvus.io/docs/index.md

<a id="ref9"></a>[9] S. Lloyd, "Least squares quantization in PCM," _IEEE Trans. Inf. Theory_, vol. 28, no. 2, pp. 129–137, Mar. 1982.

<a id="ref10"></a>[10] P. Indyk and R. Motwani, "Approximate nearest neighbors: Towards removing the curse of dimensionality," in _Proc. 30th Annu. ACM Symp. Theory Comput._, pp. 604–613, 1998.

<a id="ref11"></a>[11] J. Kleinberg, "Navigation in a small world," _Nature_, vol. 406, no. 6798, p. 845, Aug. 2000.

<a id="ref12"></a>[12] Y. A. Malkov and D. A. Yashunin, "Efficient and robust approximate nearest neighbor search using hierarchical navigable small world graphs," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 42, no. 4, pp. 824–836, Apr. 2020.

<a id="ref13"></a>[13] H. Jégou, M. Douze, and C. Schmid, "Product quantization for nearest neighbor search," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 33, no. 1, pp. 117–128, Jan. 2011.

<a id="ref14"></a>[14] Zilliz, "Understanding IVF index," 2024. [Online]. Available: https://zilliz.com/learn/ivf-index-explained

<a id="ref15"></a>[15] TensorChord, "RaBitQ: Randomized binary quantization," 2024. [Online]. Available: https://www.tensorchord.ai/blog/rabitq

<a id="ref16"></a>[16] S. J. Subramanya et al., "DiskANN: Fast accurate billion-point nearest neighbor search on a single node," in _Adv. Neural Inf. Process. Syst._, vol. 32, 2019.

<a id="ref17"></a>[17] R. Guo et al., "Accelerating large-scale inference with anisotropic vector quantization," in _Proc. Int. Conf. Mach. Learn._, vol. 119, pp. 3747–3756, 2020.

<a id="ref18"></a>[18] NVIDIA, "CAGRA: GPU-accelerated graph index for vector search," _NVIDIA RAFT Documentation_, 2024. [Online]. Available: https://docs.nvidia.com/deeplearning/raft/

<a id="ref19"></a>[19] Pinecone, "Vector similarity explained," 2024. [Online]. Available: https://www.pinecone.io/learn/vector-similarity/

<a id="ref20"></a>[20] Weaviate, "Hybrid search explained," 2024. [Online]. Available: https://weaviate.io/developers/weaviate/search/hybrid

<a id="ref21"></a>[21] Qdrant, "Filtered vector search," 2024. [Online]. Available: https://qdrant.tech/articles/filtered-vector-search/

<a id="ref22"></a>[22] ANN-Benchmarks, "Benchmarking nearest neighbor algorithms," 2024. [Online]. Available: https://ann-benchmarks.com/

<a id="ref23"></a>[23] E. Bernhardsson, "Annoy: Approximate nearest neighbors in C++/Python," _GitHub Repository_, 2015. [Online]. Available: https://github.com/spotify/annoy

<a id="ref24"></a>[24] J. Johnson et al., "Billion-scale similarity search with GPUs," _IEEE Trans. Big Data_, vol. 5, no. 1, pp. 107–118, Mar. 2019.

<a id="ref25"></a>[25] R. W. Hamming, "Error detecting and error correcting codes," _Bell Syst. Tech. J._, vol. 29, no. 2, pp. 147–160, Apr. 1950.

<a id="ref26"></a>[26] P. Jaccard, "Étude comparative de la distribution florale dans une portion des Alpes et du Jura," _Bull. Soc. Vaudoise Sci. Nat._, vol. 37, pp. 547–579, 1901.

<a id="ref27"></a>[27] Milvus Documentation, "Filtered vector search," 2024. [Online]. Available: https://milvus.io/docs/filtered_search.md

<a id="ref28"></a>[28] VectorDBBench, "Vector database benchmarking tool," _GitHub Repository_, 2024. [Online]. Available: https://github.com/zilliztech/VectorDBBench

<a id="ref29"></a>[29] OpenAI, "Embeddings guide," _OpenAI Documentation_, 2024. [Online]. Available: https://platform.openai.com/docs/guides/embeddings

<a id="ref30"></a>[30] T. Ge et al., "Optimized product quantization," _IEEE Trans. Pattern Anal. Mach. Intell._, vol. 36, no. 4, pp. 744–755, Apr. 2014.
