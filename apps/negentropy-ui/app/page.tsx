"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CopilotKitProvider,
  UseAgentUpdate,
  useAgent,
} from "@copilotkitnext/react";
import { HttpAgent, randomUUID } from "@ag-ui/client";
import { Message } from "@ag-ui/core";

import { ChatStream } from "../components/ui/ChatStream";
import { Composer } from "../components/ui/Composer";
import { EventTimeline } from "../components/ui/EventTimeline";
import { useAuth } from "../components/providers/AuthProvider";
import { LogBufferPanel } from "../components/ui/LogBufferPanel";
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";
import { CHAT_CONTENT_RAIL_CLASS } from "../components/ui/chat-layout";
import { useSessionService } from "@/features/session/hooks/useSessionService";

import { useConfirmationTool } from "@/hooks/useConfirmationTool";

// 提取的工具函数
import { createSessionLabel, buildAgentUrl, toSessionRecord } from "@/utils/session";
import type { SessionListView } from "@/utils/session";
import { deriveConnectionState } from "@/utils/session-hydration";

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
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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

  const {
    rawEvents,
    snapshotForDisplay,
    conversationTree,
    nodeTimestampIndex,
    timelineItems,
    pendingConfirmations,
    latestRunState,
    appendRealtimeEvent,
    appendOptimisticMessage,
    clearSessionServiceState,
    loadSessionDetail,
    scheduleSessionHydration,
  } = useSessionService({
    sessionId,
    selectedNodeId,
    userId,
    appName: APP_NAME,
    addLog,
    setConnectionWithMetrics,
  });

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) || null,
    [sessions, sessionId],
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
      onEvent: ({ event }) => appendRealtimeEvent(event),
    });

    return () => subscription.unsubscribe();
  }, [agent, appendRealtimeEvent, reportMetric, setConnectionWithMetrics]);

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

  const clearTitleRefreshTimers = useCallback(() => {
    titleRefreshTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    titleRefreshTimersRef.current = [];
  }, []);

  const clearSessionState = useCallback(() => {
    clearTitleRefreshTimers();
    clearSessionServiceState();
    setSelectedNodeId(null);
  }, [clearSessionServiceState, clearTitleRefreshTimers]);

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
        .map(toSessionRecord)
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
    },
    [clearTitleRefreshTimers],
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

    const runId = randomUUID();
    const messageId = crypto.randomUUID();
    const createdAt = new Date();
    const newMessage = {
      id: messageId,
      role: "user",
      content: inputValue.trim(),
      createdAt,
      runId,
      threadId: sessionId,
      streaming: false,
    } as Message;
    // optimistic message 交给 session projection hook 管理，页面不再直接编排 render projection
    appendOptimisticMessage(newMessage);
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
        runId,
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
    void loadSessionDetail(sessionId);
  }, [sessionId, loadSessionDetail]);

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
            />
            <div
              className={`${CHAT_CONTENT_RAIL_CLASS} shrink-0 w-full pt-2 pb-6`}
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
