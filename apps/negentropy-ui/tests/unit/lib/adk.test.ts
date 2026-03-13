import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { AdkMessageStreamNormalizer } from "@/lib/adk";

describe("AdkMessageStreamNormalizer", () => {
  it("在 content.parts 中 text 与 functionCall 交替时正确分割消息", () => {
    const normalizer = new AdkMessageStreamNormalizer();
    const events = normalizer.consume(
      {
        id: "payload-1",
        timestamp: 1000,
        author: "assistant",
        content: {
          parts: [
            { text: "好的，我将使用 Web 搜索获取信息。" },
            {
              functionCall: {
                id: "tool-search-1",
                name: "google_search",
                args: { q: "AfterShip" },
              },
            },
            { text: "## 信息摘要" },
          ],
        },
      },
      { threadId: "thread-1", runId: "run-1" },
    );

    // 应该有：TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT (第一段), TEXT_MESSAGE_END,
    //         TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END, CUSTOM(link),
    //         TEXT_MESSAGE_START (第二段), TEXT_MESSAGE_CONTENT (第二段)
    const textStarts = events.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_START,
    );
    const textContents = events.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_CONTENT,
    );
    const textEnds = events.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_END,
    );
    const toolStarts = events.filter(
      (event) => event.type === EventType.TOOL_CALL_START,
    );

    // 两段文本 = 2 个 TEXT_MESSAGE_START
    // 第一段文本在 functionCall 前被 flush（END）
    // 第二段文本新开一个 START
    expect(textStarts.length).toBeGreaterThanOrEqual(2);
    expect(textContents.length).toBeGreaterThanOrEqual(2);
    expect(textEnds.length).toBeGreaterThanOrEqual(1); // 至少第一段被 END
    expect(toolStarts).toHaveLength(1);

    // 验证第一段文本内容
    const firstContent = textContents[0];
    expect("delta" in firstContent && firstContent.delta).toBe(
      "好的，我将使用 Web 搜索获取信息。",
    );

    // 验证工具调用在两段文本之间
    const toolStartIndex = events.findIndex(
      (event) => event.type === EventType.TOOL_CALL_START,
    );
    const firstTextEndIndex = events.findIndex(
      (event) => event.type === EventType.TEXT_MESSAGE_END,
    );
    const secondTextStartIndex = events.findIndex(
      (event, index) =>
        index > toolStartIndex && event.type === EventType.TEXT_MESSAGE_START,
    );

    expect(firstTextEndIndex).toBeLessThan(toolStartIndex);
    expect(toolStartIndex).toBeLessThan(secondTextStartIndex);
  });

  it("hydration 路径生成的事件能正确表达工具调用前后的文本分段", () => {
    const normalizer = new AdkMessageStreamNormalizer();

    // 模拟两个 payload：第一个包含混合 content，第二个包含 functionResponse
    const events1 = normalizer.consume(
      {
        id: "payload-1",
        timestamp: 1000,
        author: "assistant",
        content: {
          parts: [
            { text: "我来搜索一下。" },
            {
              functionCall: {
                id: "tool-1",
                name: "google_search",
                args: { q: "test" },
              },
            },
          ],
        },
      },
      { threadId: "thread-1", runId: "run-1" },
    );

    const events2 = normalizer.consume(
      {
        id: "payload-2",
        timestamp: 1001,
        content: {
          parts: [
            {
              functionResponse: {
                id: "tool-1",
                response: { result: "search results" },
              },
            },
          ],
        },
      },
      { threadId: "thread-1", runId: "run-1" },
    );

    const events3 = normalizer.consume(
      {
        id: "payload-3",
        timestamp: 1002,
        author: "assistant",
        content: {
          parts: [{ text: "搜索结果如下。" }],
        },
      },
      { threadId: "thread-1", runId: "run-1" },
    );

    const allEvents = [...events1, ...events2, ...events3];

    // 验证有工具调用结果
    const toolResults = allEvents.filter(
      (event) => event.type === EventType.TOOL_CALL_RESULT,
    );
    expect(toolResults).toHaveLength(1);

    // 验证有至少两段文本
    const textContents = allEvents.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_CONTENT,
    );
    expect(textContents.length).toBeGreaterThanOrEqual(2);
  });
});
