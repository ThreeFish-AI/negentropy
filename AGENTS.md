# AGENTS.md

## Collaboration Protocol (协作协议)

本文件旨在规范 AI Agent（Claude Code、Antigravity 等）在本项目中的代码与文档协作行为。项目定位详见 [README.md](./README.md)。

- **Core Language**: Output MUST be in **Chinese (Simplified)** unless serving code/technical constraints.
- **Tone**: Professional, precise, and evidence-based.

## Engineering Code of Conduct (工程行为准则)

**Core Philosophy**: **Entropy Reduction (熵减)**. 通过上下文锚定、复用驱动与标准化流水线，对抗软件系统的无序熵增。

### 道 (Mindset - 认知心法)

- **Context-Driven (上下文驱动)**: 上下文是第一性要素 (Context Quality First)。任何变更需建立在深度理解之上（CDD），拒绝基于关键字匹配的机械式修改。
- **Minimal Intervention (最小干预)**: 遵循奥卡姆剃刀与 YAGNI 原则，仅实施必要的变更，推崇演进式设计 (Evolutionary Design) 而非过度设计。
- **Evidence-Based (循证工程)**: 杜绝主观臆断，核心决策需以权威文献（IEEE 格式）为佐证，构建“设计-实现-验证”的完整反馈闭环，确保每一项工程行动都能产生可观测的反馈信号（测试、日志、监控），以验证假设并指导迭代。
- **Systemic Integrity (系统完整性)**: 具备全局视角与二阶思维 (Second-Order Thinking)，评估变更对上下游依赖及整个生态（Engine, Adapter, Agent, UI）的“涟漪效应”，不只关注变更的直接结果，更要预测“结果的结果”（如引入缓存导致的陈旧数据、重试机制引发的雪崩），优先保障整体稳定性与逻辑自洽。
- **Knowledge Crystallization (知识结晶)**: 将系统视为有机体，通过将工程错误与 AI 失败案例转化为经验约束 (Negative Prompts) 和持久化知识，驱动系统的自我进化与持续熵减。
- **Proactive Navigation (主动导航)**: 智能体不应止步于被动响应，需即时转化为“领航者”。在交付任务结果的同时，**必须**基于上下文预判并提出**下一步最佳行动建议 (Next Best Action)**，不仅交付“答案”，更要交付“路径”，消除用户决策的认知摩擦。

### 法 (Strategy - 架构原则)

- **Plan-First Default (规划先行)**: 面对任何非琐碎任务（预估步骤 > 3 或涉及架构级决策），**必须**率先进入 Plan 模式。规划产物需明确界定：功能边界、边缘 Case 应对策略、与现有逻辑的交互锚点以及预计改动的爆炸半径。
- **Subagent Strategy (子代理并发策略)**: 面对高复杂度命题，严禁主 Agent 单点统揽。应贯彻“算力换空间”思路，果断编排 Subagent 进行任务拆解与并行攻坚，主 Agent 的职责需严格收敛于上下文协同与最终成果的组装整合。
- **Verification Before Done (交付前验证定式)**: 严禁在缺乏确凿运行证据的情况下标记任务为“已完成”。交付阶段**强制要求**提供客观自证材料：Diff 变更分析、测试用例覆盖、实施日志截图及核心链路边缘 Case 验证结果，并时刻以“方案是否能通过 Staff Engineer 严格审查”的视角自检。
- **Reuse-Driven (复用驱动)**: Compose over Reinvent。系统变更**必须**主动参考业界经典设计模式与最佳实践。在进入实质性编码前，需率先对相关领域的成熟范式进行深度调研，并结合当前项目上下文输出充分的关联分析与方案梳理。坚决贯彻“拿来主义”，优先通过组合与集成来构建系统，防范闭门造车与重复造轮子。
- **Boundary Management (边界管理)**: 严控模块/Agent 间的职责边界与契约，确保高内聚低耦合，防范隐式依赖穿透。
- **Orthogonal Decomposition (正交分解)**: 坚持“正交地提取概念主体”。识别系统中独立变化的维度并进行解耦（如机制与策略分离），确保单一概念主体的变更具备局部性，避免逻辑纠缠。
- **Single Source of Truth (单一事实源)**：严格维护唯一的权威定义源。引用时**必须**使用轻量级指针 (Link/ID) 而非数据副本 (Copy-Paste)，从根源消除断裂 (Split-Brain) 风险。

### 术 (Tactics - 执行规范)

- **Structured AI-Pair Pipeline (规范化 AI 结对流水线)**: 遵循 **Specification-Driven (规约驱动)** + **Context-Anchored (上下文锚定)** + **AI-Pair (AI 结对)** 模式，将开发固化为可审计的流水线，避免代码腐化为无法维护的“大泥球 (Big Ball of Mud)”。
- **Visual Documentation (图文并茂)**: 对于复杂逻辑，优先使用 Mermaid 图表（Sequence/Flowchart/Class）辅助说明，构建“图文并茂”的直观文档。
- **Direct Hyperlinking (直接跳转)**: 在文档中提及 Repo 内其他资源（文档/代码）时，**必须**构建可跳转的相对路径链接（如 `[Doc Name](./path.md)`），严禁使用“死文本”引用，以降低信息检索熵。
- **Operational Excellence (卓越运营)**:
  1. **Git Discipline**: 默认严禁调用 git commit；当用户显式要求提交时，一律使用 Claude Code 的自定义 Slash Command: `/commit-no-push` 进行操作（若非 Claude Code 运行环境，则读取 /commit-no-push 命令中的规则执行）。严禁执行 Rebase；
  2. **Temp Management**: 临时产物（执行计划等）一律收敛至 `.temp/` 并及时清理；
  3. **Link Validity**: 确保所有引用的 URL 可访问且具备明确的上下文价值；
  4. **Testing**: 统一在 tests/ 下维护测试用例，区分单元测试（unit）和集成测试（integration），所有测试的本地运行总时间控制在 3 min 以内；
  5. **Issue**: 在 docs/issue.md 中维护你处理过的 Issue 摘要（问题描述、表因根因、处理方式、后续防范、同类问题影响与处理注意事项等），便于同类问题的跨上下文处理；注意识别相同 Issue，不要同 Issue 多处维护。
- **Package Management Standardization (包管理规范)**:
  1. **Python**: 严禁使用 pip/poetry，**必须**统一使用 `uv` 进行包管理与脚本执行（如 `uv run`）；
  2. **JavaScript/TypeScript**: 严禁使用 npm/yarn，**必须**统一使用 `pnpm` 进行包管理与脚本执行；
- **Database Management**: 谨慎操作，数据迁移、测试等操作严禁将现有数据删除，谨慎操作数据迁移的回滚，防止数据被清理。
- **Browser Validation Protocol (浏览器验证准则)**: 所有依赖登录态（Google OAuth / SSO / 内部凭证）的浏览器验证，**必须**统一使用 Chrome DevTools 协议（`mcp__chrome_devtools__*`）接入用户常用 Chrome 主 profile，**强制复用真实登录用户**——严禁在 sandbox / 空白 profile 浏览器中跳转 Google 同意屏，严禁以模拟用户身份代替真人登录态。详见 [浏览器验证协议](./docs/agents/browser-validation.md)。
  1. **唯一驱动**: `mcp__chrome_devtools__*`。macOS 默认配置下 `list_pages` / `navigate_page` 已能直连用户常用 Chrome 主 profile（含已登录 Google 账号）；连不通时由用户手动以 `--remote-debugging-port=9222` + 自有 `--user-data-dir` 启动 Chrome 后再次接入，禁止改用 sandbox 浏览器替代；
  2. **Playwright 边界**: `mcp__playwright__*` 仅限两类不依赖 Google OAuth 的 B 类场景：① 项目 E2E `setup` project 一次性人工登录后 `storageState` 复用、② 本地自签 `ne_sso` dev-cookie 注入。**禁止**用 `mcp__playwright__*` 启动新 Chromium 处理 Google OAuth / SSO 登录跳转；
  3. **禁止动作**: 严禁在 sandbox 浏览器中跳转 Google 同意屏；严禁以"模拟用户"或第三账号代替真实用户完成登录态验证；严禁要求用户在 chat 中粘贴密码、Cookie 或一次性验证码（违反 `user_privacy` 中的 SENSITIVE INFORMATION HANDLING）；
  4. **凭证守则**: storageState / cookies / userDataDir 等会话产物**仅落本地**，受 `.gitignore` 保护，禁止入库；
  5. **连通性自检**: 每次会话首次需要登录态浏览前，先按协议文档中的"两步自检"（驱动接入并复用真实登录态 + 项目 OAuth 链路打通）确认链路；
  6. **E2E 测试**: 项目 Playwright E2E 通过 `setup` project + `storageState` 复用**真实用户**一次性人工登录后的会话（`setup` 内浏览器由真人完成 OAuth，非模拟），配置见 [`apps/negentropy-ui/playwright.config.ts`](./apps/negentropy-ui/playwright.config.ts) 与 [`apps/negentropy-ui/tests/e2e/auth.setup.ts`](./apps/negentropy-ui/tests/e2e/auth.setup.ts)。

## Documentation Standards (文档规范)

### Mermaid Visualization Norms (Mermaid 可视化规范)

- **色彩语义与兼容性**：为图表节点配置具备语义辨识度的色彩，并确保在深色模式（Dark Mode）下具有极高的对比度与清晰度。
- **逻辑模块化解构**：针对业务跨度较大的架构流程，强制采用 `subgraph` 容器进行层级解构与边界划分，以增强图表的自解说（Self-explaining）能力。

### Reference Specifications (IEEE)

为保障工程决策的可追溯性与学术严谨性，核心引用需遵循 **IEEE 标准引用格式**。

> **模版准则**：[编号] 作者缩写. 姓, "文章标题," _刊名/会议名缩写 (斜体)_, 卷号, 期数, 页码, 年份.

```latex
[1] A. Author, B. Author, and C. Author, "Title of paper," *Abbrev. Title of Journal*, vol. X, no. Y, pp. XX–XX, Year.
```

**引用实践**

- **文内锚定**：采用标准上标链接形式：`描述内容<sup>[[1]](#ref1)</sup>`。
- **文献索引**：底层采用 HTML 锚点 `id` 实现跳转稳定性。

```latex
<a id="ref1"></a>[1] A. Vaswani et al., "Attention is all you need," Adv. Neural Inf. Process. Syst., vol. 30, pp. 5998–6008, 2017.
```

## Knowledge Map (知识索引)

(WIP)
