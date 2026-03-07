import { EventType } from "@ag-ui/core";
import {
  parseAgUiEvent,
  parseBaseEvent,
  safeParseAgUiEvent,
  safeParseBaseEventProps,
} from "@/lib/agui/schema";

describe("AGUI schema validators", () => {
  it("accepts valid base event props", () => {
    const result = safeParseBaseEventProps({
      threadId: "thread-1",
      runId: "run-1",
      timestamp: 123,
      messageId: "message-1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid base event props", () => {
    const result = safeParseBaseEventProps({
      threadId: "thread-1",
      runId: 123,
      timestamp: "bad",
    });

    expect(result.success).toBe(false);
  });

  it("parses generic base events with type metadata", () => {
    const event = parseBaseEvent({
      type: EventType.TEXT_MESSAGE_END,
      threadId: "thread-1",
      runId: "run-1",
      timestamp: 123,
      messageId: "message-1",
    });

    expect(event.type).toBe(EventType.TEXT_MESSAGE_END);
  });

  it("parses typed AGUI events", () => {
    const event = parseAgUiEvent({
      type: EventType.TOOL_CALL_START,
      threadId: "thread-1",
      runId: "run-1",
      timestamp: 123,
      messageId: "message-1",
      toolCallId: "call-1",
      toolCallName: "search",
    });

    expect(event.type).toBe(EventType.TOOL_CALL_START);
  });

  it("rejects typed AGUI events with mismatched payload shape", () => {
    const result = safeParseAgUiEvent({
      type: EventType.TOOL_CALL_START,
      threadId: "thread-1",
      runId: "run-1",
      timestamp: 123,
      messageId: "message-1",
      toolCallId: "call-1",
    });

    expect(result.success).toBe(false);
  });
});
