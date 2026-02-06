/**
 * 消息发送 Hook
 *
 * 从 app/page.tsx 提取的消息发送逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 */

import { useCallback } from "react";
import { HttpAgent, randomUUID } from "@ag-ui/client";
import { BaseEvent, EventType, Message } from "@ag-ui/core";
import type { ConnectionState } from "@/types/common";

/**
 * useMessageSender Hook 参数
 */
export interface UseMessageSenderOptions {
  /** Agent 实例 */
  agent: HttpAgent | null;
  /** 当前会话 ID */
  sessionId: string | null;
  /** 连接状态 */
  connection: ConnectionState;
  /** 待确认数量 */
  pendingConfirmations: number;
  /** 解析后的线程 ID */
  resolvedThreadId: string;
  /** 设置原始事件回调 */
  setRawEvents: React.Dispatch<React.SetStateAction<BaseEvent[]>>;
  /** 设置乐观消息回调 */
  setOptimisticMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  /** 设置输入值回调 */
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  /** 设置连接状态回调 */
  setConnection: React.Dispatch<React.SetStateAction<ConnectionState>>;
  /** 更新会话时间回调 */
  onUpdateSessionTime?: (sessionId: string) => void;
  /** 加载会话列表回调 */
  onLoadSessions?: () => Promise<void>;
  /** 添加日志回调 */
  onAddLog?: (level: "info" | "warn" | "error", message: string, payload?: Record<string, unknown>) => void;
  /** 当前输入值 */
  inputValue: string;
}

/**
 * useMessageSender Hook 返回值
 */
export interface UseMessageSenderReturnValue {
  /** 发送消息 */
  sendInput: () => Promise<void>;
}

/**
 * 消息发送 Hook
 *
 * 管理消息发送逻辑，包括乐观更新
 *
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 */
export function useMessageSender(
  options: UseMessageSenderOptions,
): UseMessageSenderReturnValue {
  const {
    agent,
    sessionId,
    connection,
    pendingConfirmations,
    resolvedThreadId,
    setRawEvents,
    setOptimisticMessages,
    setInputValue,
    setConnection,
    onUpdateSessionTime,
    onLoadSessions,
    onAddLog,
    inputValue,
  } = options;

  // 发送消息
  const sendInput = useCallback(async () => {
    if (!agent || !sessionId) {
      return;
    }
    if (connection === "connecting" || connection === "streaming") {
      return;
    }
    if (pendingConfirmations > 0) {
      return;
    }

    const messageId = crypto.randomUUID();
    const timestamp = Date.now() / 1000;
    const newMessage: Message = {
      id: messageId,
      role: "user",
      content: inputValue.trim(),
      createdAt: new Date(timestamp * 1000),
    };

    // 乐观更新
    setOptimisticMessages((prev) => [...prev, newMessage]);
    setRawEvents((prev) => {
      const optimisticEvents: BaseEvent[] = [
        {
          type: EventType.TEXT_MESSAGE_START,
          messageId,
          role: "user",
          timestamp,
        } as BaseEvent,
        {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: newMessage.content,
          timestamp,
        } as BaseEvent,
        {
          type: EventType.TEXT_MESSAGE_END,
          messageId,
          timestamp,
        } as BaseEvent,
      ];
      const next = [...prev, ...optimisticEvents];
      // 增加缓冲区大小，防止丢失消息
      return next.slice(-10000);
    });

    // 发送消息
    agent.addMessage(newMessage);
    setInputValue("");

    // 更新会话时间
    if (typeof onUpdateSessionTime === "function") {
      onUpdateSessionTime(sessionId);
    }

    // 运行 Agent
    try {
      setConnection("connecting");
      await agent.runAgent({
        runId: randomUUID(),
        threadId: resolvedThreadId,
      });
      if (typeof onLoadSessions === "function") {
        await onLoadSessions();
      }
    } catch (error) {
      setConnection("error");
      if (typeof onAddLog === "function") {
        onAddLog("error", "run_agent_failed", { message: String(error) });
      }
      console.warn("Failed to run agent", error);
    }
  }, [
    agent,
    sessionId,
    connection,
    pendingConfirmations,
    resolvedThreadId,
    inputValue,
    setOptimisticMessages,
    setRawEvents,
    setInputValue,
    setConnection,
    onUpdateSessionTime,
    onLoadSessions,
    onAddLog,
  ]);

  return {
    sendInput,
  };
}
