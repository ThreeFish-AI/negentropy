/**
 * state 工具函数单元测试
 *
 * 测试状态快照构建功能
 */

import { describe, it, expect } from "vitest";
import { buildStateSnapshotFromEvents } from "@/utils/state";
import { EventType } from "@ag-ui/core";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@/types/agui";

describe("buildStateSnapshotFromEvents", () => {
  it("应该返回 null（无状态事件）", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        messageId: "1",
        role: "user",
        timestamp: Date.now() / 1000,
      }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toBeNull();
  });

  it("应该构建状态快照（单个状态事件）", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.STATE_DELTA,
        timestamp: Date.now() / 1000,
        delta: { key1: "value1", key2: 42 },
      }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toEqual({ key1: "value1", key2: 42 });
  });

  it("应该合并多个状态事件", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.STATE_DELTA,
        timestamp: 1,
        delta: { key1: "value1", key2: 42 },
      }),
      createTestEvent({
        type: EventType.STATE_DELTA,
        timestamp: 2,
        delta: { key2: 100, key3: "value3" },
      }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toEqual({
      key1: "value1",
      key2: 100,
      key3: "value3",
    });
  });

  it("应该混合状态事件和其他事件类型", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        messageId: "1",
        role: "user",
        timestamp: 1,
      }),
      createTestEvent({
        type: EventType.STATE_DELTA,
        timestamp: 2,
        delta: { status: "processing" },
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        messageId: "1",
        timestamp: 3,
      }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toEqual({ status: "processing" });
  });

  it("应该处理空 delta（覆盖之前的值）", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.STATE_DELTA,
        timestamp: 1,
        delta: { key1: "value1" },
      }),
      createTestEvent({
        type: EventType.STATE_DELTA,
        timestamp: 2,
        delta: { key1: undefined },
      }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toEqual({ key1: undefined });
  });
});
