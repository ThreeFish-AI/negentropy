"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatStream } from "../components/ui/ChatStream";
import { Composer } from "../components/ui/Composer";
import { EventTimeline } from "../components/ui/EventTimeline";
import { Header } from "../components/ui/Header";
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";

type ConnectionState = "idle" | "connecting" | "streaming" | "retrying" | "error";
type InputState = "ready" | "sending" | "blocked";

type UiMessage = {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
};

type UiEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

type UiState = {
  sessionId: string | null;
  userId: string | null;
  connection: ConnectionState;
  input: InputState;
  messages: UiMessage[];
  events: UiEvent[];
  snapshot: Record<string, unknown> | null;
};

type SessionRecord = {
  id: string;
  label: string;
  lastUpdateTime?: number;
};

type AdkEventPayload = {
  id?: string;
  author?: string;
  timestamp?: number;
  content?: {
    role?: string;
    parts?: Array<{
      text?: string;
      functionCall?: Record<string, unknown>;
      functionResponse?: Record<string, unknown>;
    }>;
  };
  actions?: {
    stateDelta?: Record<string, unknown>;
    artifactDelta?: Record<string, unknown>;
    requestedToolConfirmations?: Record<string, unknown>;
  };
};

function createSessionLabel(id: string) {
  return `Session ${id.slice(0, 8)}`;
}

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";
const DEFAULT_USER_ID = process.env.NEXT_PUBLIC_AGUI_USER_ID || "ui";

export default function Home() {
  const [uiState, setUiState] = useState<UiState>({
    sessionId: null,
    userId: DEFAULT_USER_ID,
    connection: "idle",
    input: "ready",
    messages: [],
    events: [],
    snapshot: null,
  });
  const [inputValue, setInputValue] = useState("");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === uiState.sessionId) || null,
    [sessions, uiState.sessionId]
  );

  const startNewSession = async () => {
    try {
      const response = await fetch("/api/agui/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_name: APP_NAME,
          user_id: uiState.userId || DEFAULT_USER_ID,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        appendEvent({
          id: crypto.randomUUID(),
          type: "SESSION_CREATE_ERROR",
          payload,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const id = payload.id as string;
      const label = createSessionLabel(id);
      setSessions((prev) => [{ id, label, lastUpdateTime: payload.lastUpdateTime }, ...prev]);
      setUiState((prev) => ({
        ...prev,
        sessionId: id,
        connection: "idle",
        messages: [],
        events: [],
        snapshot: null,
      }));
    } catch (error) {
      appendEvent({
        id: crypto.randomUUID(),
        type: "SESSION_CREATE_ERROR",
        payload: { message: String(error) },
        timestamp: new Date().toISOString(),
      });
    }
  };

  const selectSession = (id: string) => {
    setUiState((prev) => ({
      ...prev,
      sessionId: id,
      connection: "idle",
      messages: [],
      events: [],
      snapshot: null,
    }));
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(
        `/api/agui/sessions/list?app_name=${encodeURIComponent(APP_NAME)}&user_id=${encodeURIComponent(
          uiState.userId || DEFAULT_USER_ID
        )}`
      );
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload)) {
        appendEvent({
          id: crypto.randomUUID(),
          type: "SESSION_LIST_ERROR",
          payload,
          timestamp: new Date().toISOString(),
        });
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
      appendEvent({
        id: crypto.randomUUID(),
        type: "SESSION_LIST_ERROR",
        payload: { message: String(error) },
        timestamp: new Date().toISOString(),
      });
    }
  };

  const loadSessionDetail = async (sessionId: string) => {
    try {
      const response = await fetch(
        `/api/agui/sessions/${encodeURIComponent(sessionId)}?app_name=${encodeURIComponent(
          APP_NAME
        )}&user_id=${encodeURIComponent(uiState.userId || DEFAULT_USER_ID)}`
      );
      const payload = await response.json();
      if (!response.ok) {
        appendEvent({
          id: crypto.randomUUID(),
          type: "SESSION_LOAD_ERROR",
          payload,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const events = Array.isArray(payload.events) ? payload.events : [];
      const messages: UiMessage[] = [];
      const timeline: UiEvent[] = [];
      let snapshot: Record<string, unknown> | null = null;

      for (const raw of events) {
        const adkEvent = raw as AdkEventPayload;
        const eventId = adkEvent.id || crypto.randomUUID();
        const timestamp = adkEvent.timestamp
          ? new Date(adkEvent.timestamp * 1000).toISOString()
          : new Date().toISOString();

        timeline.push({
          id: eventId,
          type: "ADK_EVENT",
          payload: adkEvent as unknown as Record<string, unknown>,
          timestamp,
        });

        const parts = adkEvent.content?.parts || [];
        const text = parts.map((part) => part.text || "").join("").trim();
        if (text) {
          messages.push({
            id: eventId,
            role: adkEvent.author === "user" ? "user" : adkEvent.author === "system" ? "system" : "agent",
            content: text,
            timestamp,
          });
        }

        if (adkEvent.actions?.stateDelta) {
          snapshot = { ...(snapshot || {}), ...adkEvent.actions.stateDelta };
        }
      }

      setUiState((prev) => ({
        ...prev,
        sessionId,
        messages,
        events: timeline,
        snapshot,
      }));
    } catch (error) {
      appendEvent({
        id: crypto.randomUUID(),
        type: "SESSION_LOAD_ERROR",
        payload: { message: String(error) },
        timestamp: new Date().toISOString(),
      });
    }
  };

  const appendEvent = (event: UiEvent) => {
    setUiState((prev) => ({
      ...prev,
      events: [...prev.events, event],
    }));
  };

  const appendMessage = (message: UiMessage) => {
    setUiState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  };

  const applySnapshot = (snapshot: Record<string, unknown>) => {
    setUiState((prev) => ({
      ...prev,
      snapshot,
    }));
  };

  const applyDelta = (delta: Record<string, unknown>) => {
    setUiState((prev) => ({
      ...prev,
      snapshot: {
        ...(prev.snapshot || {}),
        ...delta,
      },
    }));
  };

  const handleAguiEvent = (event: UiEvent) => {
    if (!event.type) {
      return;
    }
    appendEvent(event);

    if (event.type === "ADK_EVENT") {
      const payload = event.payload as AdkEventPayload;

      const parts = payload?.content?.parts || [];
      const text = parts.map((part) => part.text || "").join("").trim();
      const role =
        payload?.author === "user" ? "user" : payload?.author === "system" ? "system" : "agent";

      if (text) {
        appendMessage({
          id: event.id,
          role,
          content: text,
          timestamp: event.timestamp,
        });
      }

      if (payload?.actions?.stateDelta) {
        applyDelta(payload.actions.stateDelta);
      }

      if (payload?.actions?.artifactDelta) {
        appendEvent({
          id: `${event.id}-artifact`,
          type: "ARTIFACT_DELTA",
          payload: payload.actions.artifactDelta,
          timestamp: event.timestamp,
        });
      }

      const toolCalls = parts
        .map((part) => part.functionCall)
        .filter(Boolean) as Record<string, unknown>[];
      const toolResponses = parts
        .map((part) => part.functionResponse)
        .filter(Boolean) as Record<string, unknown>[];

      toolCalls.forEach((toolCall) => {
        appendEvent({
          id: crypto.randomUUID(),
          type: "TOOL_CALL",
          payload: toolCall,
          timestamp: event.timestamp,
        });
      });

      toolResponses.forEach((toolResponse) => {
        appendEvent({
          id: crypto.randomUUID(),
          type: "TOOL_RESPONSE",
          payload: toolResponse,
          timestamp: event.timestamp,
        });
      });
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const streamRun = async (inputText: string, requestId: string) => {
    if (!uiState.sessionId) {
      return;
    }
    setUiState((prev) => ({ ...prev, connection: "connecting" }));

    const response = await fetch("/api/agui", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-ID": uiState.sessionId,
        "X-User-ID": uiState.userId || DEFAULT_USER_ID,
      },
      body: JSON.stringify({
        app_name: APP_NAME,
        user_id: uiState.userId || DEFAULT_USER_ID,
        session_id: uiState.sessionId,
        new_message: {
          role: "user",
          parts: [{ text: inputText }],
        },
        streaming: true,
        metadata: {
          client_request_id: requestId,
        },
      }),
    });

    if (!response.ok || !response.body) {
      setUiState((prev) => ({ ...prev, connection: "error" }));
      appendEvent({
        id: crypto.randomUUID(),
        type: "STREAM_ERROR",
        payload: { status: response.status },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setUiState((prev) => ({ ...prev, connection: "streaming" }));

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);
        const lines = chunk.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const jsonText = trimmed.replace(/^data:\\s*/, "");
          if (!jsonText) {
            continue;
          }
          try {
            const parsed = JSON.parse(jsonText) as Record<string, unknown>;
            handleAguiEvent({
              id: (parsed.id as string) || crypto.randomUUID(),
              type: "ADK_EVENT",
              payload: parsed,
              timestamp: parsed.timestamp
                ? new Date(Number(parsed.timestamp) * 1000).toISOString()
                : new Date().toISOString(),
            });
          } catch (error) {
            appendEvent({
              id: crypto.randomUUID(),
              type: "EVENT_PARSE_ERROR",
              payload: { raw: jsonText, message: String(error) },
              timestamp: new Date().toISOString(),
            });
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }

    setUiState((prev) => ({ ...prev, connection: "idle" }));
    await loadSessions();
  };

  const sendInput = async () => {
    if (!uiState.sessionId || !inputValue.trim() || uiState.input !== "ready") {
      return;
    }

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };
    appendMessage(userMessage);
    setInputValue("");
    setUiState((prev) => ({ ...prev, input: "sending" }));

    try {
      await streamRun(userMessage.content, userMessage.id);
    } catch (error) {
      setUiState((prev) => ({ ...prev, connection: "error" }));
      appendEvent({
        id: crypto.randomUUID(),
        type: "STREAM_ERROR",
        payload: { message: String(error) },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setUiState((prev) => ({ ...prev, input: "ready" }));
    }
  };

  useEffect(() => {
    if (!uiState.sessionId) {
      return;
    }
    loadSessionDetail(uiState.sessionId);
  }, [uiState.sessionId]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Header
        title={activeSession?.label || "未选择会话"}
        connection={uiState.connection}
        onNewSession={startNewSession}
      />

      <div className="grid min-h-[calc(100vh-72px)] grid-cols-12 gap-0">
        <SessionList sessions={sessions} activeId={uiState.sessionId} onSelect={selectSession} />

        <main className="col-span-7 border-r border-zinc-200 bg-zinc-50 p-6">
          <ChatStream messages={uiState.messages} />
          <Composer
            value={inputValue}
            onChange={setInputValue}
            onSend={sendInput}
            disabled={!uiState.sessionId || uiState.input !== "ready"}
          />
        </main>

        <aside className="col-span-3 bg-white p-6">
          <StateSnapshot snapshot={uiState.snapshot} />
          <EventTimeline events={uiState.events} />
        </aside>
      </div>
    </div>
  );
}
