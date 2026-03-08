import { useCallback, useEffect, useRef } from "react";
import { EventType } from "@ag-ui/core";
import type { ConnectionState, LogEntry } from "@/types/common";
import { collectAdkEventPayloads } from "@/lib/adk";
import { useSessionProjection, type UseSessionProjectionReturnValue } from "@/features/session/hooks/useSessionProjection";
import { hydrateSessionDetail } from "@/utils/session-hydration";

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

export interface UseSessionServiceReturnValue extends UseSessionProjectionReturnValue {
  loadSessionDetail: (id: string) => Promise<void>;
  scheduleSessionHydration: (id: string) => void;
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

  activeSessionIdRef.current = sessionId;

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
      sessionId,
      setConnectionWithMetrics,
      userId,
    ],
  );

  const scheduleSessionHydration = useCallback(
    (id: string) => {
      clearHydrationTimers();
      const hasLiveAssistantOutput = rawEventsRef.current.some(
        (event) =>
          event.type === EventType.TEXT_MESSAGE_CONTENT &&
          "threadId" in event &&
          event.threadId === id,
      );
      const delays = hasLiveAssistantOutput ? [1200, 2800] : [0, 250, 800, 1600];
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
    clearSessionProjection();
  }, [clearHydrationTimers, clearSessionProjection]);

  return {
    ...projection,
    loadSessionDetail,
    scheduleSessionHydration,
    clearSessionServiceState,
  };
}
