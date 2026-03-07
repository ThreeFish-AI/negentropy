/**
 * state 工具函数单元测试
 *
 * 测试状态快照构建功能
 */

import { describe, it, expect } from "vitest";
import { buildStateSnapshotFromEvents } from "@/utils/state";
import { BaseEvent, EventType } from "@ag-ui/core";
import { createTestEvent } from "@/tests/helpers/agui";

function createStateDeltaEvent(
  timestamp: number,
  delta: Record<string, unknown>,
): BaseEvent {
  return {
    type: EventType.STATE_DELTA,
    timestamp,
    delta,
  } as unknown as BaseEvent;
}

describe("buildStateSnapshotFromEvents", () => {
  it("应该返回 null（无状态事件）", () => {
    const events: BaseEvent[] = [
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
    const events: BaseEvent[] = [
      createStateDeltaEvent(Date.now() / 1000, { key1: "value1", key2: 42 }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toEqual({ key1: "value1", key2: 42 });
  });

  it("应该合并多个状态事件", () => {
    const events: BaseEvent[] = [
      createStateDeltaEvent(1, { key1: "value1", key2: 42 }),
      createStateDeltaEvent(2, { key2: 100, key3: "value3" }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toEqual({
      key1: "value1",
      key2: 100,
      key3: "value3",
    });
  });

  it("应该混合状态事件和其他事件类型", () => {
    const events: BaseEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        messageId: "1",
        role: "user",
        timestamp: 1,
      }),
      createStateDeltaEvent(2, { status: "processing" }),
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
    const events: BaseEvent[] = [
      createStateDeltaEvent(1, { key1: "value1" }),
      createStateDeltaEvent(2, { key1: undefined }),
    ];

    const result = buildStateSnapshotFromEvents(events);

    expect(result).toEqual({ key1: undefined });
  });
});
