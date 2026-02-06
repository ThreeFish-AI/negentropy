/**
 * message-merge 单元测试
 *
 * 测试消息合并功能
 */

import { describe, it, expect } from "vitest";
import { mergeOptimisticMessages } from "@/features/messaging/utils/message-merge";
import type { Message } from "@ag-ui/core";

describe("mergeOptimisticMessages", () => {
  it("应该返回基础消息列表（无乐观消息）", () => {
    const base: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: new Date() },
    ];
    const optimistic: Message[] = [];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toEqual(base);
  });

  it("应该合并新的乐观消息", () => {
    const base: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: new Date() },
    ];
    const optimistic: Message[] = [
      { id: "2", role: "user", content: "World", createdAt: new Date() },
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(base[0]);
    expect(result[1]).toEqual(optimistic[0]);
  });

  it("应该过滤掉重复的乐观消息", () => {
    const base: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: new Date() },
      { id: "2", role: "user", content: "World", createdAt: new Date() },
    ];
    const optimistic: Message[] = [
      { id: "2", role: "user", content: "World", createdAt: new Date() },
      { id: "3", role: "user", content: "Test", createdAt: new Date() },
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
    expect(result[2].id).toBe("3");
  });

  it("应该忽略空内容的消息（在已知 ID 收集中）", () => {
    const base: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: new Date() },
      { id: "2", role: "user", content: "", createdAt: new Date() },
    ];
    const optimistic: Message[] = [
      { id: "3", role: "user", content: "Test", createdAt: new Date() },
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(3);
    // 空内容的消息应该保留在基础列表中，但不影响去重逻辑
  });

  it("应该用乐观消息的内容更新现有的空内容消息", () => {
    const base: Message[] = [
      { id: "1", role: "user", content: "Hello", createdAt: new Date() },
      { id: "2", role: "user", content: "", createdAt: new Date() },
    ];
    const optimistic: Message[] = [
      { id: "2", role: "user", content: "Updated", createdAt: new Date() },
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(2);
    expect(result[1].content).toBe("Updated");
  });

  it("应该保持消息顺序", () => {
    const base: Message[] = [
      { id: "1", role: "user", content: "A", createdAt: new Date() },
      { id: "2", role: "user", content: "B", createdAt: new Date() },
    ];
    const optimistic: Message[] = [
      { id: "3", role: "user", content: "C", createdAt: new Date() },
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
    expect(result[2].id).toBe("3");
  });
});
