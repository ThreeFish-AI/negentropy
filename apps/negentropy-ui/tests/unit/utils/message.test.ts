/**
 * message 工具函数单元测试
 *
 * 测试消息合并、格式化功能
 */

import { describe, it, expect } from "vitest";
import { mergeAdjacentAssistant, mapMessagesToChat, buildChatMessagesFromEventsWithFallback } from "@/utils/message";
import type { ChatMessage } from "@/types/common";
import { Message, BaseEvent, EventType } from "@ag-ui/core";

describe("mergeAdjacentAssistant", () => {
  it("应该合并相邻的 assistant 消息", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "First message" },
      { id: "2", role: "assistant", content: "Second message" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("First messageSecond message");
  });

  it("应该不合并 user 消息", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi there" },
      { id: "3", role: "user", content: "How are you?" },
      { id: "4", role: "assistant", content: "I'm fine" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(4);
    // 检查消息顺序和角色保持不变
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("user");
    expect(result[3].role).toBe("assistant");
  });

  it("应该处理空数组", () => {
    const result = mergeAdjacentAssistant([]);
    expect(result).toHaveLength(0);
  });

  it("应该处理单个消息", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "Single message" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Single message");
  });

  it("应该合并多个相邻的 assistant 消息", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "First" },
      { id: "2", role: "assistant", content: "Second" },
      { id: "3", role: "assistant", content: "Third" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("FirstSecondThird");
  });
});

describe("mapMessagesToChat", () => {
  it("应该过滤 tool 和 system 角色", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: new Date() },
      { id: "2", role: "system", content: "You are helpful", createdAt: new Date() },
      { id: "3", role: "tool", content: "Tool result", createdAt: new Date() },
      { id: "4", role: "assistant", content: "Hi there", createdAt: new Date() },
    ] as Message[];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  it("应该保持所有消息的独立性（不合并）", () => {
    const messages: Message[] = [
      { id: "1", role: "assistant", content: "First", createdAt: new Date() },
      { id: "2", role: "assistant", content: "Second", createdAt: new Date() },
    ] as Message[];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(2);
    // 不添加分隔符，保持原样
    expect(result[0].content).toBe("First");
    expect(result[1].content).toBe("Second");
  });

  it("应该处理 agent 角色为 assistant", () => {
    const messages: Message[] = [
      { id: "1", role: "agent", content: "Agent response", createdAt: new Date() },
    ] as Message[];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
  });

  it("应该过滤空内容", () => {
    const messages: Message[] = [
      { id: "1", role: "assistant", content: "", createdAt: new Date() },
      { id: "2", role: "user", content: "Hello", createdAt: new Date() },
    ] as Message[];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });
});

describe("buildChatMessagesFromEventsWithFallback - sorting", () => {
  it("应该按 timestamp 排序消息", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: BaseEvent[] = [
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg2",
        role: "user",
        timestamp: 2000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg2",
        delta: "Content 2",
        timestamp: 2000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg2",
        timestamp: 2000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg1",
        role: "user",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg1",
        delta: "Content 1",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg1",
        timestamp: 1000,
      } as BaseEvent,
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("msg1");
    expect(result[1].id).toBe("msg2");
  });

  it("应该在 timestamp 相同时使用 messageId 作为稳定排序键", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: BaseEvent[] = [
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg_z",
        role: "user",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg_z",
        delta: "Z",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg_z",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg_a",
        role: "user",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg_a",
        delta: "A",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg_a",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg_m",
        role: "user",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg_m",
        delta: "M",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg_m",
        timestamp: 1000,
      } as BaseEvent,
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(3);
    // 字典序：msg_a < msg_m < msg_z
    expect(result[0].id).toBe("msg_a");
    expect(result[1].id).toBe("msg_m");
    expect(result[2].id).toBe("msg_z");
  });

  it("应该正确处理没有 timestamp 的消息", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: BaseEvent[] = [
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg_z",
        role: "user",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg_z",
        delta: "Z",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg_z",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg_a",
        role: "user",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg_a",
        delta: "A",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg_a",
      } as BaseEvent,
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(2);
    // 没有 timestamp 时，使用 messageId 排序
    expect(result[0].id).toBe("msg_a");
    expect(result[1].id).toBe("msg_z");
  });

  it("应该优先处理有 timestamp 的消息", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: BaseEvent[] = [
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg_no_ts",
        role: "user",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg_no_ts",
        delta: "No TS",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg_no_ts",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg_with_ts",
        role: "user",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg_with_ts",
        delta: "With TS",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg_with_ts",
        timestamp: 1000,
      } as BaseEvent,
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(2);
    // 有 timestamp 的消息排在前面
    expect(result[0].id).toBe("msg_with_ts");
    expect(result[1].id).toBe("msg_no_ts");
  });

  it("应该使用最早的 timestamp（优化后的逻辑）", () => {
    const events: BaseEvent[] = [
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId: "msg1",
        role: "assistant",
        timestamp: 2000,  // 初始 timestamp
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: "msg1",
        delta: "Hello",
        timestamp: 1000,  // 更早的 timestamp，应该被使用
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_END,
        messageId: "msg1",
        timestamp: 1000,
      } as BaseEvent,
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(1);
    // 结果应该包含内容
    expect(result[0].id).toBe("msg1");
    expect(result[0].content).toBe("Hello");
  });
});
