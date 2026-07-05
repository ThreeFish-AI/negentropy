import { describe, expect, it } from "vitest";

import { buildStudioTranscript } from "@/components/ui/studio-transcript/build-studio-transcript";
import type { ChatDisplayBlock, ToolGroupDisplayBlock, AssistantReplyDisplayBlock, ChatMessageDisplayBlock } from "@/types/a2ui";
import type { Citation } from "@/types/common";

// ---------------------------------------------------------------------------
// fixture builders（仅填字段足以驱动映射；id 稳定以保证 key 不抖）
// ---------------------------------------------------------------------------

let blockCounter = 0;
function nextId(prefix: string) {
  blockCounter += 1;
  return `${prefix}-${blockCounter}`;
}

function userMessageBlock(content: string, id = nextId("user")): ChatMessageDisplayBlock {
  return {
    id,
    kind: "message",
    nodeId: `node-${id}`,
    timestamp: 1000,
    sourceOrder: 0,
    message: {
      id,
      role: "user",
      content,
    } as never,
  };
}

function assistantTextSegment(text: string, streaming = false, id = nextId("seg-text")) {
  return { id, kind: "text" as const, nodeId: `node-${id}`, timestamp: 1001, sourceOrder: 1, content: text, streaming };
}

function reasoningSegment(text: string, id = nextId("seg-reason")) {
  return {
    id,
    kind: "reasoning" as const,
    nodeId: `node-${id}`,
    timestamp: 1001,
    sourceOrder: 1,
    title: "Reasoning",
    phase: "finished" as const,
    stepId: id,
    content: text,
  };
}

function toolEntry(name: string, opts: { rawName?: string; status?: "running" | "done" | "completed" | "error"; result?: string; id?: string } = {}) {
  return {
    id: opts.id ?? nextId("tool"),
    nodeId: `node-${opts.id ?? nextId("tool-node")}`,
    name: name,
    rawName: opts.rawName ?? name,
    args: '{"command":"ls"}',
    result: opts.result,
    status: opts.status ?? ("completed" as const),
    summary: [],
  };
}

function toolGroupSegment(tools: ReturnType<typeof toolEntry>[], id = nextId("seg-tool")) {
  return {
    id,
    kind: "tool-group" as const,
    nodeId: `node-${id}`,
    timestamp: 1002,
    sourceOrder: 2,
    parallel: false,
    defaultExpanded: false,
    status: "completed" as const,
    title: "Tools",
    summary: "",
    segmentId: `${id}-seg`,
    tools,
  };
}

function assistantReplyBlock(
  segments: ReturnType<typeof assistantTextSegment | typeof reasoningSegment | typeof toolGroupSegment>[],
  author: string,
  id = nextId("reply"),
  citations?: Citation[],
): AssistantReplyDisplayBlock {
  return {
    id,
    kind: "assistant-reply",
    nodeId: `node-${id}`,
    timestamp: 1001,
    sourceOrder: 1,
    message: {
      id,
      role: "assistant",
      content: "",
      author,
      citations,
    } as never,
    segments: segments as never,
  };
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe("buildStudioTranscript", () => {
  it("空 blocks → 空数组", () => {
    expect(buildStudioTranscript([])).toEqual([]);
  });

  it("user message → user item；assistant text → assistant item（带 role）；左右由策略处理", () => {
    const blocks: ChatDisplayBlock[] = [
      userMessageBlock("你好"),
      assistantReplyBlock([assistantTextSegment("你好，我是 NegentropyEngine")], "NegentropyEngine"),
    ];
    const items = buildStudioTranscript(blocks);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("user");
    if (items[0].kind === "user") expect(items[0].text).toBe("你好");
    expect(items[1].kind).toBe("assistant");
    if (items[1].kind === "assistant") {
      expect(items[1].text).toBe("你好，我是 NegentropyEngine");
      expect(items[1].role).toBe("engine");
      expect(items[1].thinking).toBe(false);
    }
  });

  it("不同 author 派生不同 role（per-agent 归因）", () => {
    const blocks: ChatDisplayBlock[] = [
      assistantReplyBlock([assistantTextSegment("感知")], "PerceptionFaculty"),
      assistantReplyBlock([assistantTextSegment("行动")], "ActionFaculty"),
      assistantReplyBlock([assistantTextSegment("代码")], "claude_code"),
    ];
    const items = buildStudioTranscript(blocks);
    expect(items.map((i) => (i.kind === "assistant" ? i.role : null))).toEqual([
      "perception",
      "action",
      "claude_code",
    ]);
  });

  it("reasoning segment → assistant thinking item", () => {
    const items = buildStudioTranscript([
      assistantReplyBlock([reasoningSegment("我在思考…")], "ContemplationFaculty"),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("assistant");
    if (items[0].kind === "assistant") {
      expect(items[0].thinking).toBe(true);
      expect(items[0].text).toBe("我在思考…");
      expect(items[0].role).toBe("contemplation");
    }
  });

  it("tool-group segment → 每个 tool 一个 tool item；input 解析为对象", () => {
    const items = buildStudioTranscript([
      assistantReplyBlock(
        [toolGroupSegment([toolEntry("Bash", { rawName: "bash", result: "ok" })])],
        "claude_code",
      ),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("tool");
    if (items[0].kind === "tool") {
      expect(items[0].toolName).toBe("bash");
      expect(items[0].input).toEqual({ command: "ls" });
      expect(items[0].output).toBe("ok");
      expect(items[0].isError).toBe(false);
      expect(items[0].role).toBe("claude_code");
    }
  });

  it("≥3 连续 tool 折叠为 tool_summary", () => {
    const items = buildStudioTranscript([
      assistantReplyBlock(
        [
          toolGroupSegment([
            toolEntry("Read", { rawName: "read" }),
            toolEntry("Read", { rawName: "read" }),
            toolEntry("Read", { rawName: "read" }),
            toolEntry("Read", { rawName: "read" }),
          ]),
        ],
        "claude_code",
      ),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("tool_summary");
    if (items[0].kind === "tool_summary") {
      expect(items[0].count).toBe(4);
      expect(items[0].toolNames).toEqual(["read"]);
    }
  });

  it("citations 仅挂载到首个 text 段", () => {
    const citation: Citation = { id: 1, text: "Author, Title, 2024." };
    const items = buildStudioTranscript([
      assistantReplyBlock(
        [assistantTextSegment("第一段"), assistantTextSegment("第二段")],
        "NegentropyEngine",
        undefined,
        [citation],
      ),
    ]);
    expect(items).toHaveLength(2);
    if (items[0].kind === "assistant") expect(items[0].citations).toEqual([citation]);
    if (items[1].kind === "assistant") expect(items[1].citations).toBeUndefined();
  });

  it("streaming text 段透传 streaming 标志", () => {
    const items = buildStudioTranscript([
      assistantReplyBlock([assistantTextSegment("流式中…", true)], "NegentropyEngine"),
    ]);
    if (items[0].kind === "assistant") expect(items[0].streaming).toBe(true);
  });

  it("顶层 tool-group 块默认归因 claude_code", () => {
    const block: ToolGroupDisplayBlock = {
      id: nextId("tg"),
      kind: "tool-group",
      nodeId: "node-tg",
      timestamp: 1002,
      sourceOrder: 2,
      parallel: false,
      defaultExpanded: false,
      status: "completed",
      title: "Tools",
      summary: "",
      tools: [toolEntry("Grep", { rawName: "grep" })],
    };
    const items = buildStudioTranscript([block]);
    expect(items[0].kind).toBe("tool");
    if (items[0].kind === "tool") expect(items[0].role).toBe("claude_code");
  });

  it("turn-status / summary / error 块映射正确", () => {
    const items = buildStudioTranscript([
      { id: "ts", kind: "turn-status", nodeId: "n-ts", timestamp: 1, sourceOrder: 0, status: "finished", title: "回合结束", detail: "ok" },
      { id: "sm", kind: "summary", nodeId: "n-sm", timestamp: 1, sourceOrder: 0, title: "摘要", lines: ["a", "b"] },
      { id: "er", kind: "error", nodeId: "n-er", timestamp: 1, sourceOrder: 0, title: "出错", message: "详情" },
    ]);
    expect(items.map((i) => i.kind)).toEqual(["system_note", "system_note", "assistant"]);
    if (items[2].kind === "assistant") expect(items[2].role).toBe("engine");
  });

  it("progressMap 透传到 tool item", () => {
    const items = buildStudioTranscript(
      [
        assistantReplyBlock(
          [toolGroupSegment([toolEntry("Bash", { rawName: "bash", id: "tool-x" })])],
          "claude_code",
        ),
      ],
      { progressMap: { "tool-x": { percent: 42, stage: "running" } } },
    );
    if (items[0].kind === "tool") {
      expect(items[0].progress?.percent).toBe(42);
      expect(items[0].progress?.stage).toBe("running");
    }
  });
});
