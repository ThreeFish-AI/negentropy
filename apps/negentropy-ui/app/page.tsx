"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CopilotKitProvider,
  UseAgentUpdate,
  useAgent,
  useHumanInTheLoop,
} from "@copilotkitnext/react";
import { HttpAgent, compactEvents, randomUUID } from "@ag-ui/client";
import { BaseEvent, EventType, Message } from "@ag-ui/core";
import { z } from "zod";

import { ChatStream } from "../components/ui/ChatStream";
import { Composer } from "../components/ui/Composer";
import { EventTimeline, TimelineItem } from "../components/ui/EventTimeline";
import { SiteHeader } from "../components/layout/SiteHeader";
import { useAuth } from "../components/providers/AuthProvider";
import { LogBufferPanel } from "../components/ui/LogBufferPanel";
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";
import {
  AdkEventPayload,
  adkEventToAguiEvents,
  adkEventsToMessages,
  adkEventsToSnapshot,
} from "@/lib/adk";

type ConnectionState = "idle" | "connecting" | "streaming" | "error";

type SessionRecord = {
  id: string;
  label: string;
  lastUpdateTime?: number;
};

type LogEntry = {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
  payload?: Record<string, unknown>;
};

type ConfirmationToolArgs = {
  title?: string;
  detail?: string;
  payload?: Record<string, unknown>;
};

type AuthUser = {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  provider?: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const AGENT_ID = "negentropy";
const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

function createSessionLabel(id: string) {
  return `Session ${id.slice(0, 8)}`;
}

function buildAgentUrl(sessionId: string, userId: string) {
  const params = new URLSearchParams({
    app_name: APP_NAME,
    user_id: userId,
    session_id: sessionId,
  });
  return `/api/agui?${params.toString()}`;
}

function normalizeMessageContent(message: Message) {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("");
  }
  return message.content ? JSON.stringify(message.content) : "";
}

type ChatMessage = { id: string; role: string; content: string };
const EMPTY_MESSAGES: Message[] = [];

function mapMessagesToChat(messages: Message[]) {
  const merged: Array<{ id: string; role: string; content: string }> = [];
  messages.forEach((message) => {
    const rawRole = (message.role || "assistant").toLowerCase();

    // 1. Block technical/hidden roles
    if (rawRole === "tool" || rawRole === "system" || rawRole === "function") {
      return;
    }

    // 2. Normalize everything else to "user" or "assistant"
    // This ensures that "model", "bot", or custom roles are treated as assistant content
    const role = rawRole === "user" ? "user" : "assistant";

    const content = normalizeMessageContent(message);
    if (!content) {
      return;
    }

    const last = merged[merged.length - 1];

    // 3. Smart Merge Strategy
    // Handles two cases:
    // A) Snapshot Updates (e.g. "Hello" -> "Hello World"): New content starts with old. REPLACE.
    // B) Delta/Chunks (e.g. "Hello" -> "!"): New content appends to old. CONCATENATE.
    if (last && last.role === "assistant" && role === "assistant") {
      if (content.startsWith(last.content)) {
        last.content = content;
      } else {
        last.content = `${last.content}${content}`;
      }
      return;
    }

    merged.push({
      id: message.id,
      role,
      content,
    });
  });
  return merged;
}

function mergeAdjacentAssistant(messages: ChatMessage[]) {
  const merged: ChatMessage[] = [];
  messages.forEach((message) => {
    const last = merged[merged.length - 1];
    if (last && last.role === "assistant" && message.role === "assistant") {
      last.content = `${last.content}${message.content}`;
      return;
    }
    merged.push({ ...message });
  });
  return merged;
}

function buildChatMessagesFromEventsWithFallback(
  events: BaseEvent[],
  fallbackMessages: Message[],
) {
  const fallbackById = new Map<string, Message>();
  fallbackMessages.forEach((message) => fallbackById.set(message.id, message));

  // 1. Process events into map
  const messageMap = new Map<
    string,
    {
      id: string;
      role: string;
      content: string;
      timestamp: number;
    }
  >();

  events.forEach((event) => {
    if (
      event.type !== EventType.TEXT_MESSAGE_START &&
      event.type !== EventType.TEXT_MESSAGE_CONTENT &&
      event.type !== EventType.TEXT_MESSAGE_END
    ) {
      return;
    }
    const messageId = "messageId" in event ? event.messageId : undefined;
    if (!messageId) {
      return;
    }
    let entry = messageMap.get(messageId);
    if (!entry) {
      const fallback = fallbackById.get(messageId);
      entry = {
        id: messageId,
        role: ("role" in event && event.role) || fallback?.role || "assistant",
        content: "",
        timestamp:
          "timestamp" in event && event.timestamp ? event.timestamp : 0,
      };
      messageMap.set(messageId, entry);
    }
    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
      entry.content = `${entry.content}${event.delta ?? ""}`;
    }
    if (entry.timestamp === 0 && "timestamp" in event && event.timestamp) {
      entry.timestamp = event.timestamp;
    }
  });

  // 2. Add missing fallback messages (preserves history not in streaming window)
  fallbackMessages.forEach((fallback) => {
    if (!messageMap.has(fallback.id)) {
      // Convert Date to seconds timestamp to match events
      const timestamp = fallback.createdAt
        ? fallback.createdAt.getTime() / 1000
        : 0;
      messageMap.set(fallback.id, {
        id: fallback.id,
        role: fallback.role,
        content: normalizeMessageContent(fallback),
        timestamp,
      });
    } else {
      // Backfill timestamp if missing from events
      const entry = messageMap.get(fallback.id)!;
      if (entry.timestamp === 0 && fallback.createdAt) {
        entry.timestamp = fallback.createdAt.getTime() / 1000;
      }
    }
  });

  const ordered = Array.from(messageMap.values())
    .map((entry) => {
      if (!entry.content.trim()) {
        const fallback = fallbackById.get(entry.id);
        if (fallback) {
          entry.content = normalizeMessageContent(fallback);
          entry.role = fallback.role;
        }
      }
      return entry;
    })
    .filter((entry) => entry.content.trim().length > 0)
    .sort((a, b) => {
      // Sort by timestamp (seconds)
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      // If timestamps missing/equal, fallback to ID comparison or specific roles?
      // Assuming reliable timestamps for now.
      return 0;
    })
    .map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
    }));

  return mergeAdjacentAssistant(ordered);
}

function ensureUniqueMessageIds(messages: ChatMessage[]) {
  const seen = new Map<string, number>();
  return messages.map((message) => {
    const count = seen.get(message.id) ?? 0;
    seen.set(message.id, count + 1);
    if (count === 0) {
      return message;
    }
    return {
      ...message,
      id: `${message.id}:${count}`,
    };
  });
}

function ConfirmationToolCard({
  status,
  args,
  respond,
  result,
  onFollowup,
}: {
  status: "inProgress" | "executing" | "complete";
  args: ConfirmationToolArgs;
  respond?: (result: unknown) => Promise<void>;
  result?: string;
  onFollowup?: (payload: { action: string; note: string }) => void;
}) {
  const [note, setNote] = useState("");
  const payloadText = JSON.stringify(args?.payload ?? {}, null, 2);

  if (status === "complete") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700">
        <p className="font-semibold">已反馈</p>
        <p className="mt-1 break-words">{result}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
      <p className="text-sm font-semibold">需要确认</p>
      {args?.title ? <p className="mt-1 text-xs">{args.title}</p> : null}
      {args?.detail ? <p className="mt-1 text-xs">{args.detail}</p> : null}
      {payloadText !== "{}" ? (
        <pre className="mt-2 max-h-24 overflow-auto rounded bg-white/80 p-2 text-[10px]">
          {payloadText}
        </pre>
      ) : null}
      <textarea
        className="mt-2 w-full rounded border border-amber-200 bg-white p-2 text-[11px]"
        rows={2}
        placeholder="补充说明（可选）"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] text-white"
          onClick={async () => {
            if (!respond) return;
            await respond({ action: "confirm", note });
            onFollowup?.({ action: "confirm", note });
          }}
        >
          确认
        </button>
        <button
          className="rounded-full bg-slate-700 px-3 py-1 text-[11px] text-white"
          onClick={async () => {
            if (!respond) return;
            await respond({ action: "correct", note });
            onFollowup?.({ action: "correct", note });
          }}
        >
          修正
        </button>
        <button
          className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] text-white"
          onClick={async () => {
            if (!respond) return;
            await respond({ action: "supplement", note });
            onFollowup?.({ action: "supplement", note });
          }}
        >
          补充
        </button>
      </div>
    </div>
  );
}

function buildTimelineItems(events: BaseEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const toolIndex = new Map<string, number>();

  events.forEach((event) => {
    const runId = "runId" in event ? (event.runId as string) : undefined;

    switch (event.type) {
      case EventType.TOOL_CALL_START: {
        const { toolCallId, toolCallName } = event;
        const item: TimelineItem = {
          id: toolCallId,
          kind: "tool",
          name: toolCallName,
          args: "",
          result: "",
          status: "running",
          timestamp: event.timestamp,
          runId,
        };
        toolIndex.set(toolCallId, items.length);
        items.push(item);
        break;
      }
      case EventType.TOOL_CALL_ARGS: {
        const { toolCallId, delta } = event;
        const index = toolIndex.get(toolCallId);
        if (index !== undefined) {
          const item = items[index];
          if (item.kind === "tool") {
            item.args = `${item.args}${delta}`;
          }
        }
        break;
      }
      case EventType.TOOL_CALL_RESULT: {
        const { toolCallId, content } = event;
        const index = toolIndex.get(toolCallId);
        if (index !== undefined) {
          const item = items[index];
          if (item.kind === "tool") {
            item.result = content;
            item.status = "completed";
          }
        } else {
          items.push({
            id: toolCallId,
            kind: "tool",
            name: "tool_result",
            args: "",
            result: content,
            status: "completed",
            timestamp: event.timestamp,
            runId,
          });
        }
        break;
      }
      case EventType.TOOL_CALL_END: {
        const index = toolIndex.get(event.toolCallId);
        if (index !== undefined) {
          const item = items[index];
          if (item.kind === "tool" && item.status !== "completed") {
            item.status = "done";
          }
        }
        break;
      }
      case EventType.ACTIVITY_SNAPSHOT: {
        if (event.activityType === "artifact") {
          items.push({
            id: event.messageId,
            kind: "artifact",
            title: "Artifact",
            content: event.content,
            timestamp: event.timestamp,
            runId,
          });
        }
        break;
      }
      case EventType.STATE_DELTA: {
        items.push({
          id: `state_${items.length}`,
          kind: "state",
          title: "State Delta",
          content: event.delta,
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      case EventType.RUN_ERROR: {
        items.push({
          id: `error_${items.length}`,
          kind: "event",
          title: "Run Error",
          content: event.message,
          timestamp: event.timestamp,
          runId,
        });
        break;
      }
      default:
        break;
    }
  });

  return items;
}

function useConfirmationTool(
  onFollowup?: (payload: { action: string; note: string }) => void,
) {
  useHumanInTheLoop<ConfirmationToolArgs>(
    {
      name: "ui.confirmation",
      description: "用于前端确认/修正/补充的人工确认流程",
      parameters: z.object({
        title: z.string().optional(),
        detail: z.string().optional(),
        payload: z.record(z.any()).optional(),
      }),
      render: ({ status, args, respond, result }) => (
        <ConfirmationToolCard
          status={status}
          args={args as ConfirmationToolArgs}
          respond={respond}
          result={result}
          onFollowup={onFollowup}
        />
      ),
    },
    [onFollowup],
  );
}

export function HomeBody({
  sessionId,
  userId,
  user,
  setSessionId,
  sessions,
  setSessions,
  onLogout,
}: {
  sessionId: string | null;
  userId: string;
  user: AuthUser | null;
  setSessionId: (id: string | null) => void;
  sessions: SessionRecord[];
  setSessions: React.Dispatch<React.SetStateAction<SessionRecord[]>>;
  onLogout: () => void;
}) {
  const { agent } = useAgent({
    agentId: AGENT_ID,
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnStateChanged],
  });
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const metricsRef = useRef({
    runCount: 0,
    errorCount: 0,
    reconnectCount: 0,
    lastRunStartedAt: 0,
    lastRunMs: 0,
  });
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [rawEvents, setRawEvents] = useState<BaseEvent[]>([]);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [sessionSnapshot, setSessionSnapshot] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) || null,
    [sessions, sessionId],
  );

  const addLog = useCallback(
    (
      level: LogEntry["level"],
      message: string,
      payload?: Record<string, unknown>,
    ) => {
      setLogEntries((prev) => {
        const next = [
          ...prev,
          {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level,
            message,
            payload,
          },
        ];
        return next.slice(-200);
      });
    },
    [],
  );

  const updateCurrentSessionTime = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const target = prev.find((s) => s.id === id);
        if (!target) return prev;
        const others = prev.filter((s) => s.id !== id);
        const updated = { ...target, lastUpdateTime: Date.now() };
        return [updated, ...others].sort(
          (a, b) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0),
        );
      });
    },
    [setSessions],
  );

  const reportMetric = useCallback(
    (name: string, payload: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== "production") {
        console.debug(`[metrics] ${name}`, payload);
      }
      addLog("info", name, payload);
    },
    [addLog],
  );

  // ... (keeping intervening code if any, but replacing the function block to be safe)
  // Wait, replace_file_content needs contiguous block.
  // I will split this into two replacements if needed or just target updateCurrentSessionTime first.

  // Actually, I can do it in two chunks? No, replace_file_content is single contiguous.
  // I will use multi_replace_file_content for safety if I need to touch multiple places,
  // or just replace updateCurrentSessionTime block first.

  // use multi_replace_file_content to fix both locations.

  const setConnectionWithMetrics = useCallback(
    (next: ConnectionState) => {
      setConnection((prev) => {
        if (prev === "error" && next === "connecting") {
          metricsRef.current.reconnectCount += 1;
          reportMetric("reconnect", {
            count: metricsRef.current.reconnectCount,
          });
        }
        return next;
      });
    },
    [reportMetric],
  );

  useEffect(() => {
    if (!agent) {
      return;
    }
    const subscription = agent.subscribe({
      onRunInitialized: () => setConnectionWithMetrics("connecting"),
      onRunStartedEvent: () => {
        metricsRef.current.runCount += 1;
        metricsRef.current.lastRunStartedAt = performance.now();
        reportMetric("run_started", { runCount: metricsRef.current.runCount });
        setConnectionWithMetrics("streaming");
      },
      onRunFinishedEvent: () => {
        if (metricsRef.current.lastRunStartedAt) {
          metricsRef.current.lastRunMs =
            performance.now() - metricsRef.current.lastRunStartedAt;
          metricsRef.current.lastRunStartedAt = 0;
          reportMetric("run_finished", {
            lastRunMs: metricsRef.current.lastRunMs,
          });
        }
        setConnectionWithMetrics("idle");
        if (sessionId) {
          updateCurrentSessionTime(sessionId);
        }
      },
      onRunErrorEvent: () => {
        metricsRef.current.errorCount += 1;
        reportMetric("run_error", {
          errorCount: metricsRef.current.errorCount,
        });
        setConnectionWithMetrics("error");
      },
      onRunFailed: () => {
        metricsRef.current.errorCount += 1;
        reportMetric("run_failed", {
          errorCount: metricsRef.current.errorCount,
        });
        setConnectionWithMetrics("error");
      },
      onEvent: ({ event }) =>
        setRawEvents((prev) => {
          const next = [...prev, event];
          return next.slice(-10000);
        }),
    });

    return () => subscription.unsubscribe();
  }, [agent, reportMetric, setConnectionWithMetrics]);

  const pendingConfirmations = useMemo(() => {
    const pending = new Set<string>();
    rawEvents.forEach((event) => {
      if (
        event.type === EventType.TOOL_CALL_START &&
        event.toolCallName === "ui.confirmation"
      ) {
        pending.add(event.toolCallId);
      }
      if (event.type === EventType.TOOL_CALL_RESULT) {
        pending.delete(event.toolCallId);
      }
    });
    return pending.size;
  }, [rawEvents]);

  const compactedEvents = useMemo(() => compactEvents(rawEvents), [rawEvents]);
  const timelineItems = useMemo(
    () => buildTimelineItems(compactedEvents),
    [compactedEvents],
  );

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agui/sessions/list?app_name=${encodeURIComponent(APP_NAME)}&user_id=${encodeURIComponent(
          userId,
        )}`,
      );
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        return;
      }
      const nextSessions = payload
        .map(
          (session: {
            id: string;
            lastUpdateTime?: number;
            state?: { metadata?: { title?: string } };
          }) => ({
            id: session.id,
            label:
              session.state?.metadata?.title || createSessionLabel(session.id),
            lastUpdateTime: session.lastUpdateTime,
          }),
        )
        .sort(
          (a: SessionRecord, b: SessionRecord) =>
            (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0),
        );
      setSessions(nextSessions);
      if (
        sessionId &&
        !nextSessions.some((session) => session.id === sessionId)
      ) {
        setSessionId(nextSessions.length > 0 ? nextSessions[0].id : null);
      } else if (!sessionId && nextSessions.length > 0) {
        setSessionId(nextSessions[0].id);
      }
    } catch (error) {
      setConnectionWithMetrics("error");
      addLog("error", "load_sessions_failed", { message: String(error) });
      console.warn("Failed to load sessions", error);
    }
  }, [addLog, userId, sessionId, updateCurrentSessionTime]);

  const startNewSession = async () => {
    try {
      const response = await fetch("/api/agui/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_name: APP_NAME,
          user_id: userId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          addLog("warn", "session_not_found", { sessionId: id });
          setSessions((prev) => prev.filter((session) => session.id !== id));
          if (sessionId === id) {
            setSessionId(null);
          }
        }
        return;
      }
      const id = payload.id;
      const label = createSessionLabel(id);
      setSessions((prev) =>
        [{ id, label, lastUpdateTime: payload.lastUpdateTime }, ...prev].sort(
          (a, b) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0),
        ),
      );
      setSessionId(id);
    } catch (error) {
      setConnectionWithMetrics("error");
      addLog("error", "create_session_failed", { message: String(error) });
      console.warn("Failed to create session", error);
    }
  };

  const loadSessionDetail = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/agui/sessions/${encodeURIComponent(id)}?app_name=${encodeURIComponent(
            APP_NAME,
          )}&user_id=${encodeURIComponent(userId)}`,
        );
        const payload = await response.json();
        if (!response.ok) {
          return;
        }
        const events = Array.isArray(payload.events)
          ? (payload.events as AdkEventPayload[])
          : [];
        const messages = adkEventsToMessages(events);
        const snapshot = adkEventsToSnapshot(events);
        const mappedEvents = events.flatMap(adkEventToAguiEvents);

        setRawEvents(mappedEvents);
        setSessionMessages(messages);
        setSessionSnapshot(snapshot || null);
        setLoadedSessionId(id);
        if (agent) {
          agent.setMessages(messages);
          agent.setState(snapshot || {});
        }
      } catch (error) {
        setConnectionWithMetrics("error");
        addLog("error", "load_session_detail_failed", {
          message: String(error),
        });
        console.warn("Failed to load session detail", error);
      }
    },
    [
      agent,
      userId,
      setConnectionWithMetrics,
      addLog,
      sessionId,
      setSessionId,
      setSessions,
    ],
  );

  const resolvedThreadId = sessionId ?? "pending";
  const handleConfirmationFollowup = useCallback(
    async (payload: { action: string; note: string }) => {
      if (!agent || !sessionId || agent.isRunning) {
        return;
      }
      agent.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: `HITL:${payload.action} ${payload.note || ""}`.trim(),
      });
      try {
        setConnectionWithMetrics("connecting");
        await agent.runAgent({
          runId: randomUUID(),
          threadId: resolvedThreadId,
        });
        await loadSessions();
      } catch (error) {
        setConnectionWithMetrics("error");
        addLog("error", "hitl_submit_failed", { message: String(error) });
        console.warn("Failed to submit HITL response", error);
      }
    },
    [agent, loadSessions, resolvedThreadId, sessionId],
  );

  useConfirmationTool(handleConfirmationFollowup);

  const sendInput = async () => {
    if (!agent || !sessionId || !inputValue.trim()) {
      return;
    }
    if (pendingConfirmations > 0) {
      return;
    }

    const messageId = crypto.randomUUID();
    const timestamp = Date.now() / 1000;
    const newMessage: Message = {
      id: messageId,
      role: "user",
      content: inputValue.trim(),
      createdAt: new Date(timestamp * 1000),
    };
    setOptimisticMessages((prev) => [...prev, newMessage]);
    setRawEvents((prev) => {
      const optimisticEvents: BaseEvent[] = [
        {
          type: EventType.TEXT_MESSAGE_START,
          messageId,
          role: "user",
          timestamp,
        } as BaseEvent,
        {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: newMessage.content,
          timestamp,
        } as BaseEvent,
        {
          type: EventType.TEXT_MESSAGE_END,
          messageId,
          timestamp,
        } as BaseEvent,
      ];
      const next = [...prev, ...optimisticEvents];
      // Increase buffer to prevent dropping messages
      return next.slice(-10000);
    });
    agent.addMessage(newMessage);
    setInputValue("");
    try {
      setConnectionWithMetrics("connecting");
      await agent.runAgent({ runId: randomUUID(), threadId: resolvedThreadId });
      await loadSessions();
    } catch (error) {
      setConnectionWithMetrics("error");
      addLog("error", "run_agent_failed", { message: String(error) });
      console.warn("Failed to run agent", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    setSessionMessages([]);
    setOptimisticMessages([]);
    setSessionSnapshot(null);
    setRawEvents([]);
    setLoadedSessionId(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessionDetail(sessionId);
  }, [sessionId, agent, loadSessionDetail]);

  const agentMessages = agent ? (agent.messages as Message[]) : EMPTY_MESSAGES;

  useEffect(() => {
    if (agentMessages.length === 0) {
      return;
    }
    const knownIds = new Set(
      agentMessages
        .filter((message) => normalizeMessageContent(message).trim().length > 0)
        .map((message) => message.id),
    );
    setOptimisticMessages((prev) =>
      prev.filter((message) => !knownIds.has(message.id)),
    );
  }, [agentMessages]);
  const agentSnapshot = agent ? (agent.state as Record<string, unknown>) : null;
  const hasLoadedSession = loadedSessionId === sessionId;
  const messagesForRenderBase =
    hasLoadedSession && agentMessages.length > 0
      ? agentMessages
      : sessionMessages;
  const snapshotForRender = hasLoadedSession
    ? (agentSnapshot ?? sessionSnapshot)
    : sessionSnapshot;
  const mergeOptimisticMessages = (
    base: Message[],
    optimistic: Message[],
  ): Message[] => {
    if (optimistic.length === 0) {
      return base;
    }
    const merged = [...base];
    const indexById = new Map<string, number>();
    merged.forEach((message, index) => {
      indexById.set(message.id, index);
    });
    optimistic.forEach((message) => {
      const index = indexById.get(message.id);
      if (index === undefined) {
        merged.push(message);
        indexById.set(message.id, merged.length - 1);
        return;
      }
      const existing = merged[index];
      if (!existing.content && message.content) {
        merged[index] = { ...existing, content: message.content };
      }
    });
    return merged;
  };
  const mergedMessagesForRender = mergeOptimisticMessages(
    messagesForRenderBase,
    optimisticMessages,
  );

  const mappedMessages = mapMessagesToChat(mergedMessagesForRender);
  const chatMessages = ensureUniqueMessageIds(mappedMessages);

  // Debugging logs to investigate missing content
  // eslint-disable-next-line no-console
  console.log("DEBUG: Render Cycle", {
    sessionId,
    hasLoadedSession,
    agentMessagesLen: agentMessages.length,
    optimisticLen: optimisticMessages.length,
    mergedLen: mergedMessagesForRender.length,
    mappedLen: mappedMessages.length,
    finalLen: chatMessages.length,
    lastMessage: chatMessages[chatMessages.length - 1],
  });

  return (
    <div className="h-screen flex flex-col bg-zinc-50 text-zinc-900 overflow-hidden">
      <SiteHeader />

      <div className="flex h-[calc(100vh-72px)] overflow-hidden relative">
        {/* Left Sidebar: Session List */}
        <div
          className={`shrink-0 h-full border-r border-zinc-200 bg-white transition-all duration-300 ease-in-out overflow-hidden ${
            showLeftPanel
              ? "w-64 translate-x-0 opacity-100"
              : "w-0 -translate-x-10 opacity-0"
          }`}
        >
          <div className="w-64 h-full overflow-hidden flex flex-col">
            <SessionList
              sessions={sessions}
              activeId={sessionId}
              onSelect={setSessionId}
              onNewSession={startNewSession}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-zinc-50 relative overflow-hidden transition-all duration-300">
          {/* Internal Toolbar for Toggles */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-200/50 bg-white/50 backdrop-blur-sm z-10 w-full">
            <button
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors"
              title={showLeftPanel ? "Close Sidebar" : "Open Sidebar"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                />
                {/* Replaced with a simple Sidebar Icon */}
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>

            <div className="text-xs font-medium text-zinc-400 max-w-md truncate mx-4">
              {activeSession ? activeSession.label : "Negentropy"}
            </div>

            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors"
              title={showRightPanel ? "Close Panel" : "Open Panel"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
          </div>

          {/* Chat Stream Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            <ChatStream messages={chatMessages} />
            <div className="p-6 pt-2 shrink-0 w-full max-w-4xl mx-auto">
              <Composer
                value={inputValue}
                onChange={setInputValue}
                onSend={sendInput}
                isGenerating={connection === "streaming"}
                disabled={
                  !sessionId ||
                  connection === "streaming" ||
                  pendingConfirmations > 0
                }
              />
            </div>
          </div>
        </main>

        {/* Right Sidebar: Timeline & Logs */}
        <div
          className={`shrink-0 h-full border-l border-zinc-200 bg-white transition-all duration-300 ease-in-out overflow-hidden ${
            showRightPanel
              ? "w-80 translate-x-0 opacity-100"
              : "w-0 translate-x-10 opacity-0"
          }`}
        >
          <div className="w-80 h-full overflow-y-auto p-6">
            <StateSnapshot
              snapshot={snapshotForRender}
              connection={connection}
            />
            <EventTimeline events={timelineItems} />
            <LogBufferPanel
              entries={logEntries}
              onExport={() => {
                const payload = JSON.stringify(logEntries, null, 2);
                void navigator.clipboard?.writeText(payload);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, status: authStatus, login, logout } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const [agent, setAgent] = useState<HttpAgent | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    const userId = user.userId;
    const resolvedSession = sessionId || "pending";
    setAgent(
      new HttpAgent({
        url: buildAgentUrl(resolvedSession, userId),
        headers: {
          "X-Session-ID": resolvedSession,
          "X-User-ID": userId,
        },
        threadId: resolvedSession,
      }),
    );
  }, [sessionId, user]);

  const copilotAgents = useMemo(
    () => (agent ? { [AGENT_ID]: agent } : {}),
    [agent],
  );

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        正在验证登录状态...
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Negentropy UI
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            需要登录以继续
          </h1>
          <p className="text-sm text-zinc-500">
            使用 Google OAuth 进行单点登录。
          </p>
        </div>
        <button
          className="rounded-full bg-black px-6 py-2 text-xs font-semibold text-white"
          onClick={login}
          type="button"
        >
          使用 Google 登录
        </button>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        正在初始化 Agent...
      </div>
    );
  }

  return (
    <CopilotKitProvider
      agents__unsafe_dev_only={copilotAgents}
      showDevConsole="auto"
    >
      <HomeBody
        sessionId={sessionId}
        userId={user.userId}
        user={user}
        setSessionId={setSessionId}
        sessions={sessions}
        setSessions={setSessions}
        onLogout={logout}
      />
    </CopilotKitProvider>
  );
}
