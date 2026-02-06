/**
 * 会话管理 Hook
 *
 * 从 app/page.tsx HomeBody 组件提取的会话管理逻辑
 *
 * 职责：
 * - 会话列表管理
 * - 会话创建
 * - 会话详情加载
 * - 当前会话追踪
 */

import { useState, useCallback } from "react";
import { createSessionLabel } from "@/utils/session";
import { HttpAgent } from "@ag-ui/client";
import { Message } from "@ag-ui/core";
import {
  AdkEventPayload,
  adkEventToAguiEvents,
  adkEventsToMessages,
  adkEventsToSnapshot,
} from "@/lib/adk";
import type { SessionRecord, ConnectionState } from "@/types/common";

export interface UseSessionManagerOptions {
  userId: string;
  appName: string;
  agent?: HttpAgent | null;
  setConnectionWithMetrics?: (state: ConnectionState) => void;
  addLog?: (level: "info" | "warn" | "error", message: string, payload?: Record<string, unknown>) => void;
  onSessionLoaded?: (sessionId: string) => void;
}

export interface UseSessionManagerReturnValue {
  sessions: SessionRecord[];
  loadedSessionId: string | null;
  loadSessions: () => Promise<void>;
  startNewSession: () => Promise<void>;
  loadSessionDetail: (id: string) => Promise<void>;
  updateCurrentSessionTime: (id: string) => void;
  setSessions: React.Dispatch<React.SetStateAction<SessionRecord[]>>;
}

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
        .map(
          (session: {
            id: string;
            lastUpdateTime?: number;
            state?: { metadata?: { title?: string } };
          }) => ({
            id: session.id,
            label: session.state?.metadata?.title || createSessionLabel(session.id),
            lastUpdateTime: session.lastUpdateTime,
          })
        )
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
        const events = (Array.isArray(payload.events)
          ? (payload.events as AdkEventPayload[])
          : []) as AdkEventPayload[];
        const messages = adkEventsToMessages(events);
        const snapshot = adkEventsToSnapshot(events);
        const mappedEvents = events.flatMap(adkEventToAguiEvents);

        setLoadedSessionId(id);
        if (agent) {
          agent.setMessages(messages);
          agent.setState(snapshot || {});
        }

        addLog?.("info", "session_detail_loaded", { sessionId: id, messageCount: messages.length });
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
