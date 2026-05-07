/**
 * message 工具函数单元测试
 *
 * 测试消息合并、格式化功能
 */

import { describe, it, expect } from "vitest";
import {
  mergeAdjacentAssistant,
  mapMessagesToChat,
  buildChatMessagesFromEventsWithFallback,
  longestCommonSubsequenceRatio,
  accumulateTextContent,
} from "@/utils/message";
import type { ChatMessage } from "@/types/common";
import {
  createTestMessage,
  createTestTextMessageEvents,
} from "@/tests/helpers/agui";
import type { AgUiEvent, AgUiMessage } from "@/types/agui";

function buildTextEvents(input: {
  messageId: string;
  role: "user" | "assistant" | "agent" | "system";
  delta: string;
  timestamp?: number;
}): AgUiEvent[] {
  return createTestTextMessageEvents({
    messageId: input.messageId,
    role: input.role,
    delta: input.delta,
    timestamp: input.timestamp ?? 0,
  }).map((event) =>
    input.timestamp === undefined ? { ...event, timestamp: undefined } : event,
  );
}

describe("mergeAdjacentAssistant", () => {
  it("应该合并相邻的 assistant 消息（无 runId，使用 \\n\\n 分隔）", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "First message" },
      { id: "2", role: "assistant", content: "Second message" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("First message\n\nSecond message");
  });

  it("应该直接拼接相同 runId 的相邻 assistant 消息（流式 token 碎片）", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "First", runId: "run-1" },
      { id: "2", role: "assistant", content: " Second", runId: "run-1" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("First Second");
  });

  it("应该用 \\n\\n 分隔不同 runId 的相邻 assistant 消息（多轮次答复）", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "Run 1 reply", runId: "run-1" },
      { id: "2", role: "assistant", content: "Run 2 reply", runId: "run-2" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Run 1 reply\n\nRun 2 reply");
  });

  it("应该不合并 user 消息", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi there" },
      { id: "3", role: "user", content: "How are you?" },
      { id: "4", role: "assistant", content: "I'm fine" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("user");
    expect(result[3].role).toBe("assistant");
  });

  it("应该处理空数组", () => {
    const result = mergeAdjacentAssistant([]);
    expect(result).toHaveLength(0);
  });

  it("应该处理单个消息", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "Single message" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Single message");
  });

  it("应该合并多个相邻的同 runId assistant 消息（流式碎片）", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "First", runId: "run-1" },
      { id: "2", role: "assistant", content: " Second", runId: "run-1" },
      { id: "3", role: "assistant", content: " Third", runId: "run-1" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("First Second Third");
  });

  it("应该正确处理混合的 runId 序列", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "A1", runId: "run-1" },
      { id: "2", role: "assistant", content: " A2", runId: "run-1" },
      { id: "3", role: "assistant", content: "B1", runId: "run-2" },
      { id: "4", role: "assistant", content: " B2", runId: "run-2" },
    ];
    const result = mergeAdjacentAssistant(messages);
    expect(result).toHaveLength(1);
    // run-1 碎片直接拼接，run-1 与 run-2 之间用 \n\n 分隔，run-2 碎片直接拼接
    expect(result[0].content).toBe("A1 A2\n\nB1 B2");
  });
});

describe("mapMessagesToChat", () => {
  it("应该过滤 tool 和 system 角色", () => {
    const messages: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "user", content: "Hello" }),
      createTestMessage({ id: "2", role: "system", content: "You are helpful" }),
      createTestMessage({ id: "3", role: "tool", content: "Tool result" }),
      createTestMessage({ id: "4", role: "assistant", content: "Hi there" }),
    ];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  it("应该保持所有消息的独立性（不合并）", () => {
    const messages: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "assistant", content: "First" }),
      createTestMessage({ id: "2", role: "assistant", content: "Second" }),
    ];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(2);
    // 不添加分隔符，保持原样
    expect(result[0].content).toBe("First");
    expect(result[1].content).toBe("Second");
  });

  it("应该处理 agent 角色为 assistant", () => {
    const messages: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "agent", content: "Agent response" }),
    ];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
  });

  it("应该过滤空内容", () => {
    const messages: AgUiMessage[] = [
      createTestMessage({ id: "1", role: "assistant", content: "" }),
      createTestMessage({ id: "2", role: "user", content: "Hello" }),
    ];
    const result = mapMessagesToChat(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });
});

describe("buildChatMessagesFromEventsWithFallback - sorting", () => {
  it("应该按 timestamp 排序消息", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: AgUiEvent[] = [
      ...buildTextEvents({ messageId: "msg2", role: "user", delta: "Content 2", timestamp: 2000 }),
      ...buildTextEvents({ messageId: "msg1", role: "user", delta: "Content 1", timestamp: 1000 }),
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("msg1");
    expect(result[1].id).toBe("msg2");
  });

  it("应该在 timestamp 相同时使用 messageId 作为稳定排序键", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: AgUiEvent[] = [
      ...buildTextEvents({ messageId: "msg_z", role: "user", delta: "Z", timestamp: 1000 }),
      ...buildTextEvents({ messageId: "msg_a", role: "user", delta: "A", timestamp: 1000 }),
      ...buildTextEvents({ messageId: "msg_m", role: "user", delta: "M", timestamp: 1000 }),
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(3);
    // 字典序：msg_a < msg_m < msg_z
    expect(result[0].id).toBe("msg_a");
    expect(result[1].id).toBe("msg_m");
    expect(result[2].id).toBe("msg_z");
  });

  it("应该正确处理没有 timestamp 的消息", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: AgUiEvent[] = [
      ...buildTextEvents({ messageId: "msg_z", role: "user", delta: "Z" }),
      ...buildTextEvents({ messageId: "msg_a", role: "user", delta: "A" }),
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(2);
    // 没有 timestamp 时，使用 messageId 排序
    expect(result[0].id).toBe("msg_a");
    expect(result[1].id).toBe("msg_z");
  });

  it("应该优先处理有 timestamp 的消息", () => {
    // 使用不同角色来避免被 mergeAdjacentAssistant 合并
    const events: AgUiEvent[] = [
      ...buildTextEvents({ messageId: "msg_no_ts", role: "user", delta: "No TS" }),
      ...buildTextEvents({
        messageId: "msg_with_ts",
        role: "user",
        delta: "With TS",
        timestamp: 1000,
      }),
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(2);
    // 有 timestamp 的消息排在前面
    expect(result[0].id).toBe("msg_with_ts");
    expect(result[1].id).toBe("msg_no_ts");
  });

  it("应该使用最早的 timestamp（优化后的逻辑）", () => {
    const events: AgUiEvent[] = [
      {
        ...buildTextEvents({
          messageId: "msg1",
          role: "assistant",
          delta: "Hello",
          timestamp: 2000,
        })[0],
        timestamp: 2000,
      },
      {
        ...buildTextEvents({
          messageId: "msg1",
          role: "assistant",
          delta: "Hello",
          timestamp: 1000,
        })[1],
        timestamp: 1000,
      },
      {
        ...buildTextEvents({
          messageId: "msg1",
          role: "assistant",
          delta: "Hello",
          timestamp: 1000,
        })[2],
        timestamp: 1000,
      },
    ];
    const result = buildChatMessagesFromEventsWithFallback(events, []);
    expect(result).toHaveLength(1);
    // 结果应该包含内容
    expect(result[0].id).toBe("msg1");
    expect(result[0].content).toBe("Hello");
  });
});

describe("longestCommonSubsequenceRatio (ISSUE-070 LCS 兜底)", () => {
  it("完全相同的字符串 → 1.0", () => {
    expect(longestCommonSubsequenceRatio("hello world", "hello world")).toBe(1);
  });

  it("空串 → 0", () => {
    expect(longestCommonSubsequenceRatio("", "abc")).toBe(0);
    expect(longestCommonSubsequenceRatio("abc", "")).toBe(0);
  });

  it("一方是另一方的前缀 → 接近 1.0", () => {
    const ratio = longestCommonSubsequenceRatio("Pong!", "Pong! Next options");
    expect(ratio).toBeCloseTo(1, 5);
  });

  it("同源不同表面（图 1 partial 残缺版 vs final 完整版）→ ≥ 0.65", () => {
    const partial = "Pong. Summary done- ong toPing Possible needs concrete ping";
    const final =
      "Pong. Summary — done: Replied Pong to your Ping. Next options Continue ping pong exchanges.";
    const ratio = longestCommonSubsequenceRatio(partial, final);
    // 残缺版字符在 final 中按顺序广泛出现，应当 ≥ 0.65 命中第 6 层兜底
    expect(ratio).toBeGreaterThanOrEqual(0.65);
  });

  it("两段完全不相关的内容 → 显著低于 0.65", () => {
    const ratio = longestCommonSubsequenceRatio(
      "今日天气晴朗适合出行散步看看花草",
      "我喜欢吃苹果香蕉葡萄这些水果都很甜",
    );
    expect(ratio).toBeLessThan(0.5);
  });

  it("长内容（>2000 字）且高度同源时仍能 ≥ 0.65（评审：分母用截断后长度）", () => {
    // 评审 #2：截断到首尾各 1000 后 lcsLen ≤ 2000；旧实现用「截断前长度」做
    // 分母，对 ≥ 3077 字的同源内容上界 < 0.65，第 6 层 LCS 兜底永远不触发。
    // 现在分母改为「实际参与 LCS 计算的较短串长度」（截断后），保持语义自洽。
    const base = "abcdefghij".repeat(400); // 4000 chars
    const earlier = base; // 4000
    const later = `${base}<additional tail content for length differentiation>`;
    const ratio = longestCommonSubsequenceRatio(earlier, later);
    expect(ratio).toBeGreaterThanOrEqual(0.65);
  });
});

describe("accumulateTextContent (ISSUE-071 改写覆盖检测)", () => {
  it("追加场景：incoming 是 existing 的延续 → 拼接", () => {
    expect(accumulateTextContent("Hello ", "Hello world")).toBe("Hello world");
    expect(accumulateTextContent("Hello", " world")).toBe("Hello world");
  });

  it("严格前缀场景：existing 是 incoming 前缀 → 用 incoming 替换", () => {
    expect(accumulateTextContent("Hello", "Hello world!")).toBe("Hello world!");
  });

  it("空内容：existing 空 → incoming；incoming 空 → existing", () => {
    expect(accumulateTextContent("", "abc")).toBe("abc");
    expect(accumulateTextContent("abc", "")).toBe("abc");
  });

  it("ISSUE-071 根因：partial 残缺中文段 + final 完整改写版 → 仅保留 final（避免 UI 双内容）", () => {
    // 来自 verify-log-2026-05-07.md 实测复现
    const partial =
      "负熵（negentropy）是指系统通过输入能量或入化信息来抵抗熵增，从而降低无序度增加序性信息量的量度。\n\n完成：了一句概念定义。可能的续：举（热学/信息/生物学数学述通。建议下一：一个——A 给通化子比，B) 提供信息论/数学定义与公式或 (C)集学术资料与引用我将此相流程。采选项";
    const final =
      "负熵（negentropy）是指系统通过输入能量或引入结构化信息来抵抗熵增，从而降低无序度、增加有序性或信息含量的量度。\n\n已完成：提供了一句概念性定义。\n可能的后续需求：需要举例（热力学/信息论/生物学）、数学表述或通俗解释。\n建议下一步：请选择一个方向——(A) 给出通俗化例子与比喻，(B) 提供信息论/数学定义与公式，或 (C) 搜集学术资料与引用；我将据此执行相应流程。是否采纳哪个选项？";
    const merged = accumulateTextContent(partial, final);
    expect(merged).toBe(final);
    expect(merged).not.toContain("入化信息");
    expect(merged).not.toContain("采选项");
  });

  it("不误删合法的「先短简介 + 后扩展」场景：当字符 multiset 覆盖不足 0.7 时拼接保留", () => {
    // 短介绍 + 完全不相关的扩展段，multiset coverage 应该非常低
    const intro = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const expansion = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    const merged = accumulateTextContent(intro, expansion);
    expect(merged).toBe(`${intro}${expansion}`);
  });

  it("短文本（< 50 字符）跳过改写检测，走原拼接逻辑", () => {
    // 改写检测最小长度 50，短文本不进入改写覆盖路径
    expect(accumulateTextContent("hi", "好")).toBe("hi好");
  });
});
