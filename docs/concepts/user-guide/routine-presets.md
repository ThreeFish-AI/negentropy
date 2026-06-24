---
sidebar_position: 17
---
# Routine 预设模版

> 开箱即用的内置 Routine 场景模版，正交覆盖 Routine 子系统的全部核心能力。

## 概述

Routine 预设模版是一组内置的预配置 Routine 模板，让用户以最小输入（仅 `key` + 工作目录）一键创建一个生产可用的长周期自主任务。每个模版精心设计以体现一类典型工程范式与审批策略，合起来正交覆盖 Routine 的全部核心能力：Evaluator-Optimizer 闭环、Reflexion 反思记忆、LLM-as-Judge、Command Gate 客观锚点、审批门控与停止护栏。

**入口**：Interface → Routine → 右上角 **「Template」** 按钮 → **Routine Templates** 子页面（响应式卡片网格）。

## 快速上手

1. 在 Routine 页点击右上角 **Template** 按钮，进入 **Routine Templates** 子页面
2. 在卡片网格中浏览各模版的类别、审批模式、命令门控与能力标签
3. 在目标模版卡片上点击 **使用模板**，在弹出的创建对话框中填写 **Key**（自动生成，可修改）与 **Working Directory**（必填，指向项目根路径）
4. 点击 **Create Routine** → 自动跳转该 Routine 详情页，点击 **Start** 启动

## 模版目录

| # | 模版 | 类别 | 审批模式 | 命令门控 | 工程范式重点 |
|---|------|------|---------|---------|---------|
| 1 | 代码质量审计 | quality | `auto` | `ruff check` | 全自主迭代、Reflexion、LLM-as-Judge + Command Gate、no_progress 检测 |
| 2 | 测试覆盖增强 | testing | `every` | `pytest` | Human-in-the-Loop（每轮审批）、Command Gate（pytest）、会话连续性 |
| 3 | 技术文档生成 | documentation | `first` | 无 | 首次审批模式、纯 LLM 评审、Reflexion 跨迭代记忆 |
| 4 | 项目架构清减 | architecture | `first` | `ruff check` | 正交分解 + 工程熵减、plan 审批、Evaluator-Optimizer 闭环 |

## 各模版详解

### 1. 代码质量审计（Code Quality Audit）

**场景**：对指定模块执行全面的代码质量治理，使用 Ruff 全规则集扫描违规项并逐类最小化修复。

**核心能力**：
- **审批模式 `auto`**：创建后完全自主运行，无需人工干预。Engine 自主编排多轮 Claude Code 执行，每轮评估后决定是否继续迭代。
- **Command Gate**：以 `ruff check --select ALL` 退出码作为客观验证锚点。当 Ruff 报告违规时，评估分数封顶 60，防止 LLM 评审被修复过程的"努力"而非"结果"误导。
- **Reflexion 跨迭代反思记忆**：每轮评估产出的 `reflection` 被注入下一轮执行提示，驱动 Claude Code 针对性改进修复策略。
- **LLM-as-Judge**：结构化评分（0-100）+ verdict 判定（pass / progressing / stalled / regressed）。
- **停止护栏**：连续 3 轮无分数进展时自动终止（no_progress），最多 15 轮迭代硬上限（max_iterations），避免浪费 token。

**预期行为**：
1. 首轮迭代：Claude Code 扫描 Ruff 违规，修复最高严重级别的问题
2. Command Gate 运行 `ruff check`，若仍存在违规则评分受限
3. 后续迭代：Reflexion 注入"上一轮修复了 X 类问题，剩余 Y 类"反馈，驱动针对性修复
4. 终止条件：Ruff 零违规 + LLM 评分 ≥ 90 → `succeeded`；或达到护栏 → 对应终止原因

**建议 `cwd`**：指向一个包含 Ruff 违规的 Python 项目根目录

---

### 2. 测试覆盖增强（Test Enhancement）

**场景**：为目标模块补充高质量单元测试，每轮执行前需人工审批确认安全性。

**核心能力**：
- **审批模式 `every`**：每次迭代进入 `pending_approval` 状态，用户需在 Iteration Timeline 中手动 Approve 后才会执行。这是变更安全性要求高的场景的推荐模式。
- **Command Gate**：以 `pytest -x -q` 作为测试正确性的客观验证。新增测试通过 + 既有测试不回归时退出码为 0。
- **会话连续性**：Claude Code 在迭代间保持 `claude_session_id`，后续迭代能看到前一轮生成的测试代码与策略，避免重复工作。
- **成本护栏**：累计费用超过 $5 时自动终止（max_cost）。
- **Reflexion**：评估反馈驱动测试策略改进（如从"覆盖核心逻辑"迭代到"覆盖边界条件与异常路径"）。

**预期行为**：
1. 首轮迭代：`pending_approval` → 用户 Approve → Claude Code 分析模块并生成初始测试
2. Command Gate 运行 pytest，验证测试通过
3. LLM-as-Judge 评估测试覆盖度与质量，产出 reflection
4. 后续迭代：同样需 Approve → Claude Code 基于会话上下文 + Reflexion 补充更多测试
5. 终止条件：LLM 评分 ≥ 85 + pytest 通过 → `succeeded`

**建议 `cwd`**：指向一个测试覆盖不足的 Python 项目根目录

---

### 3. 技术文档生成（Documentation Enhancement）

**场景**：为目标模块生成或更新结构化技术文档，仅首次执行前需确认方向。

**核心能力**：
- **审批模式 `first`**：仅首轮迭代需人工审批（确认文档方向与范围正确），后续自动迭代，兼顾效率与质量把控。
- **纯 LLM-as-Judge**：不设 `verification_command`，完全依赖 AI 评审文档质量。这体现了 Routine 在无法用命令行工具客观验证的场景下的能力。
- **Reflexion 跨迭代记忆**：LLM 评审的 reflection 持续积累（"缺少 API 参考的参数说明"、"代码示例与当前签名不一致"等），驱动文档在迭代中逐步逼近高质量。
- **轻量迭代护栏**：最多 8 轮迭代，契合文档类任务的轻量级迭代节奏。

**预期行为**：
1. 首轮迭代：`pending_approval` → 用户确认 → Claude Code 阅读模块源码并生成初版文档
2. 后续迭代：自动执行 → LLM 评审文档的准确性、完整性、格式规范性
3. Reflexion 注入反馈：如"API 参考缺少返回值说明"→ 下一轮针对性补充
4. 终止条件：LLM 评分 ≥ 85 → `succeeded`；或达到迭代上限

**建议 `cwd`**：指向一个文档缺失或过时的模块目录

---

### 4. 项目架构清减（Preening Substrate）

**场景**：对目标项目执行正交分解与工程熵减——精简冗余、解耦职责、规范命名，在不破坏功能的前提下降低系统结构复杂度。

**核心能力**：
- **审批模式 `first` + plan 门控**：`config.permission_mode: plan` 使首轮以 plan 形式呈现重构方案，人工确认方向后才进入全自动推进，规避架构级误改风险。
- **调用 `/preening-substrate` 技能**：沿功能维度对模块、对象、函数、文件正交分解，精简死代码与过度抽象，并规范化命名以精确反映业务语义。
- **Command Gate**：以 `ruff check` 退出码作为客观锚点；验收要求现有测试无回归且代码行数净减 ≥ 5%。
- **高预算护栏**：较高的迭代（20 轮）与成本（$15）上限，匹配架构级重构的复杂度与探索深度。

**预期行为**：
1. 首轮迭代：`pending_approval` → 用户审批重构 plan → Claude Code 按 plan 执行首批解耦与清减
2. 后续迭代：自动执行 → Command Gate（Ruff）+ LLM-as-Judge 评估结构改善与回归风险，Reflexion 驱动结构演进
3. 终止条件：测试无回归 + 行数净减 ≥ 5% + LLM 评分 ≥ 85 → `succeeded`；或达到护栏

**建议 `cwd`**：指向一个存在冗余、职责纠缠或命名不规范的项目根目录

---

## API 参考

### 获取模版列表

合并端点，一次返回内置 YAML 预设（`source: "builtin"`，只读）与用户自建模板（`source: "user"`，可 CRUD）；可选 `?category=<类别>` 按类别过滤。

```bash
curl http://localhost:3192/routines/templates
```

响应示例（内置预设条目）：

```json
[
  {
    "id": "builtin:code_quality_audit",
    "source": "builtin",
    "key": "code_quality_audit",
    "display_name": "代码质量审计",
    "description": "面向目标模块的全自主代码质量治理...",
    "category": "quality",
    "version": "1.0.0",
    "features_showcase": ["全自主闭环 — auto 审批，Engine 自主编排多轮迭代", "..."],
    "goal": "...",
    "acceptance_criteria": "...",
    "approval_mode": "auto",
    "has_verification_command": true
  }
]
```

### 从模版创建 Routine

模版实例化统一走标准创建端点 `POST /routines`——前端 **Routine Templates** 页「使用模板 → Create Routine」即提交此请求：用户在抽屉中补齐 `cwd` 等必填字段，模版的 `goal`、`acceptance_criteria`、`approval_mode`、`config` 等经确认后整体提交。

```bash
curl -X POST http://localhost:3192/routines \
  -H "Content-Type: application/json" \
  -d '{"key": "code_quality_audit-001", "title": "代码质量审计", "goal": "...", "acceptance_criteria": "...", "cwd": "/path/to/project", "approval_mode": "auto"}'
```

成功响应：`201` + 完整 Routine DTO（`status: "pending"`）。

## 扩展指引

新增模版只需在 `apps/negentropy/src/negentropy/agents/routine_presets/` 下创建新的 YAML 文件，无需修改任何代码——加载器会在启动时扫描该目录并校验字段完整性、SemVer 与 approval_mode 合法性。

YAML 必填字段：`preset_id`、`display_name`、`description`、`category`、`version`、`goal`、`acceptance_criteria`。

可选字段与 [RoutineCreateRequest](../../.agents/knowledge-map.md) 对齐：`title`、`features_showcase`、`verification_command`、`max_iterations`、`max_cost_usd`、`success_score_threshold`、`no_progress_patience`、`approval_mode`、`config`。

参考既有 YAML 文件（如 [code_quality_audit.yaml](../../../apps/negentropy/src/negentropy/agents/routine_presets/code_quality_audit.yaml)）的字段格式。

## 相关文档

- [Routine 系统架构](../039-the-routine-system.md) — 完整的设计与实现文档
- [Routine Agent 迭代模式调研](../../research/110-routine-agent-iteration.md) — Reflexion / Self-Refine / LATS 等理论基础
- [Skills 模板系统](./skills-templates.md) — 类似的模板导入模式（Skill 领域）
