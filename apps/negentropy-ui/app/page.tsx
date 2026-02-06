"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CopilotKitProvider,
  UseAgentUpdate,
  useAgent,
} from "@copilotkitnext/react";
import { HttpAgent, compactEvents, randomUUID } from "@ag-ui/client";
import { BaseEvent, EventType, Message } from "@ag-ui/core";

import { ChatStream } from "../components/ui/ChatStream";
import { Composer } from "../components/ui/Composer";
import { EventTimeline, TimelineItem } from "../components/ui/EventTimeline";
import { SiteHeader } from "../components/layout/SiteHeader";
import { useAuth } from "../components/providers/AuthProvider";
import { LogBufferPanel } from "../components/ui/LogBufferPanel";
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";
import { ConfirmationToolCard } from "../components/ui/ConfirmationToolCard";
import {
  AdkEventPayload,
  adkEventToAguiEvents,
  adkEventsToMessages,
  adkEventsToSnapshot,
} from "@/lib/adk";

// 提取的 Hooks
import { useSessionManager } from "@/hooks/useSessionManager";
import { useEventProcessor } from "@/hooks/useEventProcessor";
import { useUIState } from "@/hooks/useUIState";
import { useConfirmationTool, type ConfirmationToolArgs } from "@/hooks/useConfirmationTool";

// 提取的工具函数
import { createSessionLabel, buildAgentUrl } from "@/utils/session";
import {
  normalizeMessageContent,
  mapMessagesToChat,
  mergeAdjacentAssistant,
  buildChatMessagesFromEventsWithFallback,
  ensureUniqueMessageIds,
} from "@/utils/message";
import { buildTimelineItems } from "@/utils/timeline";
import { buildStateSnapshotFromEvents } from "@/utils/state";

// 统一的类型定义
import type {
  ConnectionState,
  SessionRecord,
  LogEntry,
  AuthUser,
  AuthStatus,
  ChatMessage,
} from "@/types/common";

const AGENT_ID = "negentropy";
const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";
const EMPTY_MESSAGES: Message[] = [];

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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );

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

  // Build message-timestamp map from raw events for filtering
  const messageTimestamps = useMemo(() => {
    const timestampMap = new Map<string, number>();

    // Process all TEXT_MESSAGE events to build the map
    rawEvents.forEach((event) => {
      if (
        event.type === EventType.TEXT_MESSAGE_START ||
        event.type === EventType.TEXT_MESSAGE_CONTENT ||
        event.type === EventType.TEXT_MESSAGE_END
      ) {
        const messageId = "messageId" in event ? event.messageId : undefined;
        const timestamp = "timestamp" in event ? event.timestamp : undefined;

        if (messageId && timestamp !== undefined) {
          // Store the timestamp for this message
          if (!timestampMap.has(messageId)) {
            timestampMap.set(messageId, timestamp);
          }
        }
      }
    });

    // Also backfill from sessionMessages for any messages without event timestamps
    sessionMessages.forEach((message) => {
      if (!timestampMap.has(message.id) && message.createdAt) {
        timestampMap.set(message.id, message.createdAt.getTime() / 1000);
      }
    });

    return timestampMap;
  }, [rawEvents, sessionMessages]);

  // Filter events based on selected message timestamp
  const filteredRawEvents = useMemo(() => {
    if (!selectedMessageId) {
      return rawEvents; // Show all events (current behavior)
    }

    const cutoffTimestamp = messageTimestamps.get(selectedMessageId);
    if (cutoffTimestamp === undefined) {
      return rawEvents; // Message not found, show all
    }

    // Filter events to only those before/at the selected message's timestamp
    return rawEvents.filter((event) => {
      const eventTimestamp = event.timestamp || 0;
      return eventTimestamp <= cutoffTimestamp;
    });
  }, [rawEvents, selectedMessageId, messageTimestamps]);

  const compactedEvents = useMemo(
    () => compactEvents(filteredRawEvents),
    [filteredRawEvents],
  );
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

  // Escape key to return to live view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedMessageId) {
        setSelectedMessageId(null);
        setShowRightPanel(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMessageId]);

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
    if (sessionId) {
      updateCurrentSessionTime(sessionId);
    }
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

  /* Refactored: State clearing moved to handleSessionChange to avoid set-state-in-effect */
  const handleSessionChange = useCallback((newId: string | null) => {
    setSessionId(newId);
    if (newId) {
      setSessionMessages([]);
      setOptimisticMessages([]);
      setSessionSnapshot(null);
      setRawEvents([]);
      setLoadedSessionId(null);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    // Only fetch data in effect
    loadSessionDetail(sessionId);
  }, [sessionId, agent, loadSessionDetail]);

  const hasLoadedSession = loadedSessionId === sessionId;

  const agentMessages = agent ? (agent.messages as Message[]) : EMPTY_MESSAGES;
  const agentSnapshot = agent ? (agent.state as Record<string, unknown>) : null;

  /* Removed problematic effect that caused cascading renders:
     useEffect(() => { ... setOptimisticMessages ... }, [agentMessages])
     Instead, we filter optimistic messages during derived state calculation.
  */

  const messagesForRenderBase =
    hasLoadedSession && agentMessages.length > 0
      ? agentMessages
      : sessionMessages;
  const snapshotForRender = hasLoadedSession
    ? (agentSnapshot ?? sessionSnapshot)
    : sessionSnapshot;

  // Reconstruct state snapshot from filtered events for historical viewing
  const historicalSnapshot = useMemo(
    () => buildStateSnapshotFromEvents(filteredRawEvents),
    [filteredRawEvents],
  );

  const snapshotForDisplay = useMemo(() => {
    // If no message selected, use current/live snapshot
    if (!selectedMessageId) {
      return snapshotForRender;
    }
    // Otherwise use reconstructed historical snapshot
    return historicalSnapshot;
  }, [selectedMessageId, snapshotForRender, historicalSnapshot]);

  const mergedMessagesForRender = useMemo(() => {
    const knownIds = new Set(
      messagesForRenderBase
        .filter((message) => normalizeMessageContent(message).trim().length > 0)
        .map((message) => message.id),
    );

    // Filter out optimistic messages that are already in the base messages
    const validOptimistic = optimisticMessages.filter(
      (message) => !knownIds.has(message.id),
    );

    if (validOptimistic.length === 0) {
      return messagesForRenderBase;
    }

    const merged = [...messagesForRenderBase];
    const indexById = new Map<string, number>();
    merged.forEach((message, index) => {
      indexById.set(message.id, index);
    });

    validOptimistic.forEach((message) => {
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
  }, [messagesForRenderBase, optimisticMessages]);

  const mappedMessages = mapMessagesToChat(mergedMessagesForRender);
  const chatMessages = ensureUniqueMessageIds(mappedMessages);

  // Auto-select latest message when sidebar opens
  useEffect(() => {
    if (showRightPanel && !selectedMessageId && chatMessages.length > 0) {
      // Select the most recent message (last in array)
      const latestMessage = chatMessages[chatMessages.length - 1];
      setSelectedMessageId(latestMessage.id);
    }
    // Optional: Clear selection when sidebar closes
    // if (!showRightPanel && selectedMessageId) {
    //   setSelectedMessageId(null);
    // }
  }, [showRightPanel, selectedMessageId, chatMessages]);

  // Filter log entries based on selected message timestamp
  const filteredLogEntries = useMemo(() => {
    if (!selectedMessageId) {
      return logEntries; // Show all logs when no selection
    }

    const cutoffTimestamp = messageTimestamps.get(selectedMessageId);
    if (cutoffTimestamp === undefined) {
      return logEntries; // Message not found, show all
    }

    // LogEntry.timestamp is in milliseconds (Date.now()), event timestamps are seconds
    // Convert cutoff to milliseconds for comparison
    const cutoffMs = cutoffTimestamp * 1000;

    return logEntries.filter((entry) => entry.timestamp <= cutoffMs);
  }, [logEntries, selectedMessageId, messageTimestamps]);

  return (
    <div className="h-full flex flex-col bg-zinc-50 text-zinc-900 overflow-hidden">
      <div className="flex h-full overflow-hidden relative">
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
              onSelect={handleSessionChange}
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
            <ChatStream
              messages={chatMessages}
              selectedMessageId={selectedMessageId}
              onMessageSelect={(id) => {
                if (selectedMessageId === id) {
                  // Toggle off: just deselect
                  setSelectedMessageId(null);
                } else {
                  // Select new message and ensure sidebar is open
                  setSelectedMessageId(id);
                  setShowRightPanel(true);
                }
              }}
            />
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
            {/* Historical view indicator */}
            {selectedMessageId && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-800">
                    历史视图
                  </span>
                  <button
                    onClick={() => {
                      setSelectedMessageId(null);
                      // Sidebar stays open, auto-select will pick latest message
                    }}
                    className="text-xs text-amber-600 hover:text-amber-800 underline"
                  >
                    返回实时
                  </button>
                </div>
                <p className="text-[10px] text-amber-700 mt-1">
                  显示选定消息的观察数据
                </p>
              </div>
            )}

            <StateSnapshot
              snapshot={snapshotForDisplay}
              connection={selectedMessageId ? "idle" : connection}
            />
            <EventTimeline events={timelineItems} />
            <LogBufferPanel
              entries={filteredLogEntries}
              onExport={() => {
                const payload = JSON.stringify(filteredLogEntries, null, 2);
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

  const agent = useMemo(() => {
    if (!user) {
      return null;
    }
    const userId = user.userId;
    const resolvedSession = sessionId || "pending";
    return new HttpAgent({
      url: buildAgentUrl(resolvedSession, userId),
      headers: {
        "X-Session-ID": resolvedSession,
        "X-User-ID": userId,
      },
      threadId: resolvedSession,
    });
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
