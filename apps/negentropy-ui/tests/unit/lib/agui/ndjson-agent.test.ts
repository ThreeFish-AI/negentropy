import { afterEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@ag-ui/core";
import { NdjsonHttpAgent } from "@/lib/agui/ndjson-agent";

describe("NdjsonHttpAgent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("在主流提前结束时会自动走 resume 并拿到 terminal event", async () => {
    const frames = [
      [
        {
          protocol: "negentropy.ndjson.v1",
          kind: "agui_event",
          sessionId: "session-1",
          threadId: "session-1",
          runId: "run-1",
          cursor: "run-1:1",
          resumeToken: "run-1:1",
          event: {
            type: "RUN_STARTED",
            threadId: "session-1",
            runId: "run-1",
            timestamp: 1,
          },
        },
      ],
      [
        {
          protocol: "negentropy.ndjson.v1",
          kind: "agui_event",
          sessionId: "session-1",
          threadId: "session-1",
          runId: "run-1",
          cursor: "run-1:2",
          resumeToken: "run-1:2",
          event: {
            type: "RUN_FINISHED",
            threadId: "session-1",
            runId: "run-1",
            timestamp: 2,
          },
        },
      ],
    ];
    let callCount = 0;

    vi.spyOn(global, "fetch").mockImplementation(async () => {
      const payload = frames[callCount] ?? [];
      callCount += 1;
      return new Response(payload.map((item) => JSON.stringify(item)).join("\n"), {
        status: 200,
        headers: {
          "content-type": "application/x-ndjson",
        },
      });
    });

    const agent = new NdjsonHttpAgent({
      url: "/api/agui?app_name=negentropy&user_id=test&session_id=session-1",
      threadId: "session-1",
    });
    const events: string[] = [];

    agent.subscribe({
      onEvent: ({ event }) => {
        events.push(event.type);
      },
    });

    await agent.runAgent({
      runId: "run-1",
    });

    expect(callCount).toBe(2);
    expect(events).toContain(EventType.RUN_STARTED);
    expect(events).toContain(EventType.RUN_FINISHED);
  });
});
