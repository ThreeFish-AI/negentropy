import { EventType } from "@ag-ui/core";
import { adkEventToAguiEvents, adkEventsToMessages } from "../../lib/adk";

describe("adk event mapping", () => {
  it("maps text parts to AG-UI text events", () => {
    const payload = {
      id: "evt_1",
      author: "user",
      content: {
        parts: [{ text: "hello" }, { text: " world" }],
      },
    };
    const events = adkEventToAguiEvents(payload);
    const types = events.map((event) => event.type);
    expect(types).toEqual([
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
    ]);
  });

  it("extracts text from message.content array", () => {
    const payload = {
      id: "evt_2",
      author: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
      },
    };
    const events = adkEventToAguiEvents(payload);
    expect(events.find((event) => event.type === EventType.TEXT_MESSAGE_CONTENT)).toBeTruthy();
  });

  it("ignores empty state/artifact deltas", () => {
    const payload = {
      id: "evt_3",
      author: "assistant",
      actions: {
        stateDelta: {},
        artifactDelta: {},
      },
    };
    const events = adkEventToAguiEvents(payload);
    expect(events.some((event) => event.type === EventType.STATE_DELTA)).toBe(false);
    expect(events.some((event) => event.type === EventType.ACTIVITY_SNAPSHOT)).toBe(false);
  });

  it("maps ADK events to messages", () => {
    const payloads = [
      {
        id: "evt_4",
        author: "user",
        content: { parts: [{ text: "ping" }] },
      },
      {
        id: "evt_5",
        author: "assistant",
        content: { parts: [{ text: "pong" }] },
      },
    ];
    const messages = adkEventsToMessages(payloads);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("ping");
    expect(messages[1].content).toBe("pong");
  });
});
