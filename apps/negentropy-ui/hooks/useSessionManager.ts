/**
 * 会话管理 Hook
 *
 * 兼容旧调用面的遗留入口。
 *
 * @deprecated 已被 `useSessionListService` 与 `useSessionService` 取代。
 * 新代码不要再依赖该 hook；会话列表能力请改用 `features/session/hooks/useSessionListService.ts`，
 * 会话详情与聊天投影能力请改用 `features/session/hooks/useSessionService.ts`。
 */

import { useState, useCallback } from "react";
import { createSessionLabel, toSessionRecord } from "@/utils/session";
import { HttpAgent } from "@ag-ui/client";
import {
  collectAdkEventPayloads,
  adkEventsToMessages,
  adkEventsToSnapshot,
} from "@/lib/adk";
import type { SessionRecord, ConnectionState } from "@/types/common";

/**
 * @deprecated 已被 `UseSessionListServiceOptions` / `UseSessionServiceOptions` 取代。
 */
export interface UseSessionManagerOptions {
  userId: string;
  appName: string;
  agent?: HttpAgent | null;
  setConnectionWithMetrics?: (state: ConnectionState) => void;
  addLog?: (level: "info" | "warn" | "error", message: string, payload?: Record<string, unknown>) => void;
  onSessionLoaded?: (sessionId: string) => void;
}

/**
 * @deprecated 已被 `UseSessionListServiceReturnValue` / `UseSessionServiceReturnValue` 取代。
 */
export interface UseSessionManagerReturnValue {
  sessions: SessionRecord[];
  loadedSessionId: string | null;
  loadSessions: () => Promise<void>;
  startNewSession: () => Promise<void>;
  loadSessionDetail: (id: string) => Promise<void>;
  updateCurrentSessionTime: (id: string) => void;
  setSessions: React.Dispatch<React.SetStateAction<SessionRecord[]>>;
}

/**
 * @deprecated 已被 `useSessionListService` 与 `useSessionService` 取代。
 */
export function useSessionManager(
  options: UseSessionManagerOptions
): UseSessionManagerReturnValue {
  const { userId, appName, agent, setConnectionWithMetrics, addLog, onSessionLoaded } = options;

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);

  const updateCurrentSessionTime = useCallback((id: string) => {
    setSessions((prev) => {
      const target = prev.find((s) => s.id === id);
      if (!target) return prev;
      const others = prev.filter((s) => s.id !== id);
      const updated = { ...target, lastUpdateTime: Date.now() };
      return [updated, ...others].sort(
        (a, b) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0)
      );
    });
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agui/sessions/list?app_name=${encodeURIComponent(appName)}&user_id=${encodeURIComponent(userId)}`
      );
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        return;
      }
      const nextSessions = payload
        .map(toSessionRecord)
        .sort(
          (a: SessionRecord, b: SessionRecord) =>
            (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0)
        );
      setSessions(nextSessions);
    } catch (error) {
      setConnectionWithMetrics?.("error");
      addLog?.("error", "load_sessions_failed", { message: String(error) });
      console.warn("Failed to load sessions", error);
    }
  }, [appName, userId, setConnectionWithMetrics, addLog]);

  const startNewSession = useCallback(async () => {
    try {
      const response = await fetch("/api/agui/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_name: appName,
          user_id: userId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          addLog?.("warn", "session_not_found", { context: "startNewSession" });
          return;
        }
        return;
      }
      const id = payload.id;
      const label = createSessionLabel(id);
      setSessions((prev) =>
        [{ id, label, lastUpdateTime: payload.lastUpdateTime }, ...prev].sort(
          (a, b) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0)
        )
      );
      onSessionLoaded?.(id);
    } catch (error) {
      setConnectionWithMetrics?.("error");
      addLog?.("error", "create_session_failed", { message: String(error) });
      console.warn("Failed to create session", error);
    }
  }, [appName, userId, setConnectionWithMetrics, addLog, onSessionLoaded]);

  const loadSessionDetail = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/agui/sessions/${encodeURIComponent(id)}?app_name=${encodeURIComponent(
            appName
          )}&user_id=${encodeURIComponent(userId)}`
        );
        const payload = await response.json();
        if (!response.ok) {
          return;
        }
        const { payloads: events, invalidCount } = collectAdkEventPayloads(payload.events);
        const messages = adkEventsToMessages(events);
        const snapshot = adkEventsToSnapshot(events);
        setLoadedSessionId(id);
        if (agent) {
          agent.setMessages(messages);
          agent.setState(snapshot || {});
        }

        addLog?.("info", "session_detail_loaded", {
          sessionId: id,
          messageCount: messages.length,
          invalidEventCount: invalidCount,
        });
      } catch (error) {
        setConnectionWithMetrics?.("error");
        addLog?.("error", "load_session_detail_failed", {
          message: String(error),
        });
        console.warn("Failed to load session detail", error);
      }
    },
    [appName, userId, agent, setConnectionWithMetrics, addLog]
  );

  return {
    sessions,
    loadedSessionId,
    loadSessions,
    startNewSession,
    loadSessionDetail,
    updateCurrentSessionTime,
    setSessions,
  };
}
