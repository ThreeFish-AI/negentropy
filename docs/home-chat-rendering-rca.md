# Home Chat 渲染缺陷根因分析与修复方案

> 本文档记录 Home 页"人与 Agent"对话交互界面反复复发的三类严重渲染缺陷（重复渲染、渲染不全、乱序显示）的完整 RCA，包括业界最佳实践调研、根因分析、修复方案与长期路线图。

## 1. 业界最佳实践调研

### 1.1 AG-UI Protocol

[AG-UI](https://docs.ag-ui.com/introduction) 是 CopilotKit 主导的开放协议，标准化 Agent 与前端之间的交互：

- **核心身份**：`threadId`（对话标识）+ `runId`（单次执行标识），均为 REQUIRED 字段
- **事件生命周期**：`TEXT_MESSAGE_START → TEXT_MESSAGE_CONTENT × N → TEXT_MESSAGE_END`，严格有序
- **流结束标记**：`RUN_FINISHED` / `RUN_ERROR`，明确的终止信号
- **单一事件流**：一个 run 对应一个连续的事件序列，无并发交织

**与本项目差距**：后端 ADK Web `/sessions/{id}/events` 不透传 `runId`（仅含 `invocation_id`），前端 hydration 层未将 `invocation_id` 映射为 AG-UI 的 `runId`，违反协议的单一身份源原则。

### 1.2 Vercel AI SDK 5

Vercel AI SDK 的核心设计：

- **UIMessage 为唯一事实源**：前端状态以 `UIMessage` 为 SSOT，不区分 realtime/hydration 两套身份
- **SSE 标准流**：使用 Server-Sent Events，每条消息携带稳定 ID
- **乐观更新**：用户消息先乐观渲染，服务端 ack 后以稳定 ID 替换临时 ID

**与本项目差距**：项目有 3 个消息 ID 来源（前端 `randomUUID()` / 后端 `assistant:runId:index` / hydration snapshot 自带 ID），需要 6 层启发式去重才能归并。

### 1.3 CopilotKit

CopilotKit 的关键实践：

- **后端 adapter 始终生成唯一 message ID**，防止下游 dedup 问题
- **thread-store 注册表**：`useThreads` hook + per-thread 检查端点
- **唯一 ID 防重**：`LangChain adapter always generates unique message IDs — prevents downstream deduplication issues`

**与本项目差距**：项目的消息 ID 按路径不同，需要 `isSemanticEquivalentEntry`（多层语义匹配）才能判定同一逻辑消息。

## 2. 根因分析

### 2.1 根因链

```
ADK session events 使用 invocation_id（非 AG-UI runId）
  → 前端 hydration fallbackRunId() 未识别 invocation_id
    → hydration 路径被迫合成 fallback runId（= threadId || sessionId）
      → realtime（真 runId）与 hydration（合成 runId）身份割裂
        → 三层 dedup 都需要 isSyntheticRunId() 容错识别
          → 容错逻辑有盲点 → ISSUE-041 双气泡复发
```

### 2.2 六层去重金字塔

| 层级 | 文件 | 方法 | 职责 | 盲点 |
|------|------|------|------|------|
| L1 | session-hydration.ts | eventKey + mergeEvents | 事件级去重 | localeCompare tiebreaker（已修） |
| L2 | session-hydration.ts | mergeEventsWithRealtimePriority | realtime/hydration 合并 | 参数方向与函数名不符 |
| L3 | message-ledger.ts | isSemanticEquivalentEntry | 消息身份匹配 | runId 合成 ID 识别不完整 |
| L4 | conversation-tree.ts | findMatchingTextNodeId | 节点级合并 | 同上 |
| L5 | conversation-tree.ts | collapseOverlappingTurns | turn 级折叠 | 双 concrete turn 拒绝折叠 |
| L6 | chat-display.ts | dedupeRedundantTextSegments + dedupeAdjacentAssistantBlocks | 文本/块级去重 | Jaccard/LCS 阈值边界 |

### 2.3 硬编码阈值分布

| 文件 | 阈值 | 值 |
|------|------|----|
| message-ledger.ts | 时间窗 / multiset 覆盖 / 长度比 | 8000ms / 0.85 / 1.1 |
| conversation-tree.ts | turn 折叠时间窗 / multiset 覆盖 | 120s / 0.75 |
| chat-display.ts | 时钟漂移 / Jaccard / LCS / 最小长度 / 跨块时间窗 | 0.2s / 0.5 / 0.65 / 30字 / 120s |

### 2.4 排序 tiebreaker 遗漏

ISSUE-042 修复了 `session-hydration.ts` 的 `localeCompare` tiebreaker（改用 `emitOrder`），但遗漏了：
- `message-ledger.ts:393`（同时间戳 TEXT_MESSAGE_* 乱序）
- `conversation-tree.ts:926`（同时间戳事件乱序）

## 3. 修复方案

### 3.1 Phase 1 — 本 PR 代码修复

| Fix | 文件 | 改动 |
|-----|------|------|
| Fix 1 | message-ledger.ts:386-394 | sort tiebreaker: `localeCompare` → `EVENT_TYPE_ORDER` 权重 |
| Fix 2 | conversation-tree.ts:923-927 | 同 Fix 1，补充遗漏的 localeCompare |
| Fix 3 | ChatStream.tsx:35-40 | `buildChatDisplayBlocks` 包裹 `useMemo` |
| Fix 4 | home-body.tsx | `activeRunIdRef` 并发隔离 + 事件过滤 |

### 3.2 Phase 2 — Hydration invocationId 映射（已通过 Phase 3 折叠规则联动落地）

`session-hydration.ts` 的 `fallbackRunId()` 已添加 `invocationId`（驼峰，ADK Web 实测命名）和 `invocation_id`（下划线，ADK 原生 Python 命名）到查找链：

```typescript
function fallbackRunId(payload: AdkEventPayload, sessionId: string): string {
  if (typeof payload.runId === "string" && payload.runId) return payload.runId;
  const raw = payload as Record<string, unknown>;
  if (typeof raw.invocationId === "string" && raw.invocationId) return raw.invocationId;
  if (typeof raw.invocation_id === "string" && raw.invocation_id) return raw.invocation_id;
  if (typeof payload.threadId === "string" && payload.threadId) return payload.threadId;
  return sessionId;
}
```

#### 2026-05-09 浏览器实测发现的障碍（已通过 Phase 3 折叠规则解决）

- ✅ **乱序根因消除**：每个 event 用独立 invocationId 后，timestamp 不再因 fallback 同 sessionId 而被覆盖
- ✅ **turn 分裂已解决**：Phase 3 PR-1 升级 `collapseOverlappingTurns` 后，同 user 回合内多个 concrete invocation-turn 可安全折叠

**Phase 3 折叠规则升级要点**：
1. `hasUserTextBoundaryBetween`：检查 keeper 与 candidate 时间窗之间是否有 user-text turn，有则拒绝折叠
2. `mergeChildrenIntoKeeper`：无 user-message 间隔时，按语义去重合并 children（text 前缀关系 + toolCallId 去重）
3. user turn 前置检查：keeper 含 user text 且前面已有 assistant turn 时，不合并（多轮对话保护）
4. 纯 assistant turn 保护：双方均为纯 assistant turn 时退回 `allCovered` 检查（D3 回归保护）

### 3.3 Phase 3 — 架构简化（RFC 0001）

- 6 层 → 3 层：事件层 dedup + 消息身份索引 + 显示折叠
- 阈值集中管理 `config/projection-thresholds.ts`
- **Thread → Turn → Item 数据模型**：以 user-message 为 turn 切分锚点，根治 invocationId-per-event 与单逻辑回合的概念错位
- 同步落地 Phase 2 invocationId 映射

## 4. ADK 2.0 升级评估

| 维度 | 结论 |
|------|------|
| 能否根治渲染缺陷 | **不能**（根因在前端映射层，非 ADK 版本问题） |
| ADK 2.0 状态 | 早期 alpha（2.0.0a1），破坏性变更：agent API / event model / session schema |
| 当前 ADK 版本 | >=1.28.1（已含 v1.25 invocation_id 透传修复 + v1.30 SSE ID 保持修复） |
| 升级风险 | 极高（全量 session 迁移 + agent 代码重构） |
| 推荐路径 | 保持当前 ADK 版本，修复前端 hydration 映射（1 处改动） |

## 5. 验证标准

### 5.1 浏览器实测清单

1. **单轮对话**：发送 "Ping"，验证单气泡，无重复
2. **长回复**：请求多段落回复，验证流式完整 + 刷新后 hydration 一致
3. **Thinking 开关**：开启后发送，验证推理内容正确展示
4. **快速连发**：连续发送两条，验证第二条中断第一条，无双气泡
5. **刷新恢复**：多轮后刷新，验证消息顺序正确、无重复/缺失
6. **Tool 调用**：触发工具调用场景，验证工具前后文本不重复

### 5.2 自动化回归

- 单元测试：`pnpm test --filter=negentropy-ui`
- E2E 测试：`pnpm exec playwright test home-chat --project=chromium`
- 回归断言：`.assistant-reply` 气泡 count 严格等于预期值

## 6. 历史问题追踪

| Issue | 日期 | 表因 | 根因 | 修复 |
|-------|------|------|------|------|
| ISSUE-031 | 2026-01-27 | 长回复双气泡 | partial/final messageId 漂移 + 8s 时间窗 | 时间窗跳过 + 节点复用 |
| ISSUE-036 | 2026-02-10 | 双轮 LLM 近重复 | Agent prompt 要求总结 → 双轮 text | Jaccard Layer 5 |
| ISSUE-039 | 2026-02-20 | 短文本盲区 + 刷新乱序 | Jaccard 30 字阈值 + localeCompare + 浮点 | LCS Layer 6 + multiset 调整 |
| ISSUE-040 | 2026-03-05 | 思考溢出 + 推理假阳性 | thought Part 直通 + STEP_FINISHED 识别失败 | thought 过滤 + eventKey 统一 |
| ISSUE-041 | 2026-04-30 | 跨 runId 双气泡 | hydration 合成 runId ≠ realtime | isSyntheticRunId + collapse 泛化 |
| ISSUE-042 | 2026-05-05 | sort tiebreaker 乱序 | localeCompare 破坏推入顺序 | emitOrder + insertionOrder |
| ISSUE-070 | 2026-05-07 | 空 reasoning 占位 | started+empty 被视为可见 | hasVisibleSegment 重定义 |
| ISSUE-071 | 2026-05-08 | 首个 token 前空白 | reasoning 流式初始无内容 | 三点脉冲占位 |
