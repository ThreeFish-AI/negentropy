import { describe, expect, it } from "vitest";
import type { ConversationNode, ConversationTree } from "@/types/a2ui";
import { extractFinalAssistantText } from "@/utils/run-output";

function _mkNode(
  overrides: Partial<ConversationNode> & { id: string },
): ConversationNode {
  return {
    type: "text",
    parentId: null,
    children: [],
    threadId: "thread-1",
    runId: "run-A",
    timestamp: 0,
    timeRange: { start: 0, end: 0 },
    sourceOrder: 0,
    title: "",
    visibility: "chat",
    payload: {},
    sourceEventTypes: [],
    relatedMessageIds: [],
    role: "assistant",
    ...overrides,
  } as ConversationNode;
}

function _mkTree(nodes: ConversationNode[]): ConversationTree {
  const nodeIndex = new Map<string, ConversationNode>();
  for (const n of nodes) nodeIndex.set(n.id, n);
  return {
    roots: nodes.filter((n) => n.parentId === null),
    nodeIndex,
    messageNodeIndex: new Map(),
    toolNodeIndex: new Map(),
  };
}

describe("extractFinalAssistantText", () => {
  it("无 tree → 返回空串", () => {
    expect(extractFinalAssistantText(null, "run-A")).toBe("");
    expect(extractFinalAssistantText(undefined, "run-A")).toBe("");
  });

  it("无 runId → 返回空串", () => {
    const tree = _mkTree([_mkNode({ id: "1", payload: { content: "hi" } })]);
    expect(extractFinalAssistantText(tree, "")).toBe("");
  });

  it("只挑选 type=text + role=assistant + runId 匹配的节点", () => {
    const tree = _mkTree([
      _mkNode({ id: "1", payload: { content: "first" }, sourceOrder: 1 }),
      _mkNode({
        id: "2",
        role: "user",
        payload: { content: "ignored-user" },
        sourceOrder: 2,
      }),
      _mkNode({
        id: "3",
        runId: "run-B",
        payload: { content: "ignored-other-run" },
        sourceOrder: 3,
      }),
      _mkNode({
        id: "4",
        type: "tool-call",
        payload: { content: "ignored-tool" },
        sourceOrder: 4,
      }),
      _mkNode({ id: "5", payload: { content: "second" }, sourceOrder: 5 }),
    ]);
    expect(extractFinalAssistantText(tree, "run-A")).toBe("first\n\nsecond");
  });

  it("按 sourceOrder 升序拼接", () => {
    const tree = _mkTree([
      _mkNode({ id: "1", payload: { content: "B" }, sourceOrder: 20 }),
      _mkNode({ id: "2", payload: { content: "A" }, sourceOrder: 10 }),
    ]);
    expect(extractFinalAssistantText(tree, "run-A")).toBe("A\n\nB");
  });

  it("过滤空白 content", () => {
    const tree = _mkTree([
      _mkNode({ id: "1", payload: { content: "" }, sourceOrder: 1 }),
      _mkNode({ id: "2", payload: { content: "  " }, sourceOrder: 2 }),
      _mkNode({ id: "3", payload: { content: "real" }, sourceOrder: 3 }),
    ]);
    expect(extractFinalAssistantText(tree, "run-A")).toBe("real");
  });

  it("payload.content 非字符串 → 跳过", () => {
    const tree = _mkTree([
      _mkNode({ id: "1", payload: { content: 42 }, sourceOrder: 1 }),
      _mkNode({ id: "2", payload: { content: { x: 1 } }, sourceOrder: 2 }),
      _mkNode({ id: "3", payload: { content: "real" }, sourceOrder: 3 }),
    ]);
    expect(extractFinalAssistantText(tree, "run-A")).toBe("real");
  });

  it("空 tree → 返回空串", () => {
    expect(extractFinalAssistantText(_mkTree([]), "run-A")).toBe("");
  });
});
