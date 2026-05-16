import { describe, expect, it } from "vitest";
import { buildStateDeltaFromForwardedProps } from "@/app/api/agui/_state-delta";

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
  // @ Agent —— preferred_subagent
  // ----------------------------------------------------------------------

  it("透传非空 preferred_subagent 字符串", () => {
    expect(
      buildStateDeltaFromForwardedProps({ preferred_subagent: "PerceptionFaculty" }),
    ).toEqual({ preferred_subagent: "PerceptionFaculty" });
  });

  it("preferred_subagent 显式为 null 时透传 null（用于清空）", () => {
    expect(buildStateDeltaFromForwardedProps({ preferred_subagent: null })).toEqual({
      preferred_subagent: null,
    });
  });

  it("preferred_subagent 空串 / 超长 / 非字符串一律忽略", () => {
    expect(buildStateDeltaFromForwardedProps({ preferred_subagent: "" })).toEqual({});
    expect(
      buildStateDeltaFromForwardedProps({ preferred_subagent: "X".repeat(129) }),
    ).toEqual({});
    expect(buildStateDeltaFromForwardedProps({ preferred_subagent: 123 })).toEqual({});
  });

  // ----------------------------------------------------------------------
  // @ Corpus 检索 —— scoped_corpus_ids
  // ----------------------------------------------------------------------

  it("透传合法 UUID 列表 scoped_corpus_ids", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: [UUID_A, UUID_B],
      }),
    ).toEqual({ scoped_corpus_ids: [UUID_A, UUID_B] });
  });

  it("scoped_corpus_ids 中非 UUID 条目被过滤掉", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: [UUID_A, "not-a-uuid", null, 42, UUID_B],
      }),
    ).toEqual({ scoped_corpus_ids: [UUID_A, UUID_B] });
  });

  it("scoped_corpus_ids 显式空数组 → 写入空数组（清空语义）", () => {
    // 关键回归：跨 turn 残留修复 —— 前端在用户移除 @ Corpus 后会显式发送 []，
    // BFF 据此写入 state_delta 触发 ADK session.state 中 ``scoped_corpus_ids`` 的清空。
    expect(
      buildStateDeltaFromForwardedProps({ scoped_corpus_ids: [] }),
    ).toEqual({ scoped_corpus_ids: [] });
  });

  it("scoped_corpus_ids 全部非法 → 写入空数组（清空语义）", () => {
    // 数组类型合法但条目全部非法 → sanitize 为 [] → 视作显式清空，
    // 与「显式空数组」走同一路径，避免脏值阻塞清空。
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: ["x", null, 1],
      }),
    ).toEqual({ scoped_corpus_ids: [] });
  });

  it("scoped_corpus_ids 自动去重并保持首现顺序", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: [UUID_A, UUID_B, UUID_A, UUID_C],
      }),
    ).toEqual({ scoped_corpus_ids: [UUID_A, UUID_B, UUID_C] });
  });

  it("scoped_corpus_ids 非数组类型整体忽略（保留旧 session.state）", () => {
    // 非数组（含字符串 / 对象 / undefined 等）→ 不写 state_delta；
    // 这是「字段类型不合法」与「显式清空」的边界。
    expect(
      buildStateDeltaFromForwardedProps({ scoped_corpus_ids: UUID_A }),
    ).toEqual({});
    expect(
      buildStateDeltaFromForwardedProps({ scoped_corpus_ids: { 0: UUID_A } }),
    ).toEqual({});
  });

  it("scoped_corpus_ids 字段不存在 → 不写入 state_delta", () => {
    // 区分「字段缺席」与「显式清空」：缺席不应清空旧值（向后兼容旧调用方）。
    expect(buildStateDeltaFromForwardedProps({})).toEqual({});
  });

  it("output_corpus_ids 显式空数组 → 写入空数组（清空语义）", () => {
    // 与 scoped_corpus_ids 同构 —— 防止上一轮的 output 沉淀目标遗留到下一轮。
    expect(
      buildStateDeltaFromForwardedProps({ output_corpus_ids: [] }),
    ).toEqual({ output_corpus_ids: [] });
  });

  // ----------------------------------------------------------------------
  // @ Corpus 输出 —— output_corpus_ids
  // ----------------------------------------------------------------------

  it("透传合法 UUID 列表 output_corpus_ids", () => {
    expect(
      buildStateDeltaFromForwardedProps({ output_corpus_ids: [UUID_A] }),
    ).toEqual({ output_corpus_ids: [UUID_A] });
  });

  it("output_corpus_ids 与 scoped_corpus_ids 可同时存在且互不影响", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: [UUID_A],
        output_corpus_ids: [UUID_B, UUID_C],
      }),
    ).toEqual({
      scoped_corpus_ids: [UUID_A],
      output_corpus_ids: [UUID_B, UUID_C],
    });
  });

  // ----------------------------------------------------------------------
  // 综合：模型 + Thinking + 三类 @ 一起
  // ----------------------------------------------------------------------

  it("可同时透传所有受支持字段", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        selected_llm_model: "anthropic/claude-opus-4-7",
        thinking_enabled: true,
        preferred_subagent: "ActionFaculty",
        scoped_corpus_ids: [UUID_A],
        output_corpus_ids: [UUID_B],
        graph_mode_corpus_ids: [UUID_C],
      }),
    ).toEqual({
      selected_llm_model: "anthropic/claude-opus-4-7",
      thinking_enabled: true,
      preferred_subagent: "ActionFaculty",
      scoped_corpus_ids: [UUID_A],
      output_corpus_ids: [UUID_B],
      graph_mode_corpus_ids: [UUID_C],
    });
  });

  // ----------------------------------------------------------------------
  // @graph — graph_mode_corpus_ids（强制启用图谱/跨 Corpus 桥接模式）
  // ----------------------------------------------------------------------

  it("透传合法 UUID 列表 graph_mode_corpus_ids", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        graph_mode_corpus_ids: [UUID_A, UUID_B],
      }),
    ).toEqual({ graph_mode_corpus_ids: [UUID_A, UUID_B] });
  });

  it("graph_mode_corpus_ids 显式空数组 → 写入空数组（清空语义）", () => {
    // 与 scoped_corpus_ids / output_corpus_ids 同构 —— 防止跨 turn 残留
    expect(
      buildStateDeltaFromForwardedProps({ graph_mode_corpus_ids: [] }),
    ).toEqual({ graph_mode_corpus_ids: [] });
  });

  it("graph_mode_corpus_ids 中非 UUID 条目被过滤掉", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        graph_mode_corpus_ids: [UUID_A, "garbage", 99, null, UUID_B],
      }),
    ).toEqual({ graph_mode_corpus_ids: [UUID_A, UUID_B] });
  });

  it("graph_mode_corpus_ids 非数组类型整体忽略", () => {
    expect(
      buildStateDeltaFromForwardedProps({ graph_mode_corpus_ids: UUID_A }),
    ).toEqual({});
  });

  it("graph_mode_corpus_ids 字段缺席 → 不写入 state_delta", () => {
    expect(
      buildStateDeltaFromForwardedProps({ scoped_corpus_ids: [UUID_A] }),
    ).toEqual({ scoped_corpus_ids: [UUID_A] });
  });

  it("forwardedProps 为 null → 返回空对象", () => {
    expect(buildStateDeltaFromForwardedProps(null)).toEqual({});
  });
});
