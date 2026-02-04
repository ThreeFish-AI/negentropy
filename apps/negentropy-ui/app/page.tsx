"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";
import { AdkEventPayload, adkEventToAguiEvents, adkEventsToMessages, adkEventsToSnapshot } from "@/lib/adk";

type ConnectionState = "idle" | "connecting" | "streaming" | "error";

type SessionRecord = {
  id: string;
  label: string;
  lastUpdateTime?: number;
};

type ConfirmationToolArgs = {
  title?: string;
  detail?: string;
  payload?: Record<string, unknown>;
};

const AGENT_ID = "negentropy";
const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";
const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_AGUI_USER_ID || "ui";

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

function mapMessagesToChat(messages: Message[]) {
  return messages
    .filter((message) => message.role !== "tool")
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: normalizeMessageContent(message),
    }));
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

function useConfirmationTool(onFollowup?: (payload: { action: string; note: string }) => void) {
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
    [onFollowup]
  );
}

export function HomeBody({
  sessionId,
  userId,
  setSessionId,
  sessions,
  setSessions,
}: {
  sessionId: string | null;
  userId: string;
  setSessionId: (id: string | null) => void;
  sessions: SessionRecord[];
  setSessions: React.Dispatch<React.SetStateAction<SessionRecord[]>>;
}) {
  const { agent } = useAgent({
    agentId: AGENT_ID,
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnStateChanged],
  });
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [inputValue, setInputValue] = useState("");
  const [rawEvents, setRawEvents] = useState<BaseEvent[]>([]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) || null,
    [sessions, sessionId]
  );

  useEffect(() => {
    if (!agent) {
      return;
    }
    const subscription = agent.subscribe({
      onRunInitialized: () => setConnection("connecting"),
      onRunStartedEvent: () => setConnection("streaming"),
      onRunFinishedEvent: () => setConnection("idle"),
      onRunErrorEvent: () => setConnection("error"),
      onRunFailed: () => setConnection("error"),
      onEvent: ({ event }) =>
        setRawEvents((prev) => {
          const next = [...prev, event];
          return next.slice(-500);
        }),
    });

    return () => subscription.unsubscribe();
  }, [agent]);

  const pendingConfirmations = useMemo(() => {
    const pending = new Set<string>();
    rawEvents.forEach((event) => {
      if (event.type === EventType.TOOL_CALL_START && event.toolCallName === "ui.confirmation") {
        pending.add(event.toolCallId);
      }
      if (event.type === EventType.TOOL_CALL_RESULT) {
        pending.delete(event.toolCallId);
      }
    });
    return pending.size;
  }, [rawEvents]);

  const compactedEvents = useMemo(() => compactEvents(rawEvents), [rawEvents]);
  const timelineItems = useMemo(() => buildTimelineItems(compactedEvents), [compactedEvents]);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agui/sessions/list?app_name=${encodeURIComponent(APP_NAME)}&user_id=${encodeURIComponent(
          userId
        )}`
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
        .sort((a: SessionRecord, b: SessionRecord) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0));
      setSessions(nextSessions);
    } catch (error) {
      setConnection("error");
      console.warn("Failed to load sessions", error);
    }
  }, [userId, setSessions]);

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
        return;
      }
      const id = payload.id as string;
      const label = createSessionLabel(id);
      setSessions((prev) => [{ id, label, lastUpdateTime: payload.lastUpdateTime }, ...prev]);
      setSessionId(id);
    } catch (error) {
      setConnection("error");
      console.warn("Failed to create session", error);
    }
  };

  const loadSessionDetail = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/agui/sessions/${encodeURIComponent(id)}?app_name=${encodeURIComponent(
            APP_NAME
          )}&user_id=${encodeURIComponent(userId)}`
        );
      const payload = await response.json();
      if (!response.ok) {
        return;
      }
      const events = Array.isArray(payload.events) ? (payload.events as AdkEventPayload[]) : [];
      const messages = adkEventsToMessages(events);
      const snapshot = adkEventsToSnapshot(events);
      const mappedEvents = events.flatMap(adkEventToAguiEvents);

      setRawEvents(mappedEvents);
      if (agent) {
        agent.setMessages(messages);
        agent.setState(snapshot || {});
      }
      } catch (error) {
        setConnection("error");
        console.warn("Failed to load session detail", error);
      }
    },
    [agent, userId]
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
        setConnection("connecting");
        await agent.runAgent({ runId: randomUUID(), threadId: resolvedThreadId });
        await loadSessions();
      } catch (error) {
        setConnection("error");
        console.warn("Failed to submit HITL response", error);
      }
    },
    [agent, loadSessions, resolvedThreadId, sessionId]
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
    agent.addMessage({
      id: messageId,
      role: "user",
      content: inputValue.trim(),
    });
    setInputValue("");
    try {
      setConnection("connecting");
      await agent.runAgent({ runId: randomUUID(), threadId: resolvedThreadId });
      await loadSessions();
    } catch (error) {
      setConnection("error");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessionDetail(sessionId);
  }, [sessionId, agent, loadSessionDetail]);

  const agentMessages = useMemo(() => {
    return agent ? (agent.messages as Message[]) : [];
  }, [agent]);
  const agentSnapshot = useMemo(() => {
    return agent ? (agent.state as Record<string, unknown>) : null;
  }, [agent]);
  const chatMessages = useMemo(() => mapMessagesToChat(agentMessages), [agentMessages]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Header title={activeSession?.label || "未选择会话"} connection={connection} onNewSession={startNewSession} />

      <div className="grid min-h-[calc(100vh-72px)] grid-cols-12 gap-0">
        <SessionList sessions={sessions} activeId={sessionId} onSelect={setSessionId} />

        <main className="col-span-7 border-r border-zinc-200 bg-zinc-50 p-6">
          <ChatStream messages={chatMessages} />
          <Composer
            value={inputValue}
            onChange={setInputValue}
            onSend={sendInput}
            disabled={!sessionId || connection === "streaming" || pendingConfirmations > 0}
          />
        </main>

        <aside className="col-span-3 bg-white p-6">
          <StateSnapshot snapshot={agentSnapshot} />
          <EventTimeline events={timelineItems} />
        </aside>
      </div>
    </div>
  );
}

export default function Home() {
  const [userId] = useState(DEFAULT_USER_ID);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const [agent, setAgent] = useState(() => {
    const initialSession = "pending";
    return new HttpAgent({
      url: buildAgentUrl(initialSession, userId),
      headers: {
        "X-Session-ID": initialSession,
        "X-User-ID": userId,
      },
      threadId: initialSession,
    });
  });

  useEffect(() => {
    const resolvedSession = sessionId || "pending";
    setAgent(
      new HttpAgent({
        url: buildAgentUrl(resolvedSession, userId),
        headers: {
          "X-Session-ID": resolvedSession,
          "X-User-ID": userId,
        },
        threadId: resolvedSession,
      })
    );
  }, [sessionId, userId]);

  const copilotAgents = useMemo(() => ({ [AGENT_ID]: agent }), [agent]);

  return (
    <CopilotKitProvider
      agents__unsafe_dev_only={copilotAgents}
      showDevConsole="auto"
    >
      <HomeBody
        sessionId={sessionId}
        userId={userId}
        setSessionId={setSessionId}
        sessions={sessions}
        setSessions={setSessions}
      />
    </CopilotKitProvider>
  );
}
