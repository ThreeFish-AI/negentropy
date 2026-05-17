import { EventType, type BaseEvent, type Message } from "@ag-ui/core";
import {
  createAgUiMessage,
  getEventAuthor,
  getEventDelta,
  getEventMessageId,
  getEventRole,
  getEventRunId,
  getEventThreadId,
  getEventToolCallId,
  getMessageAuthor,
  getMessageCreatedAt,
  getMessageRunId,
  getMessageStreaming,
  getMessageThreadId,
  type CanonicalMessageRole,
} from "@negentropy/agents-chat-core/protocol";
import type { MessageLedgerEntry } from "@/types/common";
import {
  accumulateTextContent,
  getMessageIdentityKey,
  isEquivalentMessageContent,
  multisetCoverage,
  normalizeMessageContent,
} from "@/utils/message";
import { resolveMessageRole, shouldReplaceResolvedRole } from "@/utils/message-role-resolver";

type SnapshotMessage = {
  id: string;
  threadId: string;
  runId?: string;
  content: string;
  createdAt: Date;
  author?: string;
  resolvedRole: CanonicalMessageRole;
};

const DEFAULT_THREAD_ID = "default";
const DEFAULT_RUN_ID = "default-run";

// ISSUE-041: 后端 ADK Web `/sessions/{id}` 不透传 runId 时，前端
// `session-hydration.ts::fallbackRunId` 会回退到 threadId 或 sessionId，导致
// 同一逻辑消息在 realtime（真 runId）与 hydrated（合成 runId）两路下身份割裂，
// 进而在 conversation-tree 产出两个独立 turn → UI 双气泡。
// 下游 dedup / fallback / collapse 必须借助本辅助识别合成 runId，将其视为
// runId 维度上的"无身份"占位符，允许与真 runId 兼并。
export function isSyntheticRunId(entry: { runId?: string; threadId?: string }): boolean {
  if (!entry.runId) return true;
  if (entry.runId === DEFAULT_RUN_ID) return true;
  if (entry.runId === "default") return true;
  return Boolean(entry.threadId) && entry.runId === entry.threadId;
}

function getLedgerIdentityKey(entry: Pick<MessageLedgerEntry, "id" | "threadId" | "runId">): string {
  return `${entry.threadId}|${entry.runId || DEFAULT_RUN_ID}|${entry.id}`;
}

export function isSemanticEquivalentEntry(
  left: Pick<
    MessageLedgerEntry,
    | "threadId"
    | "runId"
    | "resolvedRole"
    | "content"
    | "createdAt"
    | "streaming"
    | "origin"
    | "lifecycle"
  >,
  right: Pick<
    MessageLedgerEntry,
    | "threadId"
    | "runId"
    | "resolvedRole"
    | "content"
    | "createdAt"
    | "streaming"
    | "origin"
    | "lifecycle"
  >,
): boolean {
  if (left.threadId !== right.threadId) {
    return false;
  }
  const leftRun = left.runId || DEFAULT_RUN_ID;
  const rightRun = right.runId || DEFAULT_RUN_ID;
  if (leftRun !== rightRun) {
    // ISSUE-041: 当一侧来自 hydration 的合成 runId（runId === threadId 或
    // 等同 DEFAULT_RUN_ID），不应阻断与 realtime 真 runId 的语义合并。
    // threadId + role + 内容前缀 + origin 多元 已构成充分身份约束。
    const leftIsSynthetic = isSyntheticRunId({ runId: left.runId, threadId: left.threadId });
    const rightIsSynthetic = isSyntheticRunId({ runId: right.runId, threadId: right.threadId });
    if (!leftIsSynthetic && !rightIsSynthetic) {
      return false;
    }
  }
  if (left.resolvedRole !== right.resolvedRole) {
    return false;
  }
  if (left.resolvedRole !== "assistant" && left.resolvedRole !== "developer") {
    return false;
  }
  const origins = new Set([left.origin, right.origin]);
  const hasRealtime = origins.has("realtime");
  const hasHistorical = origins.has("snapshot") || origins.has("fallback");
  if (!hasRealtime || !hasHistorical) {
    return false;
  }

  const leftContent = left.content.trim();
  const rightContent = right.content.trim();
  if (!leftContent || !rightContent) {
    return false;
  }
  // ISSUE-060 根因层：放宽严格前缀检查为"前缀 ∨ 高门槛 multiset 互含"。
  //
  // 旧实现要求 left/right 必须互为前缀，但 LLM 流式 chunk 与 final hydration
  // 在以下两种主路径下会**字符级不一致**却同源：
  // 1. 流式 chunk 拼接：markdown 流式 partial 渲染产物为残缺中间态（"机器校"），
  //    final hydration 拉到完整版（"机器校验"）；
  // 2. LLM 双轮自我修订：第一遍输出后 reasoning 阶段重写答复，前缀关系断裂。
  //
  // 二次判据采用 ``multisetCoverage`` 单向覆盖（较短方字符在较长方中有 ≥0.85
  // 频次匹配 + 长度比 ≥ 1.1）。0.85 比 ``chat-display.ts`` 的 UI 层兜底 0.8 更严，
  // 因为这里命中后会**真正合并 ledger entry**（影响下游 conversation-tree
  // 节点匹配 + chat 渲染），需要更高置信度；UI 层 0.8 仍作为最后防线。
  const STREAMING_PREFIX_FALLBACK_COVERAGE = 0.85;
  const STREAMING_PREFIX_FALLBACK_LENGTH_RATIO = 1.1;
  const leftHasPrefix =
    leftContent.startsWith(rightContent) || rightContent.startsWith(leftContent);
  let multisetCoverageHit = false;
  if (!leftHasPrefix) {
    const shorter = leftContent.length <= rightContent.length ? leftContent : rightContent;
    const longer = shorter === leftContent ? rightContent : leftContent;
    if (longer.length < shorter.length * STREAMING_PREFIX_FALLBACK_LENGTH_RATIO) {
      return false;
    }
    if (multisetCoverage(shorter, longer) < STREAMING_PREFIX_FALLBACK_COVERAGE) {
      return false;
    }
    multisetCoverageHit = true;
    // 兜底命中：继续向下走 lifecycle / streaming / origin 检查（不 short-circuit
    // return true，避免误合并独立消息）。
  }

  const maxWindowMs = 8_000;
  // 长耗时回复（如多段落 / 列表型答复）下，realtime 取首个 partial 时间戳、
  // hydration 取终态时间戳，两者跨度可能大于 8s。当 trim 后内容严格相等且
  // threadId+runId+role 已收敛时，可视为同一逻辑消息，跳过时间窗硬拒绝。
  // ISSUE-060：multiset 兜底命中（同源残缺版 + final 改写版）的时间跨度也可能
  // 远大于 8s（LLM 长回复 + hydration 延迟），同样跳过时间窗硬拒绝。
  const strictlyEqualContent = leftContent === rightContent;
  if (
    !strictlyEqualContent &&
    !multisetCoverageHit &&
    Math.abs(left.createdAt.getTime() - right.createdAt.getTime()) > maxWindowMs
  ) {
    return false;
  }

  if (
    left.lifecycle === "closed" &&
    right.lifecycle === "closed" &&
    left.origin !== "realtime" &&
    right.origin !== "realtime"
  ) {
    return false;
  }

  const realtimeEntry = left.origin === "realtime" ? left : right;
  const historicalEntry = realtimeEntry === left ? right : left;
  const realtimeContent = realtimeEntry.content.trim();
  const historicalContent = historicalEntry.content.trim();
  // ISSUE-060：``historicalCompletesClosedRealtime`` 的前缀检查同样需要放宽到
  // multiset 覆盖。否则即使前面的二次判据让函数继续往下走，本判定仍会因前缀关系
  // 不成立而把"realtime closed + historical 完整改写版"误判为 false。
  const historicalCoversRealtime =
    historicalContent.length > realtimeContent.length &&
    multisetCoverage(realtimeContent, historicalContent) >= STREAMING_PREFIX_FALLBACK_COVERAGE;
  const historicalCompletesClosedRealtime =
    realtimeEntry.lifecycle === "closed" &&
    historicalEntry.lifecycle === "closed" &&
    historicalEntry.streaming === false &&
    historicalContent.length > realtimeContent.length &&
    (historicalContent.startsWith(realtimeContent) || historicalCoversRealtime);
  if (
    realtimeEntry.lifecycle === "closed" &&
    historicalContent !== realtimeContent &&
    !historicalCompletesClosedRealtime
  ) {
    return false;
  }

  if (
    !left.streaming &&
    !right.streaming &&
    leftContent !== rightContent &&
    !historicalCompletesClosedRealtime
  ) {
    return false;
  }

  // 最终判据：当两段内容已通过前缀 / multiset 覆盖 + lifecycle / streaming 全部
  // 检查后，仍要求 ``isEquivalentMessageContent`` 的语义近似（containment 或
  // word-jaccard）作为最终守卫。但若 multiset 覆盖兜底路径成立（非前缀但高度
  // 互含），``isEquivalentMessageContent`` 可能因不要求严格前缀而漏判 → 此时
  // 直接接受为同源。
  if (!leftHasPrefix && historicalCoversRealtime) {
    return true;
  }
  return isEquivalentMessageContent(leftContent, rightContent);
}

function findSemanticLedgerKey(
  entries: Map<string, MessageLedgerEntry>,
  candidate: Pick<
    MessageLedgerEntry,
    | "threadId"
    | "runId"
    | "resolvedRole"
    | "content"
    | "createdAt"
    | "streaming"
    | "origin"
    | "lifecycle"
  >,
): string | null {
  for (const [key, entry] of entries.entries()) {
    if (isSemanticEquivalentEntry(entry, candidate)) {
      return key;
    }
  }
  return null;
}

function normalizeTimestamp(value: unknown): Date {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }
  return new Date();
}

function extractSnapshotMessages(events: BaseEvent[]): SnapshotMessage[] {
  return events.flatMap((event) => {
    if (event.type !== EventType.MESSAGES_SNAPSHOT) {
      return [];
    }
    const messages =
      "messages" in event && Array.isArray(event.messages) ? event.messages : [];
    return messages.flatMap((message, index) => {
      if (typeof message !== "object" || message === null) {
        return [];
      }
      const record = message as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : undefined;
      if (!id) {
        return [];
      }
      const content =
        typeof record.content === "string"
          ? record.content
          : Array.isArray(record.content)
            ? record.content
                .map((part) =>
                  typeof part === "string" ? part : JSON.stringify(part),
                )
                .join("")
            : record.content
              ? JSON.stringify(record.content)
              : "";
      const normalizedContent = content.trim();
      if (!normalizedContent) {
        return [];
      }
      const resolved = resolveMessageRole({
        snapshotRole:
          typeof record.role === "string" ? record.role : undefined,
        author:
          typeof record.author === "string" ? record.author : undefined,
      });
      const fallbackTimestamp =
        typeof event.timestamp === "number" ? event.timestamp + index * 0.0001 : Date.now() / 1000;
      const createdAt =
        typeof record.createdAt === "string" || record.createdAt instanceof Date
          ? new Date(record.createdAt)
          : typeof record.timestamp === "number"
            ? new Date(record.timestamp * 1000)
            : new Date(fallbackTimestamp * 1000);

      return [
        {
          id,
          threadId:
            typeof record.threadId === "string" && record.threadId.trim()
              ? record.threadId
              : getEventThreadId(event) || DEFAULT_THREAD_ID,
          runId:
            typeof record.runId === "string" && record.runId.trim()
              ? record.runId
              : getEventRunId(event),
          content: normalizedContent,
          createdAt,
          author:
            typeof record.author === "string" ? record.author : undefined,
          resolvedRole: resolved.resolvedRole,
        },
      ];
    });
  });
}

export function buildMessageLedger(input: {
  events: BaseEvent[];
  fallbackMessages?: Message[];
}): MessageLedgerEntry[] {
  const { events, fallbackMessages = [] } = input;
  const entries = new Map<string, MessageLedgerEntry>();
  const snapshotMessages = extractSnapshotMessages(events);
  const snapshotMessageById = new Map(
    snapshotMessages.map((message) => [message.id, message] as const),
  );

  const upsertEntry = (
    key: string,
    next: Omit<
      MessageLedgerEntry,
      "sourceEventTypes" | "relatedMessageIds" | "sourceOrder"
    > & {
      sourceEventTypes?: string[];
      relatedMessageIds?: string[];
      sourceOrder?: number;
    },
  ) => {
    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, {
        ...next,
        content: next.content,
        sourceEventTypes: next.sourceEventTypes || [],
        relatedMessageIds: next.relatedMessageIds || [],
        sourceOrder:
          next.sourceOrder !== undefined && Number.isFinite(next.sourceOrder)
            ? next.sourceOrder
            : Number.MAX_SAFE_INTEGER,
      });
      return;
    }

    if (shouldReplaceResolvedRole(existing.resolutionSource, next.resolutionSource)) {
      existing.resolvedRole = next.resolvedRole;
      existing.resolutionSource = next.resolutionSource;
    }
    if (next.content.length > existing.content.length) {
      existing.content = next.content;
    }
    if (next.createdAt.getTime() < existing.createdAt.getTime()) {
      existing.createdAt = next.createdAt;
    }
    existing.threadId = existing.threadId || next.threadId;
    existing.runId = existing.runId || next.runId;
    existing.author = existing.author || next.author;
    existing.streaming = existing.streaming && next.streaming;
    existing.lifecycle =
      existing.lifecycle === "closed" || next.lifecycle === "closed" ? "closed" : "open";
    if (existing.origin !== next.origin && next.origin !== "realtime") {
      existing.origin = next.origin;
    }
    if (next.sourceOrder !== undefined && Number.isFinite(next.sourceOrder)) {
      const existingOrder = existing.sourceOrder ?? Number.MAX_SAFE_INTEGER;
      if (next.sourceOrder < existingOrder) {
        existing.sourceOrder = next.sourceOrder;
      }
    }
    (next.sourceEventTypes || []).forEach((eventType) => {
      if (!existing.sourceEventTypes.includes(eventType)) {
        existing.sourceEventTypes.push(eventType);
      }
    });
    (next.relatedMessageIds || []).forEach((messageId) => {
      if (!existing.relatedMessageIds.includes(messageId)) {
        existing.relatedMessageIds.push(messageId);
      }
    });
  };

  // ISSUE-042 补丁：message-ledger 的 sort tiebreaker 曾用 localeCompare
  // （TEXT_MESSAGE_CONTENT(C) < TEXT_MESSAGE_END(E) < TEXT_MESSAGE_START(S)），
  // 导致同时间戳下 CONTENT 在 START 之前被处理，破坏消息生命周期顺序。
  // session-hydration.ts 已改用 emitOrder，但此处遗漏。
  // 修复：用事件类型权重保证 START→CONTENT→END→TOOL_* 的正确顺序。
  const EVENT_TYPE_ORDER: Record<string, number> = {
    [EventType.TEXT_MESSAGE_START]: 0,
    [EventType.TEXT_MESSAGE_CONTENT]: 1,
    [EventType.TEXT_MESSAGE_END]: 2,
    [EventType.TOOL_CALL_START]: 3,
    [EventType.TOOL_CALL_ARGS]: 4,
    [EventType.TOOL_CALL_END]: 5,
  };
  const orderedEvents = [...events].sort((a, b) => {
    const timeDiff =
      (typeof a.timestamp === "number" ? a.timestamp : 0) -
      (typeof b.timestamp === "number" ? b.timestamp : 0);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const aOrder = EVENT_TYPE_ORDER[String(a.type)] ?? 50;
    const bOrder = EVENT_TYPE_ORDER[String(b.type)] ?? 50;
    return aOrder - bOrder;
  });

  orderedEvents.forEach((event, eventIndex) => {
    if (
      event.type !== EventType.TEXT_MESSAGE_START &&
      event.type !== EventType.TEXT_MESSAGE_CONTENT &&
      event.type !== EventType.TEXT_MESSAGE_END
    ) {
      return;
    }

    const messageId = getEventMessageId(event);
    if (!messageId) {
      return;
    }

    const threadId = getEventThreadId(event) || DEFAULT_THREAD_ID;
    const runId = getEventRunId(event);
    const key = `${threadId}|${runId || DEFAULT_RUN_ID}|${messageId}`;
    const existing = entries.get(key);
    const snapshotMessage = snapshotMessageById.get(messageId);
    const resolved = snapshotMessage
      ? {
          resolvedRole: snapshotMessage.resolvedRole,
          resolutionSource: "snapshot_role" as const,
        }
      : resolveMessageRole({
          explicitRole: getEventRole(event),
          author: getEventAuthor(event),
          hasToolCall: !!getEventToolCallId(event),
        });
    const nextContent =
      event.type === EventType.TEXT_MESSAGE_CONTENT
        ? accumulateTextContent(existing?.content || "", String(getEventDelta(event) || ""))
        : existing?.content || "";

    upsertEntry(key, {
      id: messageId,
      threadId,
      runId,
      resolvedRole: resolved.resolvedRole,
      resolutionSource: resolved.resolutionSource,
      content: nextContent,
      createdAt: normalizeTimestamp(event.timestamp),
      streaming: event.type !== EventType.TEXT_MESSAGE_END,
      lifecycle: event.type === EventType.TEXT_MESSAGE_END ? "closed" : "open",
      origin: "realtime",
      author: getEventAuthor(event),
      sourceEventTypes: [String(event.type)],
      relatedMessageIds: [messageId],
      sourceOrder: eventIndex,
    });
  });

  [
    ...fallbackMessages,
    ...snapshotMessages.map(
      (message) =>
        ({
          id: message.id,
          role: message.resolvedRole,
          content: message.content,
          createdAt: message.createdAt,
          runId: message.runId,
          threadId: message.threadId,
          author: message.author,
        }) as Message,
    ),
  ].forEach((message, fallbackIndex) => {
    const key = getMessageIdentityKey(message);
    const resolved = resolveMessageRole({
      explicitRole: typeof message.role === "string" ? message.role : undefined,
      author: getMessageAuthor(message),
    });
    upsertEntry(key, {
      id: message.id,
      threadId: getMessageThreadId(message) || DEFAULT_THREAD_ID,
      runId: getMessageRunId(message),
      resolvedRole: resolved.resolvedRole,
      resolutionSource: resolved.resolutionSource,
      content: normalizeMessageContent(message),
      createdAt: getMessageCreatedAt(message) || new Date(),
      streaming: getMessageStreaming(message) === true,
      lifecycle: getMessageStreaming(message) === true ? "open" : "closed",
      origin: snapshotMessageById.has(message.id) ? "snapshot" : "fallback",
      author: getMessageAuthor(message),
      sourceEventTypes: [snapshotMessageById.has(message.id) ? String(EventType.MESSAGES_SNAPSHOT) : "fallback.message"],
      relatedMessageIds: [message.id],
      // 事件序之后追加 fallback / snapshot，保留 origin 间稳定相对序。
      sourceOrder: orderedEvents.length + fallbackIndex,
    });
  });

  return [...entries.values()]
    .filter((entry) => entry.content.trim().length > 0)
    .sort(compareLedgerEntriesByTime);
}

// ISSUE-070：角色优先级 —— 同时间戳时 user 必排在 assistant / developer / tool
// 之前。修复刷新后用户消息漂移到 assistant 回复之后的乱序问题。原因：
// 1. realtime 路径 user 消息时间戳取自 send 时刻（client clock），assistant
//    首个 TEXT_MESSAGE_START 时间戳取自服务端 RUN_STARTED（server clock），
//    时钟漂移可能让 user 落后于 assistant 几毫秒；
// 2. hydration 路径两类消息时间戳分别来自不同表 column（messages.created_at
//    vs runs.started_at），毫秒级抖动同样存在。
// 角色排序规则是「业务正确性」的唯一稳定锚点。
const ROLE_ORDER: Record<string, number> = {
  user: 0,
  system: 1,
  developer: 2,
  assistant: 3,
  tool: 4,
};

function roleSortKey(role: string | undefined): number {
  if (!role) return 99;
  return ROLE_ORDER[role] ?? 50;
}

function compareLedgerEntriesByTime(
  a: MessageLedgerEntry,
  b: MessageLedgerEntry,
): number {
  const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  // 同时间戳：user 优先 → developer/assistant/tool（避免刷新后 user 跑到 assistant 之后）。
  const roleDiff = roleSortKey(a.resolvedRole) - roleSortKey(b.resolvedRole);
  if (roleDiff !== 0) {
    return roleDiff;
  }
  const aOrder = a.sourceOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.sourceOrder ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) {
    return aOrder - bOrder;
  }
  return a.id.localeCompare(b.id);
}

export function mergeMessageLedger(
  baseEntries: MessageLedgerEntry[],
  incomingEntries: MessageLedgerEntry[],
): MessageLedgerEntry[] {
  const merged = new Map<string, MessageLedgerEntry>();

  [...baseEntries, ...incomingEntries].forEach((entry) => {
    const semanticKey =
      entry.content.trim().length > 0 ? findSemanticLedgerKey(merged, entry) : null;
    const key = semanticKey || getLedgerIdentityKey(entry);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...entry,
        sourceEventTypes: [...entry.sourceEventTypes],
        relatedMessageIds: [...entry.relatedMessageIds],
      });
      return;
    }

    if (shouldReplaceResolvedRole(existing.resolutionSource, entry.resolutionSource)) {
      existing.resolvedRole = entry.resolvedRole;
      existing.resolutionSource = entry.resolutionSource;
    }
    if (entry.content.length > existing.content.length) {
      existing.content = entry.content;
    }
    if (entry.createdAt.getTime() < existing.createdAt.getTime()) {
      existing.createdAt = entry.createdAt;
    }
    existing.threadId = existing.threadId || entry.threadId;
    existing.runId = existing.runId || entry.runId;
    existing.author = existing.author || entry.author;
    existing.streaming = existing.streaming && entry.streaming;
    existing.lifecycle =
      existing.lifecycle === "closed" || entry.lifecycle === "closed" ? "closed" : "open";
    if (existing.origin === "realtime" || entry.origin === "realtime") {
      existing.origin = "realtime";
    } else if (existing.origin !== entry.origin) {
      existing.origin = entry.origin;
    }
    if (entry.sourceOrder !== undefined && Number.isFinite(entry.sourceOrder)) {
      const existingOrder = existing.sourceOrder ?? Number.MAX_SAFE_INTEGER;
      if (entry.sourceOrder < existingOrder) {
        existing.sourceOrder = entry.sourceOrder;
      }
    }
    if (!existing.relatedMessageIds.includes(entry.id)) {
      existing.relatedMessageIds.push(entry.id);
    }
    entry.sourceEventTypes.forEach((eventType) => {
      if (!existing.sourceEventTypes.includes(eventType)) {
        existing.sourceEventTypes.push(eventType);
      }
    });
    entry.relatedMessageIds.forEach((messageId) => {
      if (!existing.relatedMessageIds.includes(messageId)) {
        existing.relatedMessageIds.push(messageId);
      }
    });
  });

  return [...merged.values()].sort(compareLedgerEntriesByTime);
}

export function ledgerEntriesToMessages(entries: MessageLedgerEntry[]): Message[] {
  return [...entries]
    .sort(compareLedgerEntriesByTime)
    .map((entry) =>
    createAgUiMessage({
      id: entry.id,
      role:
        entry.resolvedRole === "user" ||
        entry.resolvedRole === "system" ||
        entry.resolvedRole === "tool"
          ? entry.resolvedRole
          : "assistant",
      content: entry.content,
      createdAt: entry.createdAt,
      runId: entry.runId,
      threadId: entry.threadId,
      author: entry.author,
      streaming: entry.streaming,
    }),
  );
}
