import { type BaseEvent, EventType, type Message } from "@ag-ui/core";
import type { AdkEventPayload } from "@/lib/adk";
import {
  AdkMessageStreamNormalizer,
  adkEventsToSnapshot,
  aguiEventsToMessages,
} from "@/lib/adk";
import { normalizeAguiEvent, resolveEventRunAndThread } from "@/utils/agui-normalization";
import type { ConnectionState } from "@/types/common";
import type { MessageLedgerEntry } from "@/types/common";
import {
  asAgUiEvent,
  getCustomEventData,
  getCustomEventType,
  getEventCode,
  getEventContent,
  getEventDelta,
  getEventErrorMessage,
  getEventMessageId,
  getEventRunId,
  getEventThreadId,
  getEventToolCallId,
  getEventToolCallName,
  getMessageCreatedAt,
  type AgUiMessage,
} from "@/types/agui";
import { getMessageIdentityKey, normalizeMessageContent } from "@/utils/message";
import { buildMessageLedger, isSemanticEquivalentEntry, ledgerEntriesToMessages } from "@/utils/message-ledger";

export type HydratedSessionDetail = {
  events: BaseEvent[];
  messages: Message[];
  messageLedger: MessageLedgerEntry[];
  snapshot: Record<string, unknown> | null;
};

function normalizeTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Date.now() / 1000;
}

// ISSUE-041 契约：当后端 ADK Web /sessions/{id} 不透传 runId / threadId 时，
// 本函数必须回退到 sessionId 以让事件能进入 turn 桶；该回退会产生「合成 runId」
// （runId === threadId === sessionId）。下游 message-ledger / conversation-tree
// 已通过 isSyntheticRunId 把合成 runId 视为可与真 runId 兼并的占位符，避免
// realtime + hydration 同一逻辑回答被分裂为两个 turn 渲染成双气泡。
// 后端透传 runId 是更彻底的根治路径（Phase 2 计划），本兜底保留作为防御。
function fallbackRunId(payload: AdkEventPayload, sessionId: string): string {
  return payload.runId || payload.threadId || sessionId;
}

function fallbackThreadId(payload: AdkEventPayload, sessionId: string): string {
  return payload.threadId || sessionId;
}

function eventKey(event: BaseEvent): string {
  const type = String(event.type);
  const threadId = getEventThreadId(event) || "";
  const runId = getEventRunId(event) || "";
  const messageId = getEventMessageId(event) || "";
  const toolCallId = getEventToolCallId(event) || "";
  // ISSUE-040 H4: 全部事件类型在涉及 timestamp 时统一走 toFixed(3)，避免浮点抖动
  // 在不同 hydration 路径产出不一样的 key（如 1001.1 vs 1001.10000002384），
  // 进而触发同一逻辑事件被保留双份、刷新后排序漂移。
  const timestampKey = normalizeTimestamp(event.timestamp).toFixed(3);

  switch (event.type) {
    case EventType.TEXT_MESSAGE_START:
      return [
        type,
        threadId,
        runId,
        messageId,
        String((event as Record<string, unknown>).role || ""),
      ].join("|");
    case EventType.TEXT_MESSAGE_CONTENT:
      // 固定 3 位小数（毫秒级）以稳定去重键：避免 1001.1 与 1001.10000002384
      // 因浮点精度差异生成不同 key，导致 mergeEvents 把同一逻辑事件保留两份、
      // 进而造成刷新后排序漂移与片段重复。
      return [
        type,
        threadId,
        runId,
        messageId,
        timestampKey,
      ].join("|");
    case EventType.TEXT_MESSAGE_END:
      return [type, threadId, runId, messageId].join("|");
    case EventType.TOOL_CALL_START:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        String(getEventToolCallName(event) || ""),
      ].join("|");
    case EventType.TOOL_CALL_ARGS:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        String(getEventDelta(event) || ""),
      ].join("|");
    case EventType.TOOL_CALL_END:
      return [type, threadId, runId, toolCallId].join("|");
    case EventType.TOOL_CALL_RESULT:
      return [
        type,
        threadId,
        runId,
        toolCallId,
        String(getEventContent(event) || ""),
      ].join("|");
    case EventType.RUN_STARTED:
    case EventType.RUN_FINISHED:
      return [type, threadId, runId].join("|");
    case EventType.RUN_ERROR:
      return [
        type,
        threadId,
        runId,
        String(getEventCode(event) || ""),
        String(getEventErrorMessage(event) || ""),
      ].join("|");
    case EventType.CUSTOM:
      // CUSTOM 事件附带毫秒级 timestamp 作 key，避免同一 (eventType, data) 在不同
      // 时刻被合并为同一份；典型场景：ne.a2ui.thought / ne.a2ui.link 多次发出。
      return [
        type,
        threadId,
        runId,
        String(getCustomEventType(event) || ""),
        JSON.stringify(getCustomEventData(event) ?? null),
        timestampKey,
      ].join("|");
    case EventType.STEP_STARTED:
    case EventType.STEP_FINISHED: {
      const stepId = String(
        (event as Record<string, unknown>).stepId || "",
      );
      return [type, threadId, runId, stepId].join("|");
    }
    default:
      return [type, threadId, runId, messageId, toolCallId, timestampKey].join(
        "|",
      );
  }
}

export function mergeEvents(baseEvents: BaseEvent[], incomingEvents: BaseEvent[]): BaseEvent[] {
  const merged = new Map<string, BaseEvent>();
  // ISSUE-040 Q3 残留乱序：如果同 timestamp 时回退到 `eventKey().localeCompare`，
  // 会把上游已正确排序的 lifecycle 序（START → CONTENT → END）按字典序打乱
  // 为 (CONTENT < END < START)。改为以「在 [...base, ...incoming] 中的最早出现
  // 索引」作为稳定 tiebreaker，保留调用方已建立的逻辑顺序。
  const insertionOrder = new Map<string, number>();
  let nextOrder = 0;
  [...baseEvents, ...incomingEvents].forEach((event) => {
    const key = eventKey(event);
    if (!insertionOrder.has(key)) {
      insertionOrder.set(key, nextOrder++);
    }
    merged.set(key, event);
  });

  return [...merged.entries()]
    .sort((a, b) => {
      const [keyA, eventA] = a;
      const [keyB, eventB] = b;
      const timeDiff = normalizeTimestamp(eventA.timestamp) - normalizeTimestamp(eventB.timestamp);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      const orderA = insertionOrder.get(keyA) ?? Number.MAX_SAFE_INTEGER;
      const orderB = insertionOrder.get(keyB) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return keyA.localeCompare(keyB);
    })
    .map(([, event]) => event);
}

const LIFECYCLE_EVENT_TYPES = new Set([
  EventType.RUN_STARTED,
  EventType.RUN_FINISHED,
  EventType.RUN_ERROR,
  EventType.MESSAGES_SNAPSHOT,
  EventType.STATE_SNAPSHOT,
  EventType.STATE_DELTA,
  EventType.STEP_STARTED,
  EventType.STEP_FINISHED,
]);

const TEXT_MESSAGE_EVENT_TYPES = new Set([
  EventType.TEXT_MESSAGE_START,
  EventType.TEXT_MESSAGE_CONTENT,
  EventType.TEXT_MESSAGE_END,
]);

const TOOL_CALL_EVENT_TYPES = new Set([
  EventType.TOOL_CALL_START,
  EventType.TOOL_CALL_ARGS,
  EventType.TOOL_CALL_END,
  EventType.TOOL_CALL_RESULT,
]);

/**
 * Realtime-Wins 合并策略：当 hydration 事件的 messageId / toolCallId
 * 已在实时流事件中出现时，优先保留实时流版本，丢弃 hydrated 副本。
 * 对于 messageId 不同但语义等价的消息，同样丢弃 hydrated 副本。
 * 保留 hydrated 事件中的生命周期事件作为补充。
 */
export function mergeEventsWithRealtimePriority(
  realtimeEvents: BaseEvent[],
  hydratedEvents: BaseEvent[],
  realtimeLedger: MessageLedgerEntry[],
  hydratedLedger: MessageLedgerEntry[],
): BaseEvent[] {
  // 1. 从实时事件中提取所有 messageId 和 toolCallId
  const realtimeMessageIds = new Set<string>();
  const realtimeToolCallIds = new Set<string>();
  realtimeEvents.forEach((event) => {
    const messageId = getEventMessageId(event);
    if (messageId) {
      realtimeMessageIds.add(messageId);
    }
    const toolCallId = getEventToolCallId(event);
    if (toolCallId) {
      realtimeToolCallIds.add(toolCallId);
    }
  });

  // 2. 通过语义等价匹配建立 hydrated messageId → realtime messageId 映射
  const hydratedToRealtimeMessageId = new Map<string, string>();
  hydratedLedger.forEach((hydratedEntry) => {
    if (realtimeMessageIds.has(hydratedEntry.id)) {
      hydratedToRealtimeMessageId.set(hydratedEntry.id, hydratedEntry.id);
      return;
    }
    for (const realtimeEntry of realtimeLedger) {
      if (
        isSemanticEquivalentEntry(
          { ...hydratedEntry, origin: "fallback" },
          { ...realtimeEntry, origin: "realtime" },
        )
      ) {
        hydratedToRealtimeMessageId.set(hydratedEntry.id, realtimeEntry.id);
        break;
      }
    }
  });

  // 3. 过滤 hydrated 事件
  const filteredHydratedEvents = hydratedEvents.filter((event) => {
    const eventType = event.type as EventType;

    // 始终保留生命周期事件
    if (LIFECYCLE_EVENT_TYPES.has(eventType)) {
      return true;
    }

    // 过滤已被实时流覆盖的文本消息事件
    if (TEXT_MESSAGE_EVENT_TYPES.has(eventType)) {
      const messageId = getEventMessageId(event);
      if (messageId && (realtimeMessageIds.has(messageId) || hydratedToRealtimeMessageId.has(messageId))) {
        return false;
      }
    }

    // 过滤已被实时流覆盖的工具调用事件
    if (TOOL_CALL_EVENT_TYPES.has(eventType)) {
      const toolCallId = getEventToolCallId(event);
      if (toolCallId && realtimeToolCallIds.has(toolCallId)) {
        return false;
      }
    }

    return true;
  });

  // 4. 使用既有 mergeEvents 合并；将 realtime 放在 incoming 位，使其覆盖 hydrated
  //    版本（mergeEvents 内部 [...base, ...incoming].forEach(set) 时 incoming 后写入
  //    并赢得 key 冲突）。realtime 流式时间戳精度更高、链路更近源，应作为权威。
  return mergeEvents(filteredHydratedEvents, realtimeEvents);
}

export function hasSameEventSequence(left: BaseEvent[], right: BaseEvent[]): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (eventKey(left[index]!) !== eventKey(right[index]!)) {
      return false;
    }
  }
  return true;
}

export function mergeMessages(baseMessages: Message[], incomingMessages: Message[]): Message[] {
  const merged = new Map<string, AgUiMessage>();

  [...baseMessages, ...incomingMessages].forEach((message) => {
    const timedMessage = message as AgUiMessage;
    const key = getMessageIdentityKey(message);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, timedMessage);
      return;
    }

    const existingContent = normalizeMessageContent(existing);
    const incomingContent = normalizeMessageContent(message);
    const existingStreaming = existing.streaming === true;
    const incomingStreaming = timedMessage.streaming === true;

    if (
      incomingContent.length > existingContent.length ||
      (incomingContent.length === existingContent.length &&
        existingStreaming &&
        !incomingStreaming)
    ) {
      merged.set(key, { ...existing, ...timedMessage } as AgUiMessage);
    }
  });

  return [...merged.values()].sort((a, b) => {
    const aTime = getMessageCreatedAt(a)?.getTime() || Number.MAX_SAFE_INTEGER;
    const bTime = getMessageCreatedAt(b)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });
}

export function hasSameMessageSequence(left: Message[], right: Message[]): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftMessage = left[index] as AgUiMessage;
    const rightMessage = right[index] as AgUiMessage;
    if (getMessageIdentityKey(leftMessage) !== getMessageIdentityKey(rightMessage)) {
      return false;
    }
    if (normalizeMessageContent(leftMessage) !== normalizeMessageContent(rightMessage)) {
      return false;
    }
    if ((leftMessage.streaming === true) !== (rightMessage.streaming === true)) {
      return false;
    }
  }

  return true;
}

export function hydrateSessionDetail(
  payloads: AdkEventPayload[],
  sessionId: string,
): HydratedSessionDetail {
  const runBuckets = new Map<string, BaseEvent[]>();
  const runNormalizers = new Map<string, AdkMessageStreamNormalizer>();

  // ISSUE-040 Q3 残留乱序根因：normalizer 已按 lifecycle 顺序产出
  // (START → CONTENT → END)，但下方的 sort 在 timestamp 相等时回退到
  // `eventKey().localeCompare` —— 字典序下 CONTENT < END < START，会把同一
  // 逻辑消息的 lifecycle 顺序打乱（如下方 repro 所示）；当多条消息共享同一秒
  // 时间戳（后端 ADK 落库精度受限），跨 messageId 的 START/CONTENT/END 还会
  // 互相穿插，造成「user1 → assistant1 → user2 → assistant2」刷新后被打散
  // 为 「user1 → user2 → assistant1 → assistant2」这类 turn 边界漂移。
  //
  // 修复：用 WeakMap 给每个 normalizer 输出的事件挂一个全局递增的 emitOrder，
  // sort tiebreaker 用 emitOrder 代替 eventKey 字典序，保持 normalizer 推入
  // 顺序作为权威 lifecycle / turn 序。emitOrder 仅在本 hydration 调用内有效。
  const emitOrderByEvent = new WeakMap<BaseEvent, number>();
  let emitCounter = 0;

  payloads.forEach((payload) => {
    const runId = fallbackRunId(payload, sessionId);
    const threadId = fallbackThreadId(payload, sessionId);
    const normalizer =
      runNormalizers.get(runId) || new AdkMessageStreamNormalizer();
    runNormalizers.set(runId, normalizer);
    const events = normalizer.consume(payload, { threadId, runId }).map((event) => {
      const normalized = normalizeAguiEvent(
        resolveEventRunAndThread(event, { threadId, runId }),
      );
      emitOrderByEvent.set(normalized, emitCounter++);
      return normalized;
    });
    const bucket = runBuckets.get(runId) || [];
    bucket.push(...events);
    runBuckets.set(runId, bucket);
  });

  runBuckets.forEach((events, runId) => {
    const normalizer = runNormalizers.get(runId);
    if (!normalizer) {
      return;
    }
    const threadId =
      events.reduce<string | null>((resolvedThreadId, event) => {
        if (resolvedThreadId) {
          return resolvedThreadId;
        }
        return getEventThreadId(event) || null;
      }, null) || sessionId;
    const flushedEvents = normalizer
      .flushRun(runId, threadId, normalizeTimestamp(events[events.length - 1]?.timestamp) + 0.001)
      .map((event) => {
        const normalized = normalizeAguiEvent(
          resolveEventRunAndThread(event, { threadId, runId }),
        );
        emitOrderByEvent.set(normalized, emitCounter++);
        return normalized;
      });
    events.push(...flushedEvents);
  });

  const normalizedEvents = [...runBuckets.entries()].flatMap(([runId, events]) => {
    const ordered = [...events].sort((a, b) => {
      const timeDiff = normalizeTimestamp(a.timestamp) - normalizeTimestamp(b.timestamp);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // emitOrder tiebreaker：保持 normalizer 推入顺序（lifecycle / turn 边界
      // 的权威来源）。未在 emitOrderByEvent 中的事件（极罕见，理论上仅由本
      // 函数下方合成的 RUN_STARTED / RUN_FINISHED 注入，但它们会带 ±0.001
      // 时间漂移让 timestamp 比较先决出胜负）回退到 eventKey 字典序兜底。
      const aOrder = emitOrderByEvent.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = emitOrderByEvent.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return eventKey(a).localeCompare(eventKey(b));
    });

    if (ordered.length === 0) {
      return ordered;
    }

    const first = ordered[0];
    const hasRunStarted = ordered.some((event) => event.type === EventType.RUN_STARTED);
    const hasRunFinished = ordered.some((event) => event.type === EventType.RUN_FINISHED);
    const hasRunError = ordered.some((event) => event.type === EventType.RUN_ERROR);
    const threadId = getEventThreadId(first) || sessionId;

    if (!hasRunStarted) {
      ordered.unshift(asAgUiEvent({
        type: EventType.RUN_STARTED,
        threadId,
        runId,
        timestamp: Math.max(0, normalizeTimestamp(first.timestamp) - 0.001),
      }));
    }

    if (!hasRunFinished && !hasRunError) {
      const last = ordered[ordered.length - 1];
      ordered.push(asAgUiEvent({
        type: EventType.RUN_FINISHED,
        threadId,
        runId,
        result: "completed_from_history",
        timestamp: normalizeTimestamp(last.timestamp) + 0.001,
      }));
    }

    return ordered;
  });

  const messageLedger = buildMessageLedger({ events: normalizedEvents }).map((entry) => ({
    ...entry,
    origin: "fallback" as const,
  }));
  const messages =
    messageLedger.length > 0
      ? ledgerEntriesToMessages(messageLedger)
      : aguiEventsToMessages(normalizedEvents);
  const snapshot = adkEventsToSnapshot(payloads) || null;

  return {
    events: mergeEvents([], normalizedEvents),
    messages,
    messageLedger,
    snapshot,
  };
}

export type DerivedRunState = {
  runId: string;
  status: "streaming" | "blocked" | "completed" | "error";
  startedAt?: number;
  finishedAt?: number;
  pendingConfirmationCount: number;
  hasRenderableOutput: boolean;
};

function isRenderableEvent(event: BaseEvent): boolean {
  switch (event.type) {
    case EventType.TEXT_MESSAGE_CONTENT:
      return String(getEventDelta(event) || "").trim().length > 0;
    case EventType.TOOL_CALL_START:
    case EventType.TOOL_CALL_RESULT:
    case EventType.ACTIVITY_SNAPSHOT:
    case EventType.STATE_DELTA:
    case EventType.STATE_SNAPSHOT:
    case EventType.RUN_ERROR:
      return true;
    default:
      return false;
  }
}

export function deriveRunStates(events: BaseEvent[]): DerivedRunState[] {
  const states = new Map<string, DerivedRunState>();

  events.forEach((event) => {
    const runId = getEventRunId(event) || "default";
    const current = states.get(runId) || {
      runId,
      status: "streaming" as const,
      pendingConfirmationCount: 0,
      hasRenderableOutput: false,
    };

    if (event.type === EventType.RUN_STARTED) {
      current.startedAt = normalizeTimestamp(event.timestamp);
      current.status = "streaming";
    }

    if (event.type === EventType.RUN_FINISHED) {
      current.finishedAt = normalizeTimestamp(event.timestamp);
      current.status = current.pendingConfirmationCount > 0 ? "blocked" : "completed";
    }

    if (event.type === EventType.RUN_ERROR) {
      current.finishedAt = normalizeTimestamp(event.timestamp);
      current.status = "error";
    }

    if (
      event.type === EventType.TOOL_CALL_START &&
      getEventToolCallName(event) === "ui.confirmation"
    ) {
      current.pendingConfirmationCount += 1;
      current.status = "blocked";
    }

    if (event.type === EventType.TOOL_CALL_RESULT && current.pendingConfirmationCount > 0) {
      current.pendingConfirmationCount -= 1;
      if (current.status === "blocked") {
        current.status = current.finishedAt ? "completed" : "streaming";
      }
    }

    if (isRenderableEvent(event)) {
      current.hasRenderableOutput = true;
    }

    states.set(runId, current);
  });

  return [...states.values()].sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt ?? 0;
    const bTime = b.finishedAt ?? b.startedAt ?? 0;
    return aTime - bTime;
  });
}

export function deriveConnectionState(events: BaseEvent[]): ConnectionState {
  const runStates = deriveRunStates(events);
  const current = runStates[runStates.length - 1];

  if (!current) {
    return "idle";
  }
  if (current.status === "error") {
    return "error";
  }
  if (current.status === "blocked") {
    return "blocked";
  }
  if (current.status === "streaming") {
    return "streaming";
  }
  return "idle";
}
