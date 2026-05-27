"use client";

/**
 * useChatAgent —— wiki ChatFab 的对话状态机。
 *
 * 职责：
 * 1. 维护 messages（用户输入 + Agent 流式回答）
 * 2. 构造 RunAgentInput，调用 NdjsonHttpAgent.runAgent()
 * 3. 把 AGUI 事件流增量映射回 messages（节流 setState）
 * 4. 暴露 send / abort 操作
 *
 * 流式 setState 节流：streaming 期间用 requestAnimationFrame 批量 flush，
 * 避免每个 token 触发一次 React 重渲。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { EventType, type BaseEvent } from "@ag-ui/core";
import { NdjsonHttpAgent } from "@negentropy/agents-chat-core/client";
import {
  getEventContent,
  getEventDelta,
  getEventMessageId,
} from "@negentropy/agents-chat-core/protocol";
import type { WikiPageContext } from "./page-context";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  /** 完整正文（流式累加；RUN_FINISHED 后视为定稿）。 */
  content: string;
  /** 流式中 → true；终止后 → false。 */
  streaming: boolean;
  /** 关联的 Agent 名（assistant 消息），便于 UI 头像区分。 */
  agentName?: string;
  createdAt: number;
}

export type ChatStatus = "idle" | "streaming" | "error";

export interface UseChatAgentOptions {
  /** 默认主 Agent 名（来自 useSubAgents.rootAgent.name）。 */
  defaultAgentName: string | null;
  /** 用户在 Composer 中以 @ 提及切换到的 Agent 名（实时同步）。 */
  preferredAgentName: string | null;
  /** 当前 wiki 页面上下文，注入到 forwardedProps.wiki_context。 */
  pageContext: WikiPageContext;
  /** 当前认证用户的 user_id，透传给 BFF 避免 user_id mismatch。 */
  userId: string | null;
}

function safeUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** sessionStorage 持久化 threadId，刷新页面后保留对话上下文。 */
function loadThreadId(): string {
  if (typeof window === "undefined") return safeUuid();
  try {
    const cached = window.sessionStorage.getItem("wiki:agent-chat:thread-id");
    if (cached && /^[0-9a-f-]{36}$/i.test(cached)) return cached;
  } catch {
    // ignore
  }
  const next = safeUuid();
  try {
    window.sessionStorage.setItem("wiki:agent-chat:thread-id", next);
  } catch {
    // ignore
  }
  return next;
}

const SESSION_CREATED_KEY = "wiki:agent-chat:session-created";

/** 调用 BFF 创建后端 ADK session，返回后端分配的 session ID。 */
async function ensureBackendSession(
  userId: string,
  clientThreadId: string,
): Promise<string> {
  // 同一 threadId 只创建一次，避免刷新后重复创建
  try {
    const created = window.sessionStorage.getItem(SESSION_CREATED_KEY);
    if (created === clientThreadId) return clientThreadId;
  } catch {
    // ignore
  }

  const res = await fetch("/api/agui/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_name: "negentropy",
      user_id: userId,
      session_id: clientThreadId,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Failed to create session: ${err}`);
  }

  try {
    window.sessionStorage.setItem(SESSION_CREATED_KEY, clientThreadId);
  } catch {
    // ignore
  }
  return clientThreadId;
}

export interface UseChatAgentResult {
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  send: (text: string) => void;
  abort: () => void;
  /** 清空当前会话（仅前端，不影响后端 session）。 */
  reset: () => void;
}

export function useChatAgent(options: UseChatAgentOptions): UseChatAgentResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const threadIdRef = useRef<string>(loadThreadId());
  const agentRef = useRef<NdjsonHttpAgent | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // 流式 token 节流缓冲（rAF flush）
  const pendingDeltaRef = useRef<{ messageId: string; delta: string }[]>([]);
  const flushScheduledRef = useRef(false);

  // ---- 节流 flush ----
  const flushPending = useCallback(() => {
    flushScheduledRef.current = false;
    const pending = pendingDeltaRef.current;
    if (pending.length === 0) return;
    pendingDeltaRef.current = [];
    setMessages((prev) => {
      const next = [...prev];
      for (const { messageId, delta } of pending) {
        const idx = next.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          const target = next[idx];
          next[idx] = { ...target, content: target.content + delta };
        }
      }
      return next;
    });
  }, []);

  const schedulePending = useCallback(
    (messageId: string, delta: string) => {
      pendingDeltaRef.current.push({ messageId, delta });
      if (flushScheduledRef.current) return;
      flushScheduledRef.current = true;
      if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
        window.requestAnimationFrame(flushPending);
      } else {
        setTimeout(flushPending, 16);
      }
    },
    [flushPending],
  );

  // ---- 终止 ----
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus("idle");
    // 把所有 streaming 消息标记为已终止
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, []);

  const reset = useCallback(() => {
    abort();
    setMessages([]);
    setError(null);
    threadIdRef.current = safeUuid();
    try {
      window.sessionStorage.setItem(
        "wiki:agent-chat:thread-id",
        threadIdRef.current,
      );
      window.sessionStorage.removeItem(SESSION_CREATED_KEY);
    } catch {
      // ignore
    }
  }, [abort]);

  // ---- 实际发送逻辑（由 send 调用） ----
  const doSend = useCallback(
    (text: string, threadId: string, userId: string | null) => {
      const userMsgId = safeUuid();
      const assistantMsgId = safeUuid();
      const runId = safeUuid();
      const effectiveAgent =
        options.preferredAgentName ?? options.defaultAgentName ?? null;

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: text,
        streaming: false,
        createdAt: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        streaming: true,
        agentName: effectiveAgent ?? undefined,
        createdAt: Date.now(),
      };

      // 把当前历史 + 新两条传给 BFF（仅用于 BFF 抽取 lastUser 文本；
      // 后端 session.state 管理对话历史，BFF 不依赖 messages 持久化）。
      const historyForBff = [...messages, userMsg, assistantMsg].map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStatus("streaming");

      const url = `/api/agui?session_id=${encodeURIComponent(threadId)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ""}`;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const agent = new NdjsonHttpAgent({
        url,
        threadId,
        // AbstractAgent 通过实例属性 messages 持有历史；runAgent 不接受 messages 参数，
        // 但会把 this.messages 作为 RunAgentInput.messages 透传给 BFF。
        initialMessages: historyForBff.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        headers: {},
      });
      agentRef.current = agent;

      const forwardedProps: Record<string, unknown> = {
        preferred_subagent: effectiveAgent,
        wiki_context: {
          pubSlug: options.pageContext.pubSlug,
          entrySlug: options.pageContext.entrySlug,
          title: options.pageContext.title,
          pathname: options.pageContext.pathname,
          headings: options.pageContext.headings.slice(0, 50),
        },
      };

      agent
        .runAgent(
          {
            runId,
            forwardedProps,
            tools: [],
            context: [],
            abortController,
          },
          {
            // AgentSubscriber 通过 onEvent 转发 BaseEvent
            onEvent: ({ event }: { event: BaseEvent }) => {
              handleEvent(event, assistantMsgId);
            },
            onRunFailed: ({ error: runError }: { error: unknown }) => {
              setError(
                runError instanceof Error
                  ? runError.message
                  : String(runError),
              );
              setStatus("error");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, streaming: false } : m,
                ),
              );
            },
            onRunFinalized: () => {
              // 终态：flush 剩余 pending 后切换为 idle
              flushPending();
              setStatus("idle");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, streaming: false } : m,
                ),
              );
              abortControllerRef.current = null;
            },
          },
        )
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        });
    },
    [messages, options.defaultAgentName, options.preferredAgentName, options.pageContext, flushPending],
  );

  // ---- 发送（先确保后端 session 已创建） ----
  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);

      const userId = options.userId;
      const threadId = threadIdRef.current;

      // 异步创建后端 session（首次），成功后再发送消息
      const ensureAndSend = async () => {
        try {
          if (userId) {
            await ensureBackendSession(userId, threadId);
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : String(err),
          );
          setStatus("error");
          return;
        }
        doSend(trimmed, threadId, userId);
      };

      void ensureAndSend();
    },
    [options.userId, doSend],
  );

  /** 单事件分发到 messages 状态。 */
  const handleEvent = useCallback(
    (event: BaseEvent, assistantMsgId: string) => {
      switch (event.type) {
        case EventType.TEXT_MESSAGE_START: {
          // ADK 可能为每条 assistant message 启用新的 messageId
          // 简化处理：我们只用 assistantMsgId 作为 UI 上的占位，
          // 后端 messageId 仅用于事件流去重（这里不消费）。
          break;
        }
        case EventType.TEXT_MESSAGE_CONTENT: {
          const delta = getEventDelta(event);
          if (typeof delta === "string" && delta.length > 0) {
            schedulePending(assistantMsgId, delta);
          }
          break;
        }
        case EventType.TEXT_MESSAGE_END: {
          // 待 RUN_FINISHED 统一收尾
          break;
        }
        case EventType.TOOL_CALL_RESULT: {
          // 折叠展示：留待 ActivityIndicator 处理；MVP 不展开 toolCall 内容
          // 但若后端把 tool result 作为 message content 也回写过，这里能兜底
          const content = getEventContent(event);
          if (typeof content === "string" && content.length > 0) {
            // 单独消息（不并入主 assistant msg）—— v1 暂不渲染
          }
          break;
        }
        case EventType.RUN_ERROR: {
          const code = (event as { code?: string }).code ?? "RUN_ERROR";
          const message =
            (event as { message?: string }).message ?? "Agent run failed";
          setError(`${code}: ${message}`);
          setStatus("error");
          break;
        }
        case EventType.RUN_FINISHED:
          // 收尾在 onRunFinalized 中统一处理
          break;
        default:
          // ignore 其它事件类型（v1 MVP 关注 text 流）
          break;
      }
      // messageId 这里不消费，只是为防止以后用得着保留访问器
      void getEventMessageId(event);
    },
    [schedulePending],
  );

  // 组件卸载时 abort
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { messages, status, error, send, abort, reset };
}
