/**
 * useEventFilter Hook 单元测试
 *
 * 测试事件过滤功能
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEventFilter } from "@/features/timeline/hooks/useEventFilter";
import { BaseEvent, EventType } from "@ag-ui/core";

describe("useEventFilter", () => {
  const mockEvents: BaseEvent[] = [
    {
      type: EventType.TEXT_MESSAGE_START,
      messageId: "msg1",
      role: "user",
      timestamp: 1000,
    } as BaseEvent,
    {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: "msg1",
      delta: "Hello",
      timestamp: 1001,
    } as BaseEvent,
    {
      type: EventType.TEXT_MESSAGE_END,
      messageId: "msg1",
      timestamp: 1002,
    } as BaseEvent,
    {
      type: EventType.TEXT_MESSAGE_START,
      messageId: "msg2",
      role: "agent",
      timestamp: 2000,
    } as BaseEvent,
    {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: "msg2",
      delta: "Hi",
      timestamp: 2001,
    } as BaseEvent,
    {
      type: EventType.TEXT_MESSAGE_END,
      messageId: "msg2",
      timestamp: 2002,
    } as BaseEvent,
  ];

  it("应该返回所有事件（无选中消息）", () => {
    const { result } = renderHook(() =>
      useEventFilter({
        rawEvents: mockEvents,
        selectedMessageId: null,
      }),
    );

    expect(result.current.filteredEvents).toEqual(mockEvents);
    expect(result.current.messageTimestamps.size).toBe(2);
  });

  it("应该构建消息时间戳映射", () => {
    const { result } = renderHook(() =>
      useEventFilter({
        rawEvents: mockEvents,
        selectedMessageId: null,
      }),
    );

    const { messageTimestamps } = result.current;

    expect(messageTimestamps.get("msg1")).toBe(1000);
    expect(messageTimestamps.get("msg2")).toBe(2000);
  });

  it("应该过滤事件（选中第一条消息）", () => {
    const { result } = renderHook(() =>
      useEventFilter({
        rawEvents: mockEvents,
        selectedMessageId: "msg1",
      }),
    );

    const { filteredEvents } = result.current;

    // 应该只包含 msg1 的事件（timestamp <= 1000）
    expect(filteredEvents.length).toBeLessThanOrEqual(3);
    expect(filteredEvents[0].messageId).toBe("msg1");
  });

  it("应该过滤事件（选中第二条消息）", () => {
    const { result } = renderHook(() =>
      useEventFilter({
        rawEvents: mockEvents,
        selectedMessageId: "msg2",
      }),
    );

    const { filteredEvents } = result.current;

    // msg2 的 timestamp 是 2000，只有 timestamp <= 2000 的事件会被包含
    // 即 msg1 (1000, 1001, 1002) + msg2 的 START (2000) = 4 个事件
    // 2001 和 2002 的事件 > 2000，被过滤掉
    expect(filteredEvents).toHaveLength(4);
  });

  it("应该返回所有事件（未找到选中的消息）", () => {
    const { result } = renderHook(() =>
      useEventFilter({
        rawEvents: mockEvents,
        selectedMessageId: "nonexistent",
      }),
    );

    expect(result.current.filteredEvents).toEqual(mockEvents);
  });

  it("应该处理空事件列表", () => {
    const { result } = renderHook(() =>
      useEventFilter({
        rawEvents: [],
        selectedMessageId: null,
      }),
    );

    expect(result.current.filteredEvents).toEqual([]);
    expect(result.current.messageTimestamps.size).toBe(0);
  });

  it("应该更新过滤结果（选中消息变化）", () => {
    const { result, rerender } = renderHook(
      ({ selectedMessageId }) =>
        useEventFilter({
          rawEvents: mockEvents,
          selectedMessageId,
        }),
      { initialProps: { selectedMessageId: null as string | null } },
    );

    expect(result.current.filteredEvents).toHaveLength(6);

    act(() => {
      rerender({ selectedMessageId: "msg1" });
    });

    expect(result.current.filteredEvents.length).toBeLessThanOrEqual(3);
  });
});
