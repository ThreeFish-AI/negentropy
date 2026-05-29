import { describe, expect, it } from "vitest";
import { buildStateDeltaFromForwardedProps } from "@negentropy/agents-chat-core/server";

const UUID_A = "11111111-2222-3333-4444-555555555555";
const UUID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_C = "12345678-1234-1234-1234-123456789abc";

describe("buildStateDeltaFromForwardedProps", () => {
  it("透传 selected_llm_model 与 thinking_enabled 到 session state_delta", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        selected_llm_model: "openai/gpt-5-mini",
        thinking_enabled: true,
      }),
    ).toEqual({
      selected_llm_model: "openai/gpt-5-mini",
      thinking_enabled: true,
    });
  });

  it("仅接受 boolean thinking_enabled，避免污染 state", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        thinking_enabled: "true",
      }),
    ).toEqual({});
  });

  // ----------------------------------------------------------------------
  // @ Agent —— preferred_agent
  // ----------------------------------------------------------------------

  it("透传非空 preferred_agent 字符串", () => {
    expect(
      buildStateDeltaFromForwardedProps({ preferred_agent: "PerceptionFaculty" }),
    ).toEqual({ preferred_agent: "PerceptionFaculty" });
  });

  it("preferred_agent 显式为 null 时透传 null（用于清空）", () => {
    expect(buildStateDeltaFromForwardedProps({ preferred_agent: null })).toEqual({
      preferred_agent: null,
    });
  });

  it("preferred_agent 空串 / 超长 / 非字符串一律忽略", () => {
    expect(buildStateDeltaFromForwardedProps({ preferred_agent: "" })).toEqual({});
    expect(
      buildStateDeltaFromForwardedProps({ preferred_agent: "X".repeat(129) }),
    ).toEqual({});
    expect(buildStateDeltaFromForwardedProps({ preferred_agent: 123 })).toEqual({});
  });

  // ----------------------------------------------------------------------
  // @ Corpus —— corpus_ids
  // ----------------------------------------------------------------------

  it("透传合法 UUID 列表 corpus_ids", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        corpus_ids: [UUID_A, UUID_B],
      }),
    ).toEqual({ corpus_ids: [UUID_A, UUID_B] });
  });

  it("corpus_ids 中非 UUID 条目被过滤掉", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        corpus_ids: [UUID_A, "not-a-uuid", null, 42, UUID_B],
      }),
    ).toEqual({ corpus_ids: [UUID_A, UUID_B] });
  });

  it("corpus_ids 显式空数组 → 写入空数组（清空语义）", () => {
    // 关键回归：跨 turn 残留修复 —— 前端在用户移除 @ Corpus 后会显式发送 []，
    // BFF 据此写入 state_delta 触发 ADK session.state 中 ``corpus_ids`` 的清空。
    expect(
      buildStateDeltaFromForwardedProps({ corpus_ids: [] }),
    ).toEqual({ corpus_ids: [] });
  });

  it("corpus_ids 全部非法 → 写入空数组（清空语义）", () => {
    // 数组类型合法但条目全部非法 → sanitize 为 [] → 视作显式清空，
    // 与「显式空数组」走同一路径，避免脏值阻塞清空。
    expect(
      buildStateDeltaFromForwardedProps({
        corpus_ids: ["x", null, 1],
      }),
    ).toEqual({ corpus_ids: [] });
  });

  it("corpus_ids 自动去重并保持首现顺序", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        corpus_ids: [UUID_A, UUID_B, UUID_A, UUID_C],
      }),
    ).toEqual({ corpus_ids: [UUID_A, UUID_B, UUID_C] });
  });

  it("corpus_ids 非数组类型整体忽略（保留旧 session.state）", () => {
    // 非数组（含字符串 / 对象 / undefined 等）→ 不写 state_delta；
    // 这是「字段类型不合法」与「显式清空」的边界。
    expect(
      buildStateDeltaFromForwardedProps({ corpus_ids: UUID_A }),
    ).toEqual({});
    expect(
      buildStateDeltaFromForwardedProps({ corpus_ids: { 0: UUID_A } }),
    ).toEqual({});
  });

  it("corpus_ids 字段不存在 → 不写入 state_delta", () => {
    // 区分「字段缺席」与「显式清空」：缺席不应清空旧值（向后兼容旧调用方）。
    expect(buildStateDeltaFromForwardedProps({})).toEqual({});
  });

  // ----------------------------------------------------------------------
  // 已废弃字段：旧 scoped/output/graph_mode 应被静默丢弃，不污染 state_delta
  // ----------------------------------------------------------------------

  it("旧字段 scoped_corpus_ids / output_corpus_ids / graph_mode_corpus_ids 被忽略", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: [UUID_A],
        output_corpus_ids: [UUID_B],
        graph_mode_corpus_ids: [UUID_C],
      }),
    ).toEqual({});
  });

  // ----------------------------------------------------------------------
  // 综合：模型 + Thinking + agent + corpus
  // ----------------------------------------------------------------------

  it("可同时透传所有受支持字段", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        selected_llm_model: "anthropic/claude-opus-4-7",
        thinking_enabled: true,
        preferred_agent: "ActionFaculty",
        corpus_ids: [UUID_A, UUID_B],
      }),
    ).toEqual({
      selected_llm_model: "anthropic/claude-opus-4-7",
      thinking_enabled: true,
      preferred_agent: "ActionFaculty",
      corpus_ids: [UUID_A, UUID_B],
    });
  });

  it("forwardedProps 为 null → 返回空对象", () => {
    expect(buildStateDeltaFromForwardedProps(null)).toEqual({});
  });
});
