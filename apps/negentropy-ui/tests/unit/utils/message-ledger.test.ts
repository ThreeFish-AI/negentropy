import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import {
  buildMessageLedger,
  isSemanticEquivalentEntry,
  isSyntheticRunId,
  mergeMessageLedger,
} from "@/utils/message-ledger";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@negentropy/agents-chat-core/protocol";

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

  it("长耗时回复（>8 秒）也能在 realtime 与 hydration 间正确去重", () => {
    // 场景：ADK 仅持久化 partial=false 终态事件，realtime 用首个 partial 的 id
    // (a1)、hydration 用终态自身的 id (f)，二者 messageId 不同；当一段回复生成耗时
    // 超过 8 秒（多段落 / 列表型答复常见），原有时间窗硬拒绝会让两条 entry 各
    // 自成形，最终在 UI 形成双气泡。content 严格相等时应直接判为同一逻辑消息。
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-live-a1",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content:
            "Pong:\n\n- 已收到回执\n- 关于 \"Pong\" 的几点说明\n- 后续步骤",
          createdAt: new Date("2026-04-27T10:00:00.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-live-a1"],
        },
      ],
      [
        {
          id: "assistant-final-f",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "fallback_assistant",
          content:
            "Pong:\n\n- 已收到回执\n- 关于 \"Pong\" 的几点说明\n- 后续步骤",
          // 与 realtime createdAt 相差 15 秒，超过 8 秒时间窗
          createdAt: new Date("2026-04-27T10:00:15.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "fallback",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-final-f"],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live-a1", "assistant-final-f"]),
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

  it("ISSUE-070：同时间戳下 user 消息始终排在 assistant 之前（角色优先）", () => {
    // 模拟时钟漂移：assistant 时间戳早 1ms（service clock 漂移），user 后到。
    // 但业务正确顺序应当是 user 在前、assistant 在后；新排序按 role 优先解决。
    const events: AgUiEvent[] = [
      // assistant 先到（事件序 0）
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "asst-1",
        role: "assistant",
        timestamp: 1000.001, // 早 1ms
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "asst-1",
        delta: "答复",
        timestamp: 1000.001,
      }),
      // user 后到（事件序 2），但时间戳更晚
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "user-1",
        role: "user",
        timestamp: 1000.001, // 同时间戳
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "user-1",
        delta: "提问",
        timestamp: 1000.001,
      }),
    ];
    const ledger = buildMessageLedger({ events });
    // 修复后：同时间戳下 user 必排在 assistant 之前
    expect(ledger.map((e) => e.resolvedRole)).toEqual(["user", "assistant"]);
  });

  it("buildMessageLedger 在 createdAt 相同的事件下用 sourceOrder 保持原始时间序", () => {
    // 两条 user/assistant 消息 timestamp 完全相同；UUID 字典序与原始事件序刚好相反。
    // 引入 sourceOrder 后，排序应仍然按事件出现顺序而非 UUID localeCompare。
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "z-message",
        role: "user",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "z-message",
        delta: "z first",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "z-message",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "a-message",
        role: "assistant",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "a-message",
        delta: "a second",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "a-message",
        timestamp: 1000,
      }),
    ];

    const ledger = buildMessageLedger({ events });
    expect(ledger.map((entry) => entry.id)).toEqual(["z-message", "a-message"]);
  });

  describe("ISSUE-041: 跨 runId（synthetic）语义匹配", () => {
    // ISSUE-041：后端 ADK Web /sessions/{id} 不透传 runId，前端 fallback 到
    // sessionId（synthetic runId === threadId），导致 hydration 与 realtime
    // 同一逻辑消息分裂为两个 turn → UI 双气泡。本组用例验证 isSyntheticRunId
    // 与 isSemanticEquivalentEntry 的协同放宽行为。

    const baseRealtime = {
      id: "assistant-uuid-actual-run-1-0",
      threadId: "session-abc",
      runId: "uuid-actual-run-1",
      resolvedRole: "assistant" as const,
      resolutionSource: "explicit_role" as const,
      content: "Pong 🏓 Anything else I can help with?",
      createdAt: new Date("2026-04-29T10:00:00.000Z"),
      streaming: false,
      lifecycle: "closed" as const,
      origin: "realtime" as const,
      sourceEventTypes: ["TEXT_MESSAGE_END"],
      relatedMessageIds: ["assistant-uuid-actual-run-1-0"],
    };

    const baseFallbackSynthetic = {
      ...baseRealtime,
      // 合成 runId === threadId，模拟 hydration 后端不透传 runId 的兜底
      runId: "session-abc",
      origin: "fallback" as const,
      sourceEventTypes: ["fallback.message"],
      relatedMessageIds: ["assistant-session-abc-0"],
    };

    it("A1: synthetic runId(=threadId) + 真 runId 同内容 → 视为语义等价", () => {
      const result = isSemanticEquivalentEntry(baseRealtime, baseFallbackSynthetic);
      expect(result).toBe(true);
    });

    it("A2: synthetic runId(=DEFAULT_RUN_ID) + 真 runId 同内容 → 视为语义等价", () => {
      const fallbackDefault = {
        ...baseFallbackSynthetic,
        runId: "default-run",
      };
      const result = isSemanticEquivalentEntry(baseRealtime, fallbackDefault);
      expect(result).toBe(true);
    });

    it("A3: 双方都是真 runId 但不同 → 不等价（不误折叠合法多 run）", () => {
      const otherRun = {
        ...baseFallbackSynthetic,
        runId: "uuid-actual-run-2",
        origin: "realtime" as const,
      };
      const result = isSemanticEquivalentEntry(baseRealtime, otherRun);
      expect(result).toBe(false);
    });

    it("A4: synthetic runId 但 threadId 不同 → 不等价（threadId 仍是必要约束）", () => {
      const otherThread = {
        ...baseFallbackSynthetic,
        threadId: "session-xyz",
        runId: "session-xyz", // 同样是合成 runId，但 threadId 不同
      };
      const result = isSemanticEquivalentEntry(baseRealtime, otherThread);
      expect(result).toBe(false);
    });

    it("A5: synthetic runId 但 origin 都是 realtime → 不等价（origin 多元仍是必要约束）", () => {
      const realtimeSynthetic = {
        ...baseFallbackSynthetic,
        origin: "realtime" as const, // 双方都 realtime
      };
      const result = isSemanticEquivalentEntry(baseRealtime, realtimeSynthetic);
      expect(result).toBe(false);
    });

    it("isSyntheticRunId 单元行为（覆盖各分支）", () => {
      // 1. runId 缺失 → synthetic
      expect(isSyntheticRunId({ runId: undefined, threadId: "t" })).toBe(true);
      expect(isSyntheticRunId({ threadId: "t" })).toBe(true);
      // 2. DEFAULT_RUN_ID → synthetic
      expect(isSyntheticRunId({ runId: "default-run", threadId: "t" })).toBe(true);
      expect(isSyntheticRunId({ runId: "default", threadId: "t" })).toBe(true);
      // 3. runId === threadId → synthetic（hydration fallback）
      expect(isSyntheticRunId({ runId: "session-abc", threadId: "session-abc" })).toBe(true);
      // 4. 真实 runId（不等于 threadId 也不是 default） → 非 synthetic
      expect(isSyntheticRunId({ runId: "uuid-1", threadId: "session-abc" })).toBe(false);
    });

    it("ISSUE-041 端到端 ledger merge：双源（realtime + synthetic fallback）合并为单条", () => {
      // 模拟双气泡场景：realtime turn:uuid-1 与 hydration turn:sessionId 同 Pong 内容。
      const merged = mergeMessageLedger([baseRealtime], [baseFallbackSynthetic]);
      expect(merged).toHaveLength(1);
      // 真 runId 应胜出（realtime 优先）
      expect(merged[0]?.runId).toBe("uuid-actual-run-1");
      expect(merged[0]?.relatedMessageIds).toEqual(
        expect.arrayContaining([
          "assistant-uuid-actual-run-1-0",
          "assistant-session-abc-0",
        ]),
      );
    });
  });

  // ============================================================================
  // ISSUE-060：流式累积残缺版 + final 完整版的根因层合并（v1 仅在 chat-display
  // 兜底，v2 改为 ledger 真正合并 → conversation-tree 不再分裂双 text node）。
  // ============================================================================
  describe("ISSUE-060: 残缺累积版 vs final 完整版的根因层合并", () => {
    const partial = {
      id: "assistant-streaming",
      threadId: "session-bug",
      runId: "uuid-real-run",
      resolvedRole: "assistant" as const,
      resolutionSource: "explicit_role" as const,
      // 流式 chunk 拼接的残缺中间态（无空格 + 缺字）
      content:
        '"Hello, test1234"\n已完成：可能的后续需求：- 仅返回严格的精确字符串（如果你需要机器校或管道输入），或- 该记录到/日志或- 将嵌入到更长的消息文档中。',
      createdAt: new Date("2026-05-06T12:23:32.000Z"),
      streaming: false,
      lifecycle: "closed" as const,
      origin: "realtime" as const,
      sourceEventTypes: ["TEXT_MESSAGE_END"],
      relatedMessageIds: ["assistant-streaming"],
    };

    const finalHydrated = {
      ...partial,
      // hydration 拉到的 final 完整版（有空格 + 完整字符 + markdown 列表展开）
      content:
        '"Hello, test 1234"\n已完成：可能的后续需求：\n- 仅返回严格的精确字符串（如果你需要机器校验或管道输入），或\n- 把该字符串记录到系统/日志，或\n- 将其嵌入到更长的消息/文档中。\n请指示你要执行的选项。',
      createdAt: new Date("2026-05-06T12:23:57.000Z"),
      origin: "fallback" as const,
      sourceEventTypes: ["fallback.message"],
      relatedMessageIds: ["assistant-streaming"],
    };

    it("命中：非前缀但 multiset 覆盖 ≥0.85 → 视为同源（根因层合并）", () => {
      // 严格前缀检查会失败（一个 "test1234" 一个 "test 1234"，且 final 含
      // markdown list / 多余字符），但 partial 的字符 multiset 几乎都是 final 的子集。
      const result = isSemanticEquivalentEntry(partial, finalHydrated);
      expect(result).toBe(true);
    });

    it("不命中：内容主题完全不同（覆盖 < 0.85）→ 保留两条独立消息", () => {
      const independent = {
        ...finalHydrated,
        content:
          "今天天气很好，建议出去走走，享受春日阳光。也可以读一本书或听音乐。",
      };
      // partial 的字符（Hello / test / 已完成 / 后续 等）几乎不在 independent 中
      expect(isSemanticEquivalentEntry(partial, independent)).toBe(false);
    });

    it("不命中：长度比 < 1.1（双方实际就是相邻的两段独立消息）→ 不合并", () => {
      const tooClose = {
        ...finalHydrated,
        content: '"Hello, test1234"\n已完成查询', // 长度 < partial 的 1.1 倍
      };
      // 长度比兜底应在 multiset 计算前 short-circuit
      expect(isSemanticEquivalentEntry(partial, tooClose)).toBe(false);
    });

    it("端到端 ledger merge：partial + final 应合并为 1 条 entry", () => {
      const merged = mergeMessageLedger([partial], [finalHydrated]);
      expect(merged).toHaveLength(1);
      // 合并后保留更长的 final 内容（upsertEntry 取较长内容）
      expect(merged[0]?.content.length).toBeGreaterThanOrEqual(finalHydrated.content.length);
      // 关键守卫：合并后的内容含 final 中的 markdown 列表标记
      expect(merged[0]?.content).toContain("机器校验");
      expect(merged[0]?.content).toContain("消息/文档");
    });

    it("端到端 ledger merge：内容主题不同（覆盖率不足）→ 不合并，保留 2 条", () => {
      // 关键：用不同 messageId / runId 让 by-id key 匹配失败，从而走
      // findSemanticLedgerKey 的语义等价路径；此时 multiset 覆盖率不足应拒绝合并。
      const independent = {
        ...finalHydrated,
        id: "assistant-different-message",
        runId: "uuid-different-run",
        content:
          "今天天气很好，建议出去走走，享受春日阳光。也可以读一本书或听音乐。",
        relatedMessageIds: ["assistant-different-message"],
      };
      const merged = mergeMessageLedger([partial], [independent]);
      expect(merged).toHaveLength(2);
    });
  });

  // ISSUE-042 补丁：同时间戳下 TEXT_MESSAGE_START→CONTENT→END 的排序不被穿插
  describe("sort tiebreaker: EVENT_TYPE_ORDER", () => {
    it("同时间戳下 START → CONTENT → END 保持正确生命周期顺序", () => {
      const ts = 1000;
      const events = [
        createTestEvent({
          type: EventType.TEXT_MESSAGE_END,
          threadId: "t1",
          runId: "r1",
          messageId: "m1",
          timestamp: ts,
          role: "assistant",
        }),
        createTestEvent({
          type: EventType.TEXT_MESSAGE_CONTENT,
          threadId: "t1",
          runId: "r1",
          messageId: "m1",
          timestamp: ts,
          delta: "Hello",
          role: "assistant",
        }),
        createTestEvent({
          type: EventType.TEXT_MESSAGE_START,
          threadId: "t1",
          runId: "r1",
          messageId: "m1",
          timestamp: ts,
          role: "assistant",
        }),
      ];

      const ledger = buildMessageLedger({ events });
      // 三个事件应被聚合为 1 条 ledger entry
      expect(ledger).toHaveLength(1);
      // content 应正确累积（不被乱序截断）
      expect(ledger[0]?.content).toBe("Hello");
      // lifecycle 应为 closed（END 事件标记了关闭）
      expect(ledger[0]?.lifecycle).toBe("closed");
    });

    it("同时间戳下不同 messageId 的事件各自独立", () => {
      const ts = 1000;
      const events = [
        createTestEvent({
          type: EventType.TEXT_MESSAGE_START,
          threadId: "t1",
          runId: "r1",
          messageId: "m1",
          timestamp: ts,
          role: "assistant",
        }),
        createTestEvent({
          type: EventType.TEXT_MESSAGE_START,
          threadId: "t1",
          runId: "r1",
          messageId: "m2",
          timestamp: ts,
          role: "assistant",
        }),
        createTestEvent({
          type: EventType.TEXT_MESSAGE_CONTENT,
          threadId: "t1",
          runId: "r1",
          messageId: "m1",
          timestamp: ts,
          delta: "First",
          role: "assistant",
        }),
        createTestEvent({
          type: EventType.TEXT_MESSAGE_CONTENT,
          threadId: "t1",
          runId: "r1",
          messageId: "m2",
          timestamp: ts,
          delta: "Second",
          role: "assistant",
        }),
      ];

      const ledger = buildMessageLedger({ events });
      expect(ledger).toHaveLength(2);
      expect(ledger.map((e) => e.content).sort()).toEqual(["First", "Second"]);
    });
  });
});
