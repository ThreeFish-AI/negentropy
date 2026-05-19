---
name: doc-review
description: 对文档进行系统性 Review，包括但不限于：审计与熵减优化，确保架构正交、逻辑自洽、内容完整且直观。
allowed-tools: view_file, list_dir, grep_search, find_by_name, replace_file_content, multi_replace_file_content, write_to_file, search_web
---

# Document Review Skill

本 Skill 旨在为文档提供标准化、全维度的审查与精调服务。不仅要发现问题，更要**解决问题**。通过系统性思维与架构视角审查文档，并在确认优化方案后，**主动将精调后的版本直接落实到目标文档中**，确保文档质量的实质性提升。

## 核心审查点

依据 `AGENTS.md` 的工程行为准则，从以下五个正交维度对文档进行深度审计：

### 1. 系统性 (Systemic Integrity)

- **全局视角**：文档是否建立了与项目全景（Pulse, Hippocampus, Perception, Realm of Mind）的链接？
- **涟漪效应**：是否评估了文档变更对上下游（如架构图、API 定义、测试用例）的潜在影响？
- **上下文锚定**：内容是否基于 CDD (Context-Driven Development) 构建，而非孤立的描述？

### 2. 正交性 (Orthogonality)

- **关注点分离**：是否清晰界定了“为什么 (Why)”、“是什么 (What)”与“怎么做 (How)”？
- **概念独立**：各章节是否作为一个独立的概念主体存在？修改一处是否需要联动修改多处（High Coupling）？
- **去冗余**：遵循 DRY (Don't Repeat Yourself) 原则，引用单一事实来源 (Single Source of Truth) 而非重复定义。

### 3. 顺序自洽 (Sequential Consistency)

- **逻辑流**：阅读顺序是否符合认知规律（如：背景 -> 目标 -> 方案 -> 验证）？
- **因果链**：推论是否由前置事实严谨推导得出？是否存在突兀的跳跃？
- **术语一致性**：核心名词与动词在全文及跨文档间是否保持严格一致？

### 4. 完整性 (Completeness)

- **闭环验证**：是否涵盖了“设计-实现-验证”的全链路？是否有明确的测试标准或 SOP？
- **边界覆盖**：是否讨论了限制条件、边缘情况 (Edge Cases) 与故障模式？
- **循证工程**：关键决策是否提供了背景引用或 IEEE 格式的参考文献？

### 5. 直观性 (Intuitiveness)

- **图文并茂**：复杂逻辑是否通过 Mermaid 图表（时序图、流程图、类图）进行了可视化降维？
- **视觉层级**：标题、列表、引用块的使用是否构建了清晰的信息层级？
- **代码规范**：代码示例是否完整、可运行，并符合 Vibe Coding Pipeline 标准？

## 审查流程

### Step 1: 全景扫描 (Panorama Scan)

- **范围定义**：明确文档的受众、核心目标与边界。
- **体量评估**：检查字数、章节深度，评估是否需要拆分（如果层级 > 4 或字数 > 1万字）。
- **预检清单**：执行元数据检查、语言规范检查与 Checksums 验证。

### Step 2: 骨架评估 (Skeleton Assessment)

- **TOC 分析**：提取目录树，验证是否符合 MECE 原则（完全穷尽，相互独立）。
- **叙事流验证**：检查顶级章节的排序逻辑（如：Input -> Process -> Output 或 Context -> Strategy -> Tactics）。
- **认知负载检查**：识别过于臃肿的章节（Fat Sections），建议拆分或重组。

### Step 3: 内容一致性与正交性 (Consistency & Orthogonality)

- **概念解耦**：检查章节间是否存在强耦合（改A需改B），建议正交化重构。
- **事实核对 (CDD)**：交叉验证文档内容与代码库 (`src/`) 及架构标准 (`AGENTS.md`) 的一致性。
- **术语标准化**：扫描全文，确保专有名词（如 "Hippocampus", "Perception"）定义的唯一性与一致性。

### Step 4: 熵减与精炼 (Entropy Reduction)

- **噪声过滤**：删除冗余的修饰语、过时的描述和重复的定义。
- **信噪比优化**：将大段文本转换为列表、表格或 Mermaid 图表。
- **代码规范**：验证代码块是否完整、可运行，并移除无关的 Log 或注释。

### Step 5: 导航与交互体验 (Navigation & UX)

- **视觉层级**：检查标题、引用块、Alerts 的层级关系是否清晰。
- **路标系统**：验证锚点链接（Inter-links）与外部引用（References）的有效性。
- **图表审查**：确保所有 Mermaid 图表在 Dark Mode 下清晰可见，且具备完整的图例。

## 交付产物 (Deliverables)

Review 的最终目的不是产出报告，而是**产出更好的文档**。

1. **Direct Refinement (首选)**:
   - 对于所有可确定的优化（如排版修复、逻辑理顺、术语统一、熵减精简），**必须直接修改目标文件**。
   - 修改后，简要说明修改理由（Why）与变更点（Diff）。

2. **Review Report (次选)**:
   - 仅在遇到需要用户决策的重大架构问题或不确定性较高时，才输出纯建议报告。
   - 报告中应包含问题分级（Critical/Major/Minor）。
