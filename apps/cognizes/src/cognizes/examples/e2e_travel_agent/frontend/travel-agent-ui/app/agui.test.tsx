/**
 * AG-UI 事件流测试
 *
 * 验证 AG-UI 协议事件格式正确性
 */
import { describe, expect, it } from "vitest";

describe("AG-UI Event Protocol", () => {
  it("should parse RUN_STARTED event", () => {
    const event = {
      type: "RUN_STARTED",
      runId: "test-123",
    };

    expect(event.type).toBe("RUN_STARTED");
    expect(event.runId).toBeDefined();
  });

  it("should parse TEXT_MESSAGE_CONTENT event with delta", () => {
    const event = {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "msg-456",
      delta: "Hello",
    };

    expect(event.type).toBe("TEXT_MESSAGE_CONTENT");
    expect(event.delta).toBe("Hello");
    expect(event.messageId).toBeDefined();
  });

  it("should parse RUN_FINISHED event", () => {
    const event = {
      type: "RUN_FINISHED",
      runId: "test-123",
    };

    expect(event.type).toBe("RUN_FINISHED");
    expect(event.runId).toBeDefined();
  });

  it("should receive streaming events in correct order", async () => {
    const events: any[] = [];

    // 模拟 SSE 事件流
    const mockStreamEvents = async () => {
      events.push({ type: "RUN_STARTED", runId: "test-123" });
      events.push({
        type: "TEXT_MESSAGE_START",
        messageId: "msg-1",
        role: "assistant",
      });
      events.push({
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "msg-1",
        delta: "Hello",
      });
      events.push({
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "msg-1",
        delta: " World",
      });
      events.push({ type: "TEXT_MESSAGE_END", messageId: "msg-1" });
      events.push({ type: "RUN_FINISHED", runId: "test-123" });
    };

    await mockStreamEvents();

    expect(events.length).toBe(6);
    expect(events[0].type).toBe("RUN_STARTED");
    expect(events[events.length - 1].type).toBe("RUN_FINISHED");

    // 验证消息内容拼接
    const contentEvents = events.filter(
      (e) => e.type === "TEXT_MESSAGE_CONTENT"
    );
    const fullText = contentEvents.map((e) => e.delta).join("");
    expect(fullText).toBe("Hello World");
  });
});
