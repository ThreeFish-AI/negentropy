import { useCallback, useEffect, useRef } from "react";
import { EventType } from "@ag-ui/core";
import type { ConnectionState, LogEntry } from "@/types/common";
import { collectAdkEventPayloads } from "@/lib/adk";
import { useSessionProjection, type UseSessionProjectionReturnValue } from "@/features/session/hooks/useSessionProjection";
import { hydrateSessionDetail } from "@/utils/session-hydration";
import { getEventRunId } from "@/types/agui";

type SessionProjectionPublicApi = Pick<
  UseSessionProjectionReturnValue,
  | "sessionProjection"
  | "rawEvents"
  | "snapshotForDisplay"
  | "confirmedMessageLedger"
  | "messagesForRenderBase"
  | "conversationTree"
  | "nodeTimestampIndex"
  | "timelineItems"
  | "pendingConfirmations"
  | "latestRunState"
  | "appendRealtimeEvent"
  | "appendOptimisticMessage"
>;

export interface UseSessionServiceOptions {
  sessionId: string | null;
  selectedNodeId: string | null;
  userId: string;
  appName: string;
  addLog: (
    level: LogEntry["level"],
    message: string,
    payload?: Record<string, unknown>,
  ) => void;
  setConnectionWithMetrics: (state: ConnectionState) => void;
}

export interface UseSessionServiceReturnValue extends SessionProjectionPublicApi {
  loadSessionDetail: (id: string) => Promise<void>;
  scheduleSessionHydration: (
    id: string,
    options?: {
      reason?: "default" | "run_terminal";
      runId?: string;
    },
  ) => void;
  clearSessionServiceState: () => void;
}

export function useSessionService(
  options: UseSessionServiceOptions,
): UseSessionServiceReturnValue {
  const {
    sessionId,
    selectedNodeId,
    userId,
    appName,
    addLog,
    setConnectionWithMetrics,
  } = options;
  const projection = useSessionProjection({
    sessionId,
    selectedNodeId,
  });
  const {
    applyHydratedSession,
    clearSessionProjection,
    rawEventsRef,
  } = projection;
  const activeSessionIdRef = useRef<string | null>(sessionId);
  const hydrationRequestVersionRef = useRef(0);
  const hydrationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const terminalHydrationTargetsRef = useRef(
    new Map<
      string,
      {
        runId?: string;
        attemptCount: number;
        lastSignature?: string;
        stablePasses: number;
      }
    >(),
  );

  const buildRunHydrationSignature = useCallback(
    (events: UseSessionProjectionReturnValue["rawEvents"], sessionIdValue: string, runId?: string) => {
      const relevant = events.filter((event) => {
        if ("threadId" in event && event.threadId !== sessionIdValue) {
          return false;
        }
        if (runId && getEventRunId(event) !== runId) {
          return false;
        }
        return (
          event.type === EventType.TEXT_MESSAGE_START ||
          event.type === EventType.TEXT_MESSAGE_CONTENT ||
          event.type === EventType.TEXT_MESSAGE_END ||
          event.type === EventType.TOOL_CALL_START ||
          event.type === EventType.TOOL_CALL_RESULT ||
          event.type === EventType.RUN_FINISHED ||
          event.type === EventType.RUN_ERROR
        );
      });
      return JSON.stringify(
        relevant.map((event) => ({
          type: event.type,
          runId: getEventRunId(event) || null,
          timestamp: event.timestamp || null,
          messageId: "messageId" in event ? event.messageId : null,
          toolCallId: "toolCallId" in event ? event.toolCallId : null,
          delta: "delta" in event ? event.delta : null,
          content: "content" in event ? event.content : null,
        })),
      );
    },
    [],
  );

  const clearHydrationTimers = useCallback(() => {
    hydrationTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    hydrationTimersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearHydrationTimers();
    },
    [clearHydrationTimers],
  );

  useEffect(() => {
    activeSessionIdRef.current = sessionId;
  }, [sessionId]);

  const loadSessionDetail = useCallback(
    async (id: string) => {
      const requestVersion = ++hydrationRequestVersionRef.current;
      try {
        const response = await fetch(
          `/api/agui/sessions/${encodeURIComponent(id)}?app_name=${encodeURIComponent(
            appName,
          )}&user_id=${encodeURIComponent(userId)}`,
        );
        const payload = await response.json();
        if (!response.ok) {
          return;
        }
        if (
          hydrationRequestVersionRef.current !== requestVersion ||
          activeSessionIdRef.current !== id
        ) {
          return;
        }
        const { payloads: events, invalidCount } = collectAdkEventPayloads(payload.events);
        if (invalidCount > 0) {
          addLog("warn", "session_detail_events_filtered", {
            sessionId: id,
            invalidCount,
          });
        }
        const hydrated = hydrateSessionDetail(events, id);
        applyHydratedSession({
          sessionId: id,
          detail: hydrated,
          activeSessionId: sessionId,
        });
        const terminalTarget = terminalHydrationTargetsRef.current.get(id);
        if (terminalTarget) {
          const signature = buildRunHydrationSignature(
            hydrated.events,
            id,
            terminalTarget.runId,
          );
          const stablePasses =
            terminalTarget.lastSignature === signature
              ? terminalTarget.stablePasses + 1
              : 0;
          const nextTarget = {
            ...terminalTarget,
            attemptCount: terminalTarget.attemptCount + 1,
            lastSignature: signature,
            stablePasses,
          };
          const hasTerminalEvent = hydrated.events.some(
            (event) =>
              (event.type === EventType.RUN_FINISHED ||
                event.type === EventType.RUN_ERROR) &&
              (!terminalTarget.runId || getEventRunId(event) === terminalTarget.runId) &&
              ("threadId" in event ? event.threadId === id : true),
          );
          if (hasTerminalEvent && stablePasses >= 1) {
            terminalHydrationTargetsRef.current.delete(id);
            clearHydrationTimers();
          } else {
            terminalHydrationTargetsRef.current.set(id, nextTarget);
          }
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
      addLog,
      applyHydratedSession,
      appName,
      buildRunHydrationSignature,
      clearHydrationTimers,
      sessionId,
      setConnectionWithMetrics,
      userId,
    ],
  );

  const scheduleSessionHydration = useCallback(
    (
      id: string,
      options?: {
        reason?: "default" | "run_terminal";
        runId?: string;
      },
    ) => {
      clearHydrationTimers();
      const hasLiveRenderableOutput = rawEventsRef.current.some(
        (event) =>
          (event.type === EventType.TEXT_MESSAGE_CONTENT ||
            event.type === EventType.TOOL_CALL_START ||
            event.type === EventType.TOOL_CALL_RESULT) &&
          "threadId" in event &&
          event.threadId === id,
      );
      const delays =
        options?.reason === "run_terminal"
          ? [0, 400, 1200, 2600, 5000, 8000, 12000]
          : hasLiveRenderableOutput
            ? [200, 900, 2200, 4500]
            : [0, 300, 1000, 2200, 4500];
      if (options?.reason === "run_terminal") {
        terminalHydrationTargetsRef.current.set(id, {
          runId: options.runId,
          attemptCount: 0,
          stablePasses: 0,
        });
      }
      delays.forEach((delay) => {
        const timer = setTimeout(() => {
          void loadSessionDetail(id);
        }, delay);
        hydrationTimersRef.current.push(timer);
      });
    },
    [clearHydrationTimers, loadSessionDetail, rawEventsRef],
  );

  const clearSessionServiceState = useCallback(() => {
    clearHydrationTimers();
    terminalHydrationTargetsRef.current.clear();
    clearSessionProjection();
  }, [clearHydrationTimers, clearSessionProjection]);

  return {
    sessionProjection: projection.sessionProjection,
    rawEvents: projection.rawEvents,
    snapshotForDisplay: projection.snapshotForDisplay,
    confirmedMessageLedger: projection.confirmedMessageLedger,
    messagesForRenderBase: projection.messagesForRenderBase,
    conversationTree: projection.conversationTree,
    nodeTimestampIndex: projection.nodeTimestampIndex,
    timelineItems: projection.timelineItems,
    pendingConfirmations: projection.pendingConfirmations,
    latestRunState: projection.latestRunState,
    appendRealtimeEvent: projection.appendRealtimeEvent,
    appendOptimisticMessage: projection.appendOptimisticMessage,
    loadSessionDetail,
    scheduleSessionHydration,
    clearSessionServiceState,
  };
}
