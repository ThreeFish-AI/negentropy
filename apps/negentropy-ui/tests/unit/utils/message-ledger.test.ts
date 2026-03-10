import { describe, expect, it } from "vitest";
import { mergeMessageLedger } from "@/utils/message-ledger";

describe("message-ledger", () => {
  it("允许 hydration 终态补全已 closed 的实时 assistant 截断内容", () => {
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-live",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content: "## 分析\n\n| 项目 | 说明 |\n| --- | --- |\n| A | 首行",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-live"],
        },
      ],
      [
        {
          id: "assistant-final",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "snapshot_role",
          content:
            "## 分析\n\n| 项目 | 说明 |\n| --- | --- |\n| A | 首行 |\n| B | 次行 |\n\n第一段结论。\n\n第二段结论。",
          createdAt: new Date("2026-03-08T00:00:03.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "snapshot",
          sourceEventTypes: ["MESSAGES_SNAPSHOT"],
          relatedMessageIds: ["assistant-final"],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      content:
        "## 分析\n\n| 项目 | 说明 |\n| --- | --- |\n| A | 首行 |\n| B | 次行 |\n\n第一段结论。\n\n第二段结论。",
      streaming: false,
      lifecycle: "closed",
    });
    expect(merged[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live", "assistant-final"]),
    );
  });

  it("不会把 closed realtime 与非补全型历史 assistant 消息错误合并", () => {
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-live",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content: "第一段结论。",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-live"],
        },
      ],
      [
        {
          id: "assistant-final",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "snapshot_role",
          content: "第二段结论。",
          createdAt: new Date("2026-03-08T00:00:03.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "snapshot",
          sourceEventTypes: ["MESSAGES_SNAPSHOT"],
          relatedMessageIds: ["assistant-final"],
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((entry) => entry.id)).toEqual([
      "assistant-live",
      "assistant-final",
    ]);
  });
});
