"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UseAgentUpdate, useAgent } from "@copilotkitnext/react";
import { randomUUID } from "@ag-ui/client";
import { EventType, Message, type BaseEvent } from "@ag-ui/core";

import { ChatStream } from "../components/ui/ChatStream";
import { Composer } from "../components/ui/Composer";
import { EventTimeline } from "../components/ui/EventTimeline";
import { LogBufferPanel } from "../components/ui/LogBufferPanel";
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";
import { CHAT_CONTENT_RAIL_CLASS } from "../components/ui/chat-layout";
import { useSessionListService } from "@/features/session/hooks/useSessionListService";
import { useSessionService } from "@/features/session/hooks/useSessionService";

import { useAgentSubscription } from "@/hooks/useAgentSubscription";
import { useConfirmationTool } from "@/hooks/useConfirmationTool";

// 提取的工具函数
import { createSessionLabel } from "@/utils/session";
import { deriveConnectionState } from "@/utils/session-hydration";

// 统一的类型定义
import type {
  ConnectionState,
  LogEntry,
} from "@/types/common";

export const AGENT_ID = "negentropy";
export const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

export function HomeBody({
  sessionId,
  userId,
  setSessionId,
}: {
  sessionId: string | null;
  userId: string;
  setSessionId: (id: string | null) => void;
}) {
  const { agent } = useAgent({
    agentId: AGENT_ID,
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnStateChanged],
  });
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);
  const rawEventHandlerRef = useRef<((event: BaseEvent) => void) | undefined>(
    undefined,
  );
  const updateSessionTimeRef = useRef<
    ((currentSessionId: string) => void) | undefined
  >(undefined);
  const pendingSendRef = useRef<string | null>(null);
  const pendingForSessionRef = useRef<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

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
      addLog("info", name, payload);
    },
    [addLog],
  );

  const { setConnectionWithMetrics } = useAgentSubscription({
    agent,
    sessionId,
    onRawEvent: (event) => rawEventHandlerRef.current?.(event),
    onConnectionChange: setConnection,
    onMetricReport: reportMetric,
    onUpdateSessionTime: (currentSessionId) =>
      updateSessionTimeRef.current?.(currentSessionId),
  });

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

  const resetActiveSessionView = useCallback(() => {
    clearSessionServiceState();
    setSelectedNodeId(null);
  }, [clearSessionServiceState]);

  const {
    sessions,
    sessionListView,
    activeSession,
    setSessionListView,
    loadSessions,
    startNewSession,
    archiveSession,
    unarchiveSession,
    renameSession,
    scheduleTitleRefresh,
    updateCurrentSessionTime,
  } = useSessionListService({
    sessionId,
    userId,
    appName: APP_NAME,
    setSessionId,
    addLog,
    setConnectionWithMetrics,
    onClearActiveSession: resetActiveSessionView,
  });

  useEffect(() => {
    rawEventHandlerRef.current = (event) => {
      appendRealtimeEvent(event);
      if (
        sessionId &&
        (event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR)
      ) {
        scheduleSessionHydration(sessionId, {
          reason: "run_terminal",
          runId:
            "runId" in event && typeof event.runId === "string"
              ? event.runId
              : undefined,
        });
      }
    };
    updateSessionTimeRef.current = updateCurrentSessionTime;
  }, [
    appendRealtimeEvent,
    scheduleSessionHydration,
    sessionId,
    updateCurrentSessionTime,
  ]);

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

  const clearSessionState = useCallback(() => {
    resetActiveSessionView();
  }, [resetActiveSessionView]);

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

  const doSend = useCallback(
    async (input: string) => {
      if (!agent || !sessionId || !input.trim()) {
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
        content: input.trim(),
        createdAt,
        runId,
        threadId: sessionId,
        streaming: false,
      } as Message;
      appendOptimisticMessage(newMessage);
      agent.addMessage(newMessage);
      setScrollToBottomTrigger((prev) => prev + 1);
      updateCurrentSessionTime(sessionId);
      const shouldPollTitle =
        !activeSession ||
        activeSession.label === createSessionLabel(sessionId);
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
    },
    [
      agent,
      sessionId,
      pendingConfirmations,
      effectiveConnection,
      appendOptimisticMessage,
      updateCurrentSessionTime,
      activeSession,
      setConnectionWithMetrics,
      scheduleSessionHydration,
      loadSessions,
      scheduleTitleRefresh,
      addLog,
    ],
  );

  const sendInput = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
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

    // 无 Session 时自动创建（不需要 agent）
    if (!sessionId) {
      if (isCreatingSession) {
        return;
      }
      pendingSendRef.current = trimmed;
      setInputValue("");
      setScrollToBottomTrigger((prev) => prev + 1);
      setIsCreatingSession(true);
      try {
        const newId = await startNewSession();
        if (newId) {
          pendingForSessionRef.current = newId;
        } else {
          setInputValue(pendingSendRef.current || "");
          pendingSendRef.current = null;
          pendingForSessionRef.current = null;
        }
      } finally {
        setIsCreatingSession(false);
      }
      return;
    }

    if (!agent) {
      return;
    }
    setInputValue("");
    await doSend(trimmed);
  };

  // 新 Session 创建后、Agent 重建完毕，自动发送 pending 消息
  useEffect(() => {
    if (
      !pendingSendRef.current ||
      !pendingForSessionRef.current ||
      !agent ||
      !sessionId
    ) {
      return;
    }
    if (sessionId !== pendingForSessionRef.current) {
      return;
    }
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    pendingForSessionRef.current = null;
    void doSend(pending);
  }, [agent, sessionId, doSend]);

  /* Refactored: State clearing moved to handleSessionChange to avoid set-state-in-effect */
  const handleSessionChange = useCallback((newId: string | null) => {
    setSessionId(newId);
    clearSessionState();
  }, [clearSessionState, setSessionId]);

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
              onSwitchView={setSessionListView}
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
              scrollToBottomTrigger={scrollToBottomTrigger}
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
                  isCreatingSession ||
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
