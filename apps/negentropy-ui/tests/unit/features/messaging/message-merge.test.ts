/**
 * message-merge 单元测试
 *
 * 测试消息合并功能
 */

import { describe, it, expect } from "vitest";
import {
  mergeOptimisticMessages,
  reconcileOptimisticMessages,
} from "@/utils/message-merge";
import type { AgUiMessage } from "@/types/agui";
import { createTestMessage } from "@/tests/helpers/agui";

describe("mergeOptimisticMessages", () => {
  it("应该返回基础消息列表（无乐观消息）", () => {
    const base: AgUiMessage[] = [createTestMessage({ id: "1", role: "user", content: "Hello" })];
    const optimistic: AgUiMessage[] = [];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toEqual(base);
  });

  it("应该合并新的乐观消息", () => {
    const base: AgUiMessage[] = [createTestMessage({ id: "1", role: "user", content: "Hello" })];
    const optimistic: AgUiMessage[] = [
      createTestMessage({ id: "2", role: "user", content: "World" }),
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(base[0]);
    expect(result[1]).toEqual(optimistic[0]);
  });

  it("应该过滤掉重复的乐观消息", () => {
    const base: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "user", content: "Hello" }),
      createTestMessage({ id: "2", role: "user", content: "World" }),
    ];
    const optimistic: AgUiMessage[] = [
      createTestMessage({ id: "2", role: "user", content: "World" }),
      createTestMessage({ id: "3", role: "user", content: "Test" }),
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
    expect(result[2].id).toBe("3");
  });

  it("应该忽略空内容的消息（在已知 ID 收集中）", () => {
    const base: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "user", content: "Hello" }),
      createTestMessage({ id: "2", role: "user", content: "" }),
    ];
    const optimistic: AgUiMessage[] = [
      createTestMessage({ id: "3", role: "user", content: "Test" }),
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(3);
    // 空内容的消息应该保留在基础列表中，但不影响去重逻辑
  });

  it("应该用乐观消息的内容更新现有的空内容消息", () => {
    const base: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "user", content: "Hello" }),
      createTestMessage({ id: "2", role: "user", content: "" }),
    ];
    const optimistic: AgUiMessage[] = [
      createTestMessage({ id: "2", role: "user", content: "Updated" }),
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(2);
    expect(result[1].content).toBe("Updated");
  });

  it("应该保持消息顺序", () => {
    const base: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "user", content: "A" }),
      createTestMessage({ id: "2", role: "user", content: "B" }),
    ];
    const optimistic: AgUiMessage[] = [
      createTestMessage({ id: "3", role: "user", content: "C" }),
    ];

    const result = mergeOptimisticMessages(base, optimistic);

    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
    expect(result[2].id).toBe("3");
  });
});

describe("reconcileOptimisticMessages", () => {
  it("应该在服务端确认后回收同内容的乐观用户消息", () => {
    const base: AgUiMessage[] = [
      createTestMessage({
        id: "server-1",
        role: "user",
        content: "Hi",
        createdAt: new Date("2026-03-07T10:00:02.000Z"),
      }),
    ];
    const optimistic: AgUiMessage[] = [
      createTestMessage({
        id: "local-1",
        role: "user",
        content: "Hi",
        createdAt: new Date("2026-03-07T10:00:01.000Z"),
      }),
    ];

    expect(reconcileOptimisticMessages(base, optimistic)).toEqual([]);
  });

  it("应该在仅有一次确认时保留剩余的重复乐观消息", () => {
    const base: AgUiMessage[] = [
      createTestMessage({
        id: "server-1",
        role: "user",
        content: "Hi",
        createdAt: new Date("2026-03-07T10:00:02.000Z"),
      }),
    ];
    const optimistic: AgUiMessage[] = [
      createTestMessage({
        id: "local-1",
        role: "user",
        content: "Hi",
        createdAt: new Date("2026-03-07T10:00:01.000Z"),
      }),
      createTestMessage({
        id: "local-2",
        role: "user",
        content: "Hi",
        createdAt: new Date("2026-03-07T10:00:03.000Z"),
      }),
    ];

    const result = reconcileOptimisticMessages(base, optimistic);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("local-2");
  });

  it("应该优先按 runId 和 threadId 回收被服务端确认的乐观消息", () => {
    const base: AgUiMessage[] = [
      createTestMessage({
        id: "server-1",
        role: "user",
        content: "Hello",
        createdAt: new Date("2026-03-07T10:00:02.000Z"),
        runId: "run-1",
        threadId: "thread-1",
      }),
    ];
    const optimistic: AgUiMessage[] = [
      createTestMessage({
        id: "local-1",
        role: "user",
        content: "Hello",
        createdAt: new Date("2026-03-07T10:00:01.000Z"),
        runId: "run-1",
        threadId: "thread-1",
      }),
      createTestMessage({
        id: "local-2",
        role: "user",
        content: "Hello",
        createdAt: new Date("2026-03-07T10:00:01.500Z"),
        runId: "run-2",
        threadId: "thread-1",
      }),
    ];

    const result = reconcileOptimisticMessages(base, optimistic);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("local-2");
  });
});
