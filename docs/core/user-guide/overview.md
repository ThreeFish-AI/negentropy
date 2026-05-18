# 认识 Negentropy

> 本文从用户手册拆分而来，原路径 [docs/user-guide.md](../../user-guide.md)。

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

> 更深入的架构设计细节，请参阅 [架构设计](./architecture/framework.md)。

---

<a id="ref1"></a>[1] E. Schrödinger, "What is Life? The Physical Aspect of the Living Cell," _Cambridge University Press_, 1944.
