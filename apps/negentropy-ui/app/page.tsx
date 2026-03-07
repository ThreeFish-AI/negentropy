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
import { EventTimeline } from "../components/ui/EventTimeline";
import { useAuth } from "../components/providers/AuthProvider";
import { LogBufferPanel } from "../components/ui/LogBufferPanel";
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";
import { AdkEventPayload } from "@/lib/adk";

import { useConfirmationTool } from "@/hooks/useConfirmationTool";

// 提取的工具函数
import { createSessionLabel, buildAgentUrl } from "@/utils/session";
import type { SessionListView } from "@/utils/session";
import {
  normalizeMessageContent,
} from "@/utils/message";
import { buildTimelineItems } from "@/utils/timeline";
import { buildStateSnapshotFromEvents } from "@/utils/state";
import {
  buildConversationTree,
  buildNodeTimestampIndex,
} from "@/utils/conversation-tree";
import {
  deriveConnectionState,
  deriveRunStates,
  hydrateSessionDetail,
  mergeEvents,
  mergeMessages,
} from "@/utils/session-hydration";

// 统一的类型定义
import type {
  ConnectionState,
  SessionRecord,
  LogEntry,
} from "@/types/common";

const AGENT_ID = "negentropy";
const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

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
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [sessionListView, setSessionListView] = useState<SessionListView>("active");
  const metricsRef = useRef({
    runCount: 0,
    errorCount: 0,
    reconnectCount: 0,
    lastRunStartedAt: 0,
    lastRunMs: 0,
  });
  const titleRefreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hydrationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);
  const rawEventsRef = useRef<BaseEvent[]>([]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) || null,
    [sessions, sessionId],
  );

  useEffect(() => {
    loadedSessionIdRef.current = loadedSessionId;
  }, [loadedSessionId]);

  useEffect(() => {
    rawEventsRef.current = rawEvents;
  }, [rawEvents]);

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
          const next = mergeEvents(prev, [event]);
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
        "toolCallName" in event &&
        "toolCallId" in event &&
        event.toolCallName === "ui.confirmation"
      ) {
        pending.add(String(event.toolCallId));
      }
      if (event.type === EventType.TOOL_CALL_RESULT && "toolCallId" in event) {
        pending.delete(String(event.toolCallId));
      }
    });
    return pending.size;
  }, [rawEvents]);

  const derivedRunStates = useMemo(() => deriveRunStates(rawEvents), [rawEvents]);
  const latestRunState = useMemo(
    () => derivedRunStates[derivedRunStates.length - 1] || null,
    [derivedRunStates],
  );
  const effectiveConnection = useMemo(() => {
    const derived = deriveConnectionState(rawEvents);
    if (derived === "blocked" || derived === "error") {
      return derived;
    }
    if (connection === "connecting" || connection === "streaming") {
      return connection;
    }
    if (connection === "error") {
      return connection;
    }
    if (connection === "idle" && derived === "streaming") {
      return "idle";
    }
    return derived;
  }, [connection, rawEvents]);

  // 根据选中的节点时间范围过滤事件，右侧保持历史视图能力
  const nodeTimestampIndex = useMemo(() => {
    const merged = [...sessionMessages, ...optimisticMessages];
    return buildNodeTimestampIndex(
      buildConversationTree({
        events: rawEvents,
        fallbackMessages: merged,
      }),
    );
  }, [optimisticMessages, rawEvents, sessionMessages]);

  const filteredRawEvents = useMemo(() => {
    if (!selectedNodeId) {
      return rawEvents;
    }

    const cutoffTimestamp = nodeTimestampIndex.get(selectedNodeId);
    if (cutoffTimestamp === undefined) {
      return rawEvents;
    }

    return rawEvents.filter((event) => {
      const eventTimestamp = event.timestamp || 0;
      return eventTimestamp <= cutoffTimestamp;
    });
  }, [nodeTimestampIndex, rawEvents, selectedNodeId]);

  const compactedEvents = useMemo(
    () => compactEvents(filteredRawEvents),
    [filteredRawEvents],
  );
  const timelineItems = useMemo(
    () => buildTimelineItems(compactedEvents),
    [compactedEvents],
  );

  const clearTitleRefreshTimers = useCallback(() => {
    titleRefreshTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    titleRefreshTimersRef.current = [];
  }, []);

  const clearHydrationTimers = useCallback(() => {
    hydrationTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    hydrationTimersRef.current = [];
  }, []);

  const clearSessionState = useCallback(() => {
    clearHydrationTimers();
    clearTitleRefreshTimers();
    setSessionMessages([]);
    setOptimisticMessages([]);
    setSessionSnapshot(null);
    setRawEvents([]);
    setLoadedSessionId(null);
    setSelectedNodeId(null);
  }, [clearHydrationTimers, clearTitleRefreshTimers]);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agui/sessions/list?app_name=${encodeURIComponent(APP_NAME)}&user_id=${encodeURIComponent(
          userId,
        )}&archived=${sessionListView === "archived" ? "true" : "false"}`,
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
            state?: { metadata?: { title?: string; archived?: boolean } };
          }) => ({
            id: session.id,
            label:
              session.state?.metadata?.title || createSessionLabel(session.id),
            lastUpdateTime: session.lastUpdateTime,
            archived: session.state?.metadata?.archived === true,
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
  }, [addLog, sessionId, sessionListView, setConnectionWithMetrics, setSessionId, setSessions, userId]);

  const archiveSession = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/agui/sessions/${encodeURIComponent(id)}/archive`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_name: APP_NAME,
              user_id: userId,
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error?.message || "archive_session_failed");
        }

        let nextActiveId: string | null = null;
        setSessions((prev) => {
          const next = prev.filter((session) => session.id !== id);
          nextActiveId = next[0]?.id ?? null;
          return next;
        });

        if (sessionId === id) {
          setSessionId(nextActiveId);
          clearSessionState();
        }

        addLog("info", "session_archived", { sessionId: id });
      } catch (error) {
        addLog("error", "archive_session_failed", {
          message: String(error),
          sessionId: id,
        });
      }
    },
    [addLog, clearSessionState, sessionId, setSessionId, setSessions, userId],
  );

  const unarchiveSession = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/agui/sessions/${encodeURIComponent(id)}/unarchive`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_name: APP_NAME,
              user_id: userId,
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error?.message || "unarchive_session_failed");
        }

        let nextActiveId: string | null = null;
        setSessions((prev) => {
          const next = prev.filter((session) => session.id !== id);
          nextActiveId = next[0]?.id ?? null;
          return next;
        });
        if (sessionId === id) {
          setSessionId(nextActiveId);
          clearSessionState();
        }
        addLog("info", "session_unarchived", { sessionId: id });
      } catch (error) {
        addLog("error", "unarchive_session_failed", {
          message: String(error),
          sessionId: id,
        });
      }
    },
    [addLog, clearSessionState, sessionId, setSessionId, setSessions, userId],
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      const cleanedTitle = title.trim();
      let previousLabel: string | null = null;

      setSessions((prev) => {
        const target = prev.find((session) => session.id === id);
        previousLabel = target?.label ?? null;
        return prev.map((session) =>
          session.id === id
            ? {
                ...session,
                label: cleanedTitle || createSessionLabel(id),
              }
            : session,
        );
      });

      try {
        const response = await fetch(
          `/api/agui/sessions/${encodeURIComponent(id)}/title`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_name: APP_NAME,
              user_id: userId,
              title: cleanedTitle || null,
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload?.error?.message || "update_session_title_failed",
          );
        }
        await loadSessions();
      } catch (error) {
        if (previousLabel !== null) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === id
                ? { ...session, label: previousLabel as string }
                : session,
            ),
          );
        }
        addLog("error", "update_session_title_failed", {
          message: String(error),
          sessionId: id,
        });
      }
    },
    [addLog, createSessionLabel, loadSessions, setSessions, userId],
  );

  useEffect(
    () => () => {
      clearTitleRefreshTimers();
      clearHydrationTimers();
    },
    [clearHydrationTimers, clearTitleRefreshTimers],
  );

  const scheduleTitleRefresh = useCallback(() => {
    clearTitleRefreshTimers();
    const delays = [800, 1600, 3000];
    delays.forEach((delay) => {
      const timer = setTimeout(() => {
        void loadSessions();
      }, delay);
      titleRefreshTimersRef.current.push(timer);
    });
  }, [clearTitleRefreshTimers, loadSessions]);

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
          addLog("warn", "session_not_found", { context: "startNewSession" });
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
        const hydrated = hydrateSessionDetail(events, id);
        const currentLoadedSessionId = loadedSessionIdRef.current;
        const currentRawEvents = rawEventsRef.current;

        setRawEvents((prev) => {
          const shouldMerge =
            currentLoadedSessionId === id ||
            (sessionId === id && currentRawEvents.length > 0);
          return shouldMerge ? mergeEvents(prev, hydrated.events) : hydrated.events;
        });
        setSessionMessages((prev) => {
          const shouldMerge =
            currentLoadedSessionId === id ||
            (sessionId === id && currentRawEvents.length > 0);
          return shouldMerge
            ? mergeMessages(prev, hydrated.messages)
            : hydrated.messages;
        });
        setSessionSnapshot((prev) =>
          currentLoadedSessionId === id ||
          (sessionId === id && currentRawEvents.length > 0)
            ? (hydrated.snapshot ?? prev)
            : hydrated.snapshot,
        );
        setLoadedSessionId(id);
      } catch (error) {
        setConnectionWithMetrics("error");
        addLog("error", "load_session_detail_failed", {
          message: String(error),
        });
        console.warn("Failed to load session detail", error);
      }
    },
    [
      userId,
      setConnectionWithMetrics,
      addLog,
      sessionId,
    ],
  );

  const scheduleSessionHydration = useCallback(
    (id: string) => {
      clearHydrationTimers();
      const delays = [0, 250, 800, 1600];
      delays.forEach((delay) => {
        const timer = setTimeout(() => {
          void loadSessionDetail(id);
        }, delay);
        hydrationTimersRef.current.push(timer);
      });
    },
    [clearHydrationTimers, loadSessionDetail],
  );

  const handleConfirmationFollowup = useCallback(
    async (payload: { action: string; note: string }) => {
      if (
        !agent ||
        !sessionId ||
        agent.isRunning ||
        effectiveConnection === "streaming" ||
        effectiveConnection === "connecting"
      ) {
        return;
      }
      const followupMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: `HITL:${payload.action} ${payload.note || ""}`.trim(),
      };
      agent.addMessage(followupMessage);
      try {
        setConnectionWithMetrics("connecting");
        await agent.runAgent({
          runId: randomUUID(),
        });
        scheduleSessionHydration(sessionId);
        await loadSessions();
      } catch (error) {
        setConnectionWithMetrics("error");
        addLog("error", "hitl_submit_failed", { message: String(error) });
        console.warn("Failed to submit HITL response", error);
      }
    },
    [
      agent,
      addLog,
      effectiveConnection,
      loadSessions,
      scheduleSessionHydration,
      sessionId,
      setConnectionWithMetrics,
    ],
  );

  useConfirmationTool(handleConfirmationFollowup);

  // Escape key to return to live view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedNodeId) {
        setSelectedNodeId(null);
        setShowRightPanel(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId]);

  const sendInput = async () => {
    if (!agent || !sessionId || !inputValue.trim()) {
      return;
    }
    if (
      pendingConfirmations > 0 ||
      effectiveConnection === "streaming" ||
      effectiveConnection === "connecting" ||
      effectiveConnection === "blocked"
    ) {
      return;
    }

    const messageId = crypto.randomUUID();
    const newMessage = {
      id: messageId,
      role: "user",
      content: inputValue.trim(),
    } as Message;
    // 仅使用 optimisticMessages 进行乐观更新，不再向 rawEvents 添加乐观事件
    // 避免消息在 buildChatMessagesFromEventsWithFallback 中重复
    setOptimisticMessages((prev) => [...prev, newMessage]);
    agent.addMessage(newMessage);
    setInputValue("");
    if (sessionId) {
      updateCurrentSessionTime(sessionId);
    }
    const shouldPollTitle =
      !!sessionId &&
      (!activeSession || activeSession.label === createSessionLabel(sessionId));
    try {
      setConnectionWithMetrics("connecting");
      await agent.runAgent({
        runId: randomUUID(),
      });
      scheduleSessionHydration(sessionId);
      await loadSessions();
      if (shouldPollTitle) {
        scheduleTitleRefresh();
      }
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
    clearSessionState();
  }, [clearSessionState, setSessionId]);

  const handleSessionListViewChange = useCallback((nextView: SessionListView) => {
    setSessionListView(nextView);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    // Only fetch data in effect
    loadSessionDetail(sessionId);
  }, [sessionId, agent, loadSessionDetail]);

  const hasLoadedSession = loadedSessionId === sessionId;
  const messagesForRenderBase = hasLoadedSession ? sessionMessages : [];
  const snapshotForRender = hasLoadedSession ? sessionSnapshot : null;

  // Reconstruct state snapshot from filtered events for historical viewing
  const historicalSnapshot = useMemo(
    () => buildStateSnapshotFromEvents(filteredRawEvents),
    [filteredRawEvents],
  );

  const snapshotForDisplay = useMemo(() => {
    if (!selectedNodeId) {
      return snapshotForRender;
    }
    return historicalSnapshot;
  }, [selectedNodeId, snapshotForRender, historicalSnapshot]);

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
        merged[index] = {
          ...existing,
          content: normalizeMessageContent(message),
        } as Message;
      }
    });
    return merged;
  }, [messagesForRenderBase, optimisticMessages]);

  const conversationTree = useMemo(
    () =>
      buildConversationTree({
        events: rawEvents,
        fallbackMessages: mergedMessagesForRender,
      }),
    [mergedMessagesForRender, rawEvents],
  );

  // Filter log entries based on selected message timestamp
  const filteredLogEntries = useMemo(() => {
    if (!selectedNodeId) {
      return logEntries;
    }

    const cutoffTimestamp = nodeTimestampIndex.get(selectedNodeId);
    if (cutoffTimestamp === undefined) {
      return logEntries;
    }

    const cutoffMs = cutoffTimestamp * 1000;

    return logEntries.filter((entry) => entry.timestamp <= cutoffMs);
  }, [logEntries, nodeTimestampIndex, selectedNodeId]);

  const contentWidthClass = "max-w-4xl";

  return (
    <div className="h-full flex flex-col bg-zinc-50 text-zinc-900 overflow-hidden dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex h-full overflow-hidden relative">
        {/* Left Sidebar: Session List */}
        <div
          className={`shrink-0 h-full border-r border-zinc-200 bg-white transition-all duration-300 ease-in-out overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 ${
            showLeftPanel
              ? "w-64 translate-x-0 opacity-100"
              : "w-0 -translate-x-10 opacity-0"
          }`}
        >
          <div className="w-64 h-full overflow-hidden flex flex-col">
            <SessionList
              sessions={sessions}
              activeId={sessionId}
              view={sessionListView}
              onSwitchView={handleSessionListViewChange}
              onSelect={handleSessionChange}
              onNewSession={startNewSession}
              onRename={renameSession}
              onArchive={archiveSession}
              onUnarchive={unarchiveSession}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-zinc-50 relative overflow-hidden transition-all duration-300 dark:bg-zinc-950">
          {/* Internal Toolbar for Toggles */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-200/50 bg-white/50 backdrop-blur-sm z-10 w-full dark:border-zinc-700/50 dark:bg-zinc-900/50">
            <button
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-700/80"
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

            <div className="text-xs font-medium text-zinc-400 max-w-md truncate mx-4 dark:text-zinc-500">
              {activeSession
                ? `${activeSession.label}${latestRunState?.status === "blocked" ? " · 等待确认" : ""}`
                : "Negentropy"}
            </div>

            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-700/80"
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
              nodes={conversationTree.roots}
              selectedNodeId={selectedNodeId}
              onNodeSelect={(id) => {
                if (!showRightPanel) {
                  return;
                }
                if (selectedNodeId === id) {
                  setSelectedNodeId(null);
                } else {
                  setSelectedNodeId(id);
                }
              }}
              contentClassName={contentWidthClass}
            />
            <div
              className={`p-6 pt-2 shrink-0 w-full mx-auto ${contentWidthClass}`}
            >
              <Composer
                value={inputValue}
                onChange={setInputValue}
                onSend={sendInput}
                isGenerating={effectiveConnection === "streaming"}
                isBlocked={effectiveConnection === "blocked"}
                disabled={
                  !sessionId ||
                  effectiveConnection === "streaming" ||
                  effectiveConnection === "connecting" ||
                  effectiveConnection === "blocked" ||
                  pendingConfirmations > 0
                }
              />
            </div>
          </div>
        </main>

        {/* Right Sidebar: Timeline & Logs */}
        <div
          className={`shrink-0 h-full border-l border-zinc-200 bg-white transition-all duration-300 ease-in-out overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 ${
            showRightPanel
              ? "w-80 translate-x-0 opacity-100"
              : "w-0 translate-x-10 opacity-0"
          }`}
        >
          <div className="w-80 h-full overflow-y-auto p-6">
            {/* View mode indicator + minimal interaction hint */}
            {selectedNodeId ? (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:border-amber-800 dark:bg-amber-950/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    历史视图
                  </span>
                  <button
                    onClick={() => {
                      setSelectedNodeId(null);
                    }}
                    className="text-xs text-amber-600 hover:text-amber-800 underline dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    返回实时
                  </button>
                </div>
                <p className="text-[10px] text-amber-700 mt-1 dark:text-amber-300">
                  显示选定消息的观察数据
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    实时视图
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 dark:text-zinc-400">
                  点击任意消息进入历史视图，再次点击或点“返回实时”回到实时
                </p>
              </div>
            )}

            <StateSnapshot
              snapshot={snapshotForDisplay}
              connection={selectedNodeId ? "idle" : effectiveConnection}
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
      url: buildAgentUrl(resolvedSession, userId, APP_NAME),
      headers: {
        "X-Session-ID": resolvedSession,
        "X-User-ID": userId,
      },
      threadId: resolvedSession,
    });
  }, [sessionId, user]);

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        正在验证登录状态...
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 text-center dark:bg-zinc-950">
        <div className="max-w-md space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Negentropy UI
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            需要登录以继续
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            使用 Google OAuth 进行单点登录。
          </p>
        </div>
        <button
          className="rounded-full bg-black px-6 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        正在初始化 Agent...
      </div>
    );
  }

  const copilotAgents = { [AGENT_ID]: agent };

  return (
    <CopilotKitProvider
      agents__unsafe_dev_only={copilotAgents}
      showDevConsole="auto"
    >
      <HomeBody
        sessionId={sessionId}
        userId={user.userId}
        setSessionId={setSessionId}
        sessions={sessions}
        setSessions={setSessions}
      />
    </CopilotKitProvider>
  );
}
