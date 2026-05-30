# Routine Demo 预设

> 开箱即用的 Routine 示例场景，覆盖 Routine 子系统的全部核心能力。

## 概述

Routine Demo 预设是一组内置的预配置 Routine 模板，旨在让用户零门槛体验 Routine 的完整功能闭环。每个 Demo 精心设计以展示特定的核心特性组合，3 个 Demo 合起来正交覆盖 Routine 的全部能力。

**入口**：Interface → Routine → 「Demo 预设...」按钮

## 快速上手

1. 点击页面右上角的 **Demo 预设...** 按钮
2. 选择一个预设场景，查看其展示的功能特性
3. 填写 **Key**（自动生成，可修改）和 **Working Directory**（必填，指向项目根路径）
4. 点击 **Create Routine** → 创建后点击 **Start** 启动

## 预设目录

| # | 预设 | 类别 | 审批模式 | 命令门控 | 重点展示 |
|---|------|------|---------|---------|---------|
| 1 | 代码质量审计 | quality | `auto` | `ruff check` | 全自主迭代、Reflexion、LLM-as-Judge + Command Gate、no_progress 检测 |
| 2 | 测试用例增强 | testing | `every` | `pytest` | Human-in-the-Loop（每轮审批）、Command Gate（pytest）、session 连续性 |
| 3 | 文档完善 | documentation | `first` | 无 | 首次审批模式、纯 LLM 评审、Reflexion 跨迭代记忆 |

## 各预设详解

### Demo 1：代码质量审计（Code Quality Audit）

**场景**：对指定模块执行全面的代码质量审计，使用 ruff 扫描违规项并逐类自动修复。

**展示的核心功能**：
- **审批模式 `auto`**：创建后完全自主运行，无需人工干预。Engine 自行调度多轮 Claude Code 执行，每轮评估后决定是否继续迭代。
- **Command Gate**：以 `ruff check --select ALL` 退出码作为客观验证锚点。当 ruff 报告违规时，评估分数封顶 60，防止 LLM 评审被修复过程的"努力"而非"结果"误导。
- **Reflexion 跨迭代反思记忆**：每轮评估产出的 `reflection` 被注入下一轮的执行提示，驱动 Claude Code 针对性地改进修复策略。
- **LLM-as-Judge**：结构化评分（0-100）+ verdict 判定（pass / progressing / stalled / regressed）。
- **no_progress 停滞检测**：连续 3 轮无分数进展时自动终止，避免浪费 token。
- **max_iterations 护栏**：最多 15 轮迭代的硬上限。

**预期行为**：
1. 首轮迭代：Claude Code 扫描 ruff 违规，修复最高严重级别的问题
2. Command Gate 运行 `ruff check`，若仍存在违规则评分受限
3. 后续迭代：Reflexion 注入"上一轮修复了 X 类问题，剩余 Y 类"反馈，驱动针对性修复
4. 终止条件：ruff 零违规 + LLM 评分 ≥ 90 → `succeeded`；或达到护栏 → 对应终止原因

**建议 `cwd`**：指向一个包含 ruff 违规的 Python 项目根目录

---

### Demo 2：测试用例增强（Test Enhancement）

**场景**：为目标模块补充高质量单元测试，每轮执行前需人工审批确认安全性。

**展示的核心功能**：
- **审批模式 `every`**：每次迭代进入 `pending_approval` 状态，用户需在 Iteration Timeline 中手动 Approve 后才会执行。这是安全关键场景的推荐模式。
- **Command Gate**：以 `pytest -x -q` 作为测试正确性的客观验证。新增测试通过 + 既有测试不回归时，退出码为 0。
- **Session 连续性**：Claude Code 在迭代间保持 `claude_session_id`，后续迭代能看到前一轮生成的测试代码和策略，避免重复工作。
- **max_cost 成本护栏**：累计费用超过 $5 时自动终止。
- **Reflexion**：评估反馈驱动测试策略改进（如从"覆盖核心逻辑"迭代到"覆盖边界条件和异常路径"）。

**预期行为**：
1. 首轮迭代：`pending_approval` 状态 → 用户 Approve → Claude Code 分析模块并生成初始测试
2. Command Gate 运行 pytest，验证测试通过
3. LLM-as-Judge 评估测试覆盖度和质量，产出 reflection
4. 后续迭代：同样需要 Approve → Claude Code 基于 session 上下文 + Reflexion 补充更多测试
5. 终止条件：LLM 评分 ≥ 85 + pytest 通过 → `succeeded`

**建议 `cwd`**：指向一个测试覆盖不足的 Python 项目根目录

---

### Demo 3：文档完善（Documentation Enhancement）

**场景**：为目标模块生成或更新结构化技术文档，仅首次执行前需确认方向。

**展示的核心功能**：
- **审批模式 `first`**：仅首轮迭代需要人工审批（确认文档方向和范围正确），后续自动迭代。兼顾效率和质量把控。
- **纯 LLM-as-Judge**：不设 `verification_command`，完全依赖 AI 评审文档质量。这展示了 Routine 在无法用命令行工具客观验证的场景下的能力。
- **Reflexion 跨迭代记忆**：LLM 评审的 reflection 持续积累（"缺少 API 参考的参数说明"、"代码示例与当前签名不一致"等），驱动文档在迭代中逐步逼近高质量。
- **max_iterations 护栏**：最多 8 轮迭代，适合文档类任务的轻量级迭代。

**预期行为**：
1. 首轮迭代：`pending_approval` → 用户确认 → Claude Code 阅读模块源码并生成初版文档
2. 后续迭代：自动执行 → LLM 评审文档的准确性、完整性、格式规范性
3. Reflexion 注入反馈：如"API 参考缺少返回值说明"→ 下一轮针对性补充
4. 终止条件：LLM 评分 ≥ 85 → `succeeded`；或达到迭代上限

**建议 `cwd`**：指向一个文档缺失或过时的模块目录

---

## API 参考

### 获取预设列表

```bash
curl http://localhost:3192/routines/presets
```

响应示例：

```json
[
  {
    "preset_id": "code_quality_audit",
    "display_name": "Demo: 代码质量审计",
    "description": "全自动代码质量审计...",
    "category": "quality",
    "version": "1.0.0",
    "features_showcase": ["审批模式: auto — 全自主，无人干预", ...],
    "approval_mode": "auto",
    "has_verification_command": true
  }
]
```

### 从预设创建 Routine

```bash
curl -X POST http://localhost:3192/routines/from-preset \
  -H "Content-Type: application/json" \
  -d '{"preset_id": "code_quality_audit", "key": "my-audit-001", "cwd": "/path/to/project"}'
```

成功响应：`201` + 完整 Routine DTO（`status: "pending"`）。

## 扩展指引

新增预设只需在 `apps/negentropy/src/negentropy/agents/routine_presets/` 下创建新的 YAML 文件，无需修改任何代码。

YAML 必填字段：`preset_id`、`display_name`、`description`、`category`、`version`。

可选字段与 [RoutineCreateRequest](../../.agents/knowledge-map.md) 对齐：`title`、`goal`、`acceptance_criteria`、`verification_command`、`max_iterations`、`max_cost_usd`、`success_score_threshold`、`no_progress_patience`、`approval_mode`、`config`。

参考既有 YAML 文件（如 [code_quality_audit.yaml](../../../apps/negentropy/src/negentropy/agents/routine_presets/code_quality_audit.yaml)）的字段格式。

## 相关文档

- [Routine 系统架构](../039-the-routine-system.md) — 完整的设计与实现文档
- [Routine Agent 迭代模式调研](../../research/110-routine-agent-iteration.md) — Reflexion / Self-Refine / LATS 等理论基础
- [Skills 模板系统](./skills-templates.md) — 类似的模板导入模式（Skill 领域）
