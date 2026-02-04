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
import { Header } from "../components/ui/Header";
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

function mapMessagesToChat(messages: Message[]) {
  const merged: Array<{ id: string; role: string; content: string }> = [];
  messages
    .filter((message) => message.role !== "tool")
    .forEach((message) => {
      const content = normalizeMessageContent(message);
      if (!content) {
        return;
      }
      const last = merged[merged.length - 1];
      if (last && last.role === "assistant" && message.role === "assistant") {
        last.content = `${last.content}${content}`;
        return;
      }
      merged.push({
        id: message.id,
        role: message.role,
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

function buildStreamedAssistantMessagesFromEvents(
  events: BaseEvent[],
  ignoreMessageIds: Set<string>,
) {
  const messageMap = new Map<
    string,
    { id: string; role: string; content: string }
  >();
  const ordered: Array<{ id: string; role: string; content: string }> = [];

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
    if (event.type === EventType.TEXT_MESSAGE_START) {
      if (!messageMap.has(messageId)) {
        if (ignoreMessageIds.has(messageId)) {
          return;
        }
        const next = {
          id: messageId,
          role: "role" in event ? event.role : "assistant",
          content: "",
        };
        if (next.role === "user") {
          return;
        }
        messageMap.set(messageId, next);
        ordered.push(next);
      }
      return;
    }
    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
      const target = messageMap.get(messageId);
      if (target) {
        target.content = `${target.content}${event.delta ?? ""}`;
        return;
      }
      if (ignoreMessageIds.has(messageId)) {
        return;
      }
      const fallback = {
        id: messageId,
        role: "role" in event ? event.role : "assistant",
        content: event.delta ?? "",
      };
      if (fallback.role === "user") {
        return;
      }
      messageMap.set(messageId, fallback);
      ordered.push(fallback);
    }
  });

  return mergeAdjacentAssistant(
    ordered.filter((item) => item.content.trim().length > 0),
  );
}

function mergeStreamWithMessages(
  baseMessages: ChatMessage[],
  streamedMessages: ChatMessage[],
) {
  if (streamedMessages.length === 0) {
    return baseMessages;
  }
  let streamIndex = 0;
  const merged = baseMessages.map((message) => {
    if (message.role === "assistant" && streamIndex < streamedMessages.length) {
      const streamed = streamedMessages[streamIndex];
      streamIndex += 1;
      return {
        id: streamed.id || message.id,
        role: message.role,
        content: streamed.content,
      };
    }
    return message;
  });
  for (; streamIndex < streamedMessages.length; streamIndex += 1) {
    merged.push(streamedMessages[streamIndex]);
  }
  return merged;
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

  const reportMetric = useCallback(
    (name: string, payload: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== "production") {
        console.debug(`[metrics] ${name}`, payload);
      }
      addLog("info", name, payload);
    },
    [addLog],
  );

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
          return next.slice(-500);
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
        .map((session: { id: string; lastUpdateTime?: number }) => ({
          id: session.id,
          label: createSessionLabel(session.id),
          lastUpdateTime: session.lastUpdateTime,
        }))
        .sort(
          (a: SessionRecord, b: SessionRecord) =>
            (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0),
        );
      setSessions(nextSessions);
      if (
        sessionId &&
        !nextSessions.some((session) => session.id === sessionId)
      ) {
        setSessionId(null);
      }
    } catch (error) {
      setConnectionWithMetrics("error");
      addLog("error", "load_sessions_failed", { message: String(error) });
      console.warn("Failed to load sessions", error);
    }
  }, [
    userId,
    sessionId,
    setSessions,
    setSessionId,
    setConnectionWithMetrics,
    addLog,
  ]);

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
      const id = payload.id as string;
      const label = createSessionLabel(id);
      setSessions((prev) => [
        { id, label, lastUpdateTime: payload.lastUpdateTime },
        ...prev,
      ]);
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
    const newMessage: Message = {
      id: messageId,
      role: "user",
      content: inputValue.trim(),
    };
    setOptimisticMessages((prev) => [...prev, newMessage]);
    setRawEvents((prev) => {
      const timestamp = Date.now();
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
      return next.slice(-500);
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

  const agentMessages = agent ? (agent.messages as Message[]) : [];
  useEffect(() => {
    if (agentMessages.length === 0) {
      return;
    }
    const knownIds = new Set(agentMessages.map((message) => message.id));
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
  const baseChatMessages = mapMessagesToChat(mergedMessagesForRender);
  const userMessageIds = new Set(
    baseChatMessages
      .filter((message) => message.role === "user")
      .map((message) => message.id),
  );
  const streamedChatMessages =
    rawEvents.length > 0
      ? buildStreamedAssistantMessagesFromEvents(rawEvents, userMessageIds)
      : [];
  const chatMessages = ensureUniqueMessageIds(
    mergeStreamWithMessages(baseChatMessages, streamedChatMessages),
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Header
        title={activeSession?.label || "未选择会话"}
        connection={connection}
        onNewSession={startNewSession}
        user={user}
        onLogout={onLogout}
      />

      <div className="grid min-h-[calc(100vh-72px)] grid-cols-12 gap-0">
        <SessionList
          sessions={sessions}
          activeId={sessionId}
          onSelect={setSessionId}
        />

        <main className="col-span-7 border-r border-zinc-200 bg-zinc-50 p-6">
          <ChatStream messages={chatMessages} />
          <Composer
            value={inputValue}
            onChange={setInputValue}
            onSend={sendInput}
            disabled={
              !sessionId ||
              connection === "streaming" ||
              pendingConfirmations > 0
            }
          />
        </main>

        <aside className="col-span-3 bg-white p-6">
          <StateSnapshot snapshot={snapshotForRender} />
          <EventTimeline events={timelineItems} />
          <LogBufferPanel
            entries={logEntries}
            onExport={() => {
              const payload = JSON.stringify(logEntries, null, 2);
              void navigator.clipboard?.writeText(payload);
            }}
          />
        </aside>
      </div>
    </div>
  );
}

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const [agent, setAgent] = useState<HttpAgent | null>(null);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          setAuthStatus("unauthenticated");
          setAuthUser(null);
          setUserId(null);
          return;
        }
        const payload = (await response.json()) as { user: AuthUser };
        setAuthUser(payload.user);
        setUserId(payload.user.userId);
        setAuthStatus("authenticated");
      } catch (error) {
        console.warn("Failed to load auth state", error);
        setAuthStatus("unauthenticated");
      }
    };
    loadAuth();
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
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
  }, [sessionId, userId]);

  const copilotAgents = useMemo(
    () => (agent ? { [AGENT_ID]: agent } : {}),
    [agent],
  );

  const handleLogin = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.warn("Failed to logout", error);
    }
  }, []);

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        正在验证登录状态...
      </div>
    );
  }

  if (authStatus !== "authenticated" || !userId) {
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
          onClick={handleLogin}
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
        userId={userId}
        user={authUser}
        setSessionId={setSessionId}
        sessions={sessions}
        setSessions={setSessions}
        onLogout={handleLogout}
      />
    </CopilotKitProvider>
  );
}
