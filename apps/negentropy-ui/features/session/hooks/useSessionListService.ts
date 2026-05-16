import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ConnectionState, LogEntry, SessionRecord } from "@/types/common";
import { createSessionLabel, toSessionRecord, type SessionListView } from "@/utils/session";

const SESSION_VIEW_QUERY_KEY = "view";
const ARCHIVED_VIEW_VALUE = "archived";

export interface UseSessionListServiceOptions {
  sessionId: string | null;
  userId: string;
  appName: string;
  setSessionId: (id: string | null) => void;
  addLog: (
    level: LogEntry["level"],
    message: string,
    payload?: Record<string, unknown>,
  ) => void;
  setConnectionWithMetrics: (state: ConnectionState) => void;
  onClearActiveSession: () => void;
}

export interface UseSessionListServiceReturnValue {
  sessions: SessionRecord[];
  sessionListView: SessionListView;
  activeSession: SessionRecord | null;
  setSessionListView: (view: SessionListView) => void;
  loadSessions: () => Promise<void>;
  startNewSession: () => Promise<string | null>;
  archiveSession: (id: string) => Promise<void>;
  unarchiveSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  scheduleTitleRefresh: () => void;
  updateCurrentSessionTime: (id: string) => void;
}

export function useSessionListService(
  options: UseSessionListServiceOptions,
): UseSessionListServiceReturnValue {
  const {
    sessionId,
    userId,
    appName,
    setSessionId,
    addLog,
    setConnectionWithMetrics,
    onClearActiveSession,
  } = options;
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // ISSUE-061 v2-D：sessionListView（active / archived）改用 URL 单源派生，
  // 与 sessionId 对齐。刷新 / 复制 URL / 浏览器返回前进后会自然回到目标视图，
  // 也让"分享归档面板"成为可能。
  //
  // ISSUE-062：useSearchParams() 每次 render 返回新引用，直接列入 useCallback
  // deps 会让 setSessionListView 引用持续重建。改用 ``toString()`` 派生的稳定
  // 字符串作为 dep，让 React 用值相等性比较保持 callback 稳定，避免下游
  // useEffect 反复触发与 loadSessions 竞速覆盖 sessionId。
  //
  // ISSUE-088：与 page.tsx 的 setSessionId 同源——Next.js 16.2.3 的
  // useRouter().replace 在「同 pathname、仅 query 变更」场景下会输出
  // __NA:true 的 no-op replaceState，URL 不更新。统一改走
  // window.history.replaceState，由 useSearchParams 监听 history API 重渲染。
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() ?? "";
  const sessionListView: SessionListView =
    new URLSearchParams(queryString).get(SESSION_VIEW_QUERY_KEY) ===
    ARCHIVED_VIEW_VALUE
      ? "archived"
      : "active";
  const setSessionListView = useCallback(
    (view: SessionListView) => {
      const params = new URLSearchParams(queryString);
      if (view === "archived") {
        params.set(SESSION_VIEW_QUERY_KEY, ARCHIVED_VIEW_VALUE);
      } else {
        params.delete(SESSION_VIEW_QUERY_KEY);
      }
      const nextQuery = params.toString();
      const target = nextQuery ? `${pathname}?${nextQuery}` : pathname || "/";
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", target);
      }
    },
    [pathname, queryString],
  );

  const titleRefreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTitleRefreshTimers = useCallback(() => {
    titleRefreshTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    titleRefreshTimersRef.current = [];
  }, []);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) || null,
    [sessionId, sessions],
  );

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/agui/sessions/list?app_name=${encodeURIComponent(appName)}&user_id=${encodeURIComponent(
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
        // ISSUE-063：归档视图 Back → 实时视图后，sessionId 自动切换到新列表
        // 头部时，必须先 clear projection（messages / state / event timeline），
        // 否则前一会话（如归档下选中的 b8676a4a）的内容会残留在主区与右栏，
        // 与 URL 上的 sessionId 不一致。手动点 sidebar 的 selectSession 路径
        // 由 home-body 的 handleSessionChange 已 clear，本路径补齐对称行为。
        onClearActiveSession();
        setSessionId(nextSessions[0]?.id ?? null);
      } else if (!sessionId && nextSessions.length > 0) {
        setSessionId(nextSessions[0]!.id);
      }
    } catch (error) {
      setConnectionWithMetrics("error");
      addLog("error", "load_sessions_failed", { message: String(error) });
      console.warn("Failed to load sessions", error);
    }
  }, [
    addLog,
    appName,
    onClearActiveSession,
    sessionId,
    sessionListView,
    setConnectionWithMetrics,
    setSessionId,
    userId,
  ]);

  const updateCurrentSessionTime = useCallback((id: string) => {
    setSessions((prev) => {
      const target = prev.find((session) => session.id === id);
      if (!target) {
        return prev;
      }
      const others = prev.filter((session) => session.id !== id);
      const updated = { ...target, lastUpdateTime: Date.now() };
      return [updated, ...others].sort(
        (a, b) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0),
      );
    });
  }, []);

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
              app_name: appName,
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
          onClearActiveSession();
        }

        addLog("info", "session_archived", { sessionId: id });
      } catch (error) {
        addLog("error", "archive_session_failed", {
          message: String(error),
          sessionId: id,
        });
      }
    },
    [addLog, appName, onClearActiveSession, sessionId, setSessionId, userId],
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
              app_name: appName,
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
          onClearActiveSession();
        }

        addLog("info", "session_unarchived", { sessionId: id });
      } catch (error) {
        addLog("error", "unarchive_session_failed", {
          message: String(error),
          sessionId: id,
        });
      }
    },
    [addLog, appName, onClearActiveSession, sessionId, setSessionId, userId],
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
              app_name: appName,
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
    [addLog, appName, loadSessions, userId],
  );

  const startNewSession = useCallback(async (): Promise<string | null> => {
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
          addLog("warn", "session_not_found", { context: "startNewSession" });
        }
        return null;
      }
      const id = payload.id;
      const label = createSessionLabel(id);
      setSessions((prev) =>
        [{ id, label, lastUpdateTime: payload.lastUpdateTime }, ...prev].sort(
          (a, b) => (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0),
        ),
      );
      onClearActiveSession();
      setSessionId(id);
      return id;
    } catch (error) {
      setConnectionWithMetrics("error");
      addLog("error", "create_session_failed", { message: String(error) });
      console.warn("Failed to create session", error);
      return null;
    }
  }, [addLog, appName, onClearActiveSession, setConnectionWithMetrics, setSessionId, userId]);

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

  useEffect(
    () => () => {
      clearTitleRefreshTimers();
    },
    [clearTitleRefreshTimers],
  );

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return {
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
  };
}
