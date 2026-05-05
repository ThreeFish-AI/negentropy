# RFC 0001: Home Chat 会话架构重塑（Codex Turn 模型 + 去重抽象 + AG-UI 协议合规）

| 字段 | 值 |
|---|---|
| **状态** | Draft（待评审） |
| **作者** | Aurelius Huang (cm.huang@aftership.com) |
| **创建时间** | 2026-04-29 |
| **关联 Issue** | ISSUE-031, 036, 039, 040, 041 |
| **依赖 PR** | [#435 ISSUE-041 hotfix](https://github.com/ThreeFish-AI/negentropy/pull/435) |
| **目标实施阶段** | Phase 3（在 Phase 2 后端 runId 透传完成后启动） |

---

## 1. 背景与动机

### 1.1 现状问题
Home 页 user↔Agent 交互链路在过去 4 个月发生 **5 次双气泡或同类型 UI 退化**（[ISSUE-031/036/039/040/041](../issue.md)），每次都通过 dedup 层"贴膏药"修复，导致：

- **6 层 dedup 金字塔**（eventKey + mergeEvents + mergeEventsWithRealtimePriority + isSemanticEquivalentEntry + collapseDefaultTurnDuplicates + dedupeRedundantTextSegments）— 每层独立 heuristic，假设冲突时 bug 级联。
- **3 处时间窗硬编码**（8000ms / 1000ms / 5-pass 稳态）— 边界 fragile，长回复 / 短回复 / 慢网络都会暴露盲区。
- **4 处合成 ID fallback**（DEFAULT_THREAD_ID / DEFAULT_RUN_ID / `runId === threadId` / synthetic messageId）— 跨源碰撞不识别（ISSUE-041 即典型）。
- **协议违规**：AG-UI 协议要求 `(threadId, runId, messageId)` 复合身份，但后端 `/sessions/{id}` 不透传 runId，前端被迫合成 fallback。

### 1.2 行业最佳实践（循证调研）

| 项目 | 数据模型 | Dedup 位置 | Refresh 语义 |
|---|---|---|---|
| OpenAI Codex | Thread → Turn → Item（不可变） | 服务端（CLI 幂等） | resumeThread(id)，CLI = SSOT |
| OpenClaw | Gateway-owned session state | 服务端 | 显式 chat.history fetch |
| Hermes Agent | SQLite + FTS5 server state | 服务端 | session lineage 跨 compression |
| **AG-UI 协议** | TEXT_MESSAGE_* / TOOL_CALL_* / lifecycle | 客户端用 (threadId, runId, messageId) 复合键 | MESSAGES_SNAPSHOT 整体替换 |

**共同结论**：成熟项目都把 dedup 放在**服务端**，客户端只负责渲染。我们当前在 client 做 6 层 dedup 是反模式。

### 1.3 本 RFC 的目标

1. **数据模型对齐 Codex**：从松散 `ConversationNode/ChatDisplayBlock` 树迁移到类型安全的 `Thread → Turn → Item` 不可变结构
2. **去重金字塔精简**（6 层 → 3 层）：消除冗余路径，每层职责清晰
3. **抽象提取**：3 个 util 模块复用通用模式（dedup / semantic-match / id-resolution）
4. **阈值集中**：单一 `config/projection-thresholds.ts` registry，测试可 override
5. **投影缓存**：useMemo + 哈希依赖，大 session 性能 ↑5-10x
6. **协议合规**：所有事件含 `(threadId, runId, messageId)` 三元组（依赖 Phase 2 后端透传）

---

## 2. 目标架构

### 2.1 类型化数据模型（Codex 风格）

```typescript
// types/conversation.ts (新文件)

export type ItemBase = {
  id: string;             // 全局唯一
  turnId: string;         // 归属 turn
  timestamp: number;
  sourceOrder: number;    // 稳定 tiebreaker
};

export type ReasoningItem = ItemBase & {
  type: "reasoning";
  phase: "started" | "finished";
  title?: string;
  summary?: string;
  stepId?: string;
};

export type ToolCallItem = ItemBase & {
  type: "tool_call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "succeeded" | "failed";
  result?: unknown;
  errorMessage?: string;
};

export type TextItem = ItemBase & {
  type: "text";
  role: "assistant" | "developer";
  content: string;        // 累积内容
  streaming: boolean;
  author?: string;
};

export type SubAgentTransferItem = ItemBase & {
  type: "subagent_transfer";
  fromAgent: string;
  toAgent: string;
  childTurnId?: string;   // 嵌套 turn
};

export type ErrorItem = ItemBase & {
  type: "error";
  code?: string;
  message: string;
  recoverable: boolean;
};

export type Item =
  | ReasoningItem
  | ToolCallItem
  | TextItem
  | SubAgentTransferItem
  | ErrorItem;

export type Turn = {
  id: string;             // = runId（真实，非合成）
  threadId: string;
  status: "streaming" | "finished" | "blocked" | "error";
  userMessage: { id: string; content: string; createdAt: Date };
  items: Item[];          // 有序、不可变
  startedAt: Date;
  finishedAt?: Date;
  pendingConfirmationCount: number;
};

export type Conversation = {
  threadId: string;
  turns: Turn[];          // 不可变历史，按时间序
  status: "idle" | "streaming" | "blocked" | "error";
};
```

### 2.2 三层去重（替代当前 6 层）

| 新层 | 作用 | 替代旧层 |
|---|---|---|
| **A. 事件层 dedup** | `eventKey()` 复合键 + `insertionOrder` 稳定排序 | 当前 L1+L2（eventKey + mergeEvents） |
| **B. 消息身份索引** | 唯一 `(threadId, runId, messageId)` 索引；不再依赖时间窗 + Jaccard | 当前 L3+L4（mergeEventsWithRealtimePriority + isSemanticEquivalentEntry） |
| **C. 显示折叠（保留 fallback）** | 仅做"同 turn 内 LLM 双轮幻觉"的近似文本折叠（Jaccard），其余在 B 层已收敛 | 当前 L5+L6（collapseDefaultTurnDuplicates + dedupeRedundantTextSegments） |

**前提**：Phase 2 后端透传 runId 后，B 层不再需要"合成 runId 兼容"逻辑。Phase 1 的 `isSyntheticRunId` 兜底保留作为 defense-in-depth，但不在主路径。

### 2.3 抽象提取（utils/dedup/）

```typescript
// utils/dedup/event-merge.ts
export function mergeByKeyWithTiebreaker<T>(
  base: T[],
  incoming: T[],
  getKey: (item: T) => string,
  getTiebreaker: (item: T) => [number, string],
): T[];

// utils/dedup/semantic-match.ts
export function computeBigramJaccard(a: string, b: string): number;
export function semanticEquivalent(a: string, b: string, opts: {
  exactMatch?: boolean;
  prefixMatch?: boolean;
  minLength?: number;
  minJaccard?: number;
}): boolean;

// utils/dedup/id-resolution.ts
export function isSyntheticRunId(entry: { runId?: string; threadId?: string }): boolean;
export function resolveCanonicalRunId(event: BaseEvent, context: { realtimeRunIds: Set<string> }): string;
```

### 2.4 阈值集中（config/projection-thresholds.ts）

```typescript
export const DEFAULT_THRESHOLDS = {
  MESSAGE_DEDUP_WINDOW_MS: 8_000,
  SHORT_TEXT_CHAR_THRESHOLD: 30,
  JACCARD_MIN_LONG: 0.5,
  SEGMENT_DEDUP_WINDOW_MS: 1_000,
  HYDRATION_RETRY_DELAYS: [0, 400, 1200, 2600, 5000, 8000, 12000],
  TURN_TIME_WINDOW_S: 30,
} as const;

let activeThresholds = DEFAULT_THRESHOLDS;
export function getThresholds() { return activeThresholds; }

// 测试期 override
export function setThresholdsForTest(overrides: Partial<typeof DEFAULT_THRESHOLDS>) {
  activeThresholds = { ...DEFAULT_THRESHOLDS, ...overrides };
}
export function resetThresholdsForTest() {
  activeThresholds = DEFAULT_THRESHOLDS;
}
```

### 2.5 投影缓存

```typescript
// 当前：每次 rawEvents 变更都重建 conversationTree（O(N²)）
// 目标：useMemo + hash dependency，大 session 性能 ↑5-10x

const conversation = useMemo(
  () => buildConversation({ events: rawEvents, ledger: messageLedger }),
  [hashEvents(rawEvents), hashLedger(messageLedger), optimisticMessages.length],
);
```

---

## 3. 迁移路线图（多 PR 渐进）

| Sub-PR | 内容 | 影响范围 | 复杂度 |
|---|---|---|---|
| 3.1 | 新增 `utils/dedup/` 三模块（不替换旧逻辑，并行存在） | 隔离 | 低 |
| 3.2 | 新增 `config/projection-thresholds.ts` registry，三个时间窗常量切换为读 registry | 配置 | 低 |
| 3.3 | 新增 `types/conversation.ts` Codex 风格类型定义；旧 ConversationNode 与新 Turn 并行 | 类型 | 中 |
| 3.4 | 新增 `utils/build-conversation.ts`：从 events + ledger 构造 `Conversation`；不替换 buildConversationTree | 投影 | 中 |
| 3.5 | 新增 `<TurnBubble>` 组件：以 `Turn` props 渲染；与 `<AssistantReplyBubble>` 并行 | 组件 | 中 |
| 3.6 | `<ChatStream>` 接收 `Conversation` 并渲染 `<TurnBubble>`，旧路径降级为 fallback | 渲染 | 中 |
| 3.7 | 移除旧 ConversationNode → ChatDisplayBlock 路径；移除冗余 dedup 层 | 清理 | 高 |
| 3.8 | 投影缓存（useMemo + hash） | 性能 | 中 |

每个 sub-PR 独立合并，回归测试覆盖。

---

## 4. 兼容性与回归

### 4.1 向后兼容
- 旧 `ConversationNode` / `ChatDisplayBlock` 类型暂保留至 Sub-PR 3.7，期间新旧路径并行，由 feature flag 切换
- A2UI 自定义事件（`ne.a2ui.thought` / `ne.a2ui.link`）保持 CUSTOM 包裹格式，兼容 ISSUE-040 H1 处理

### 4.2 回归覆盖
- 沿用 Phase 1 的 16 例（保证 ISSUE-041 不退化）
- 新增 G 系列（10+ 例）：
  - G1-3：mergeByKeyWithTiebreaker 通用复用
  - G4-6：semanticEquivalent 各阈值边界
  - G7-9：Turn 模型构造（1-item / 多 item / sub-agent transfer 嵌套）
  - G10：投影缓存引用稳定性

### 4.3 性能基线
- 当前：500 events 的 buildConversationTree 耗时约 50-80ms（每次 rawEvents 变更）
- 目标：useMemo 缓存命中时 < 1ms；新建场景 ≤ 当前基线

---

## 5. 风险评估

| 风险 | 等级 | 缓解 |
|---|---|---|
| 旧路径降级期间双投影占用内存 | 低 | feature flag 默认关，灰度后切换 |
| Turn 类型迁移漏字段 | 中 | TS 类型保护 + 端到端 fixture 测试 |
| 缓存哈希冲突 | 低 | 用稳定哈希算法（如 SHA-1 of canonical JSON） |
| Phase 2 未完成时 Turn.id = runId 仍受合成影响 | 中 | Phase 1 的 `isSyntheticRunId` 兜底保留 |

---

## 6. 评审要点

请评审者重点关注：
1. **数据模型边界**：Item 联合类型是否覆盖所有真实场景？是否需要 `WebSearchItem` / `FileChangeItem` 等扩展？
2. **去重职责**：B 层依赖后端 runId 透传，Phase 2 是否真的能让 runId 100% 出现？hydration 历史数据是否仍需 fallback？
3. **缓存粒度**：useMemo 在 turn 数 > 50 时仍能保持性能吗？是否需要 virtual scrolling？
4. **迁移成本**：8 个 sub-PR 是否合理？是否可以并行？
5. **A2UI 兼容**：reasoning panel 等 Phase 4 增强是否能在 Turn 模型上自然实现？

---

## 7. 决议（评审后填）

- [ ] 评审通过
- [ ] 开始 Sub-PR 3.1
- [ ] 灰度切换计划：
- [ ] 完成下线 ConversationNode 时间表：
