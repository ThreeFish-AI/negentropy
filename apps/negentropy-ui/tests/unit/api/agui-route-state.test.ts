import { describe, expect, it } from "vitest";
import { buildStateDeltaFromForwardedProps } from "@/app/api/agui/route";

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

  it("scoped_corpus_ids 全部非法 → 不写入 state_delta", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: ["x", null, 1],
      }),
    ).toEqual({});
  });

  it("scoped_corpus_ids 自动去重并保持首现顺序", () => {
    expect(
      buildStateDeltaFromForwardedProps({
        scoped_corpus_ids: [UUID_A, UUID_B, UUID_A, UUID_C],
      }),
    ).toEqual({ scoped_corpus_ids: [UUID_A, UUID_B, UUID_C] });
  });

  it("scoped_corpus_ids 非数组类型整体忽略", () => {
    expect(
      buildStateDeltaFromForwardedProps({ scoped_corpus_ids: UUID_A }),
    ).toEqual({});
    expect(
      buildStateDeltaFromForwardedProps({ scoped_corpus_ids: { 0: UUID_A } }),
    ).toEqual({});
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
      }),
    ).toEqual({
      selected_llm_model: "anthropic/claude-opus-4-7",
      thinking_enabled: true,
      preferred_subagent: "ActionFaculty",
      scoped_corpus_ids: [UUID_A],
      output_corpus_ids: [UUID_B],
    });
  });

  it("forwardedProps 为 null → 返回空对象", () => {
    expect(buildStateDeltaFromForwardedProps(null)).toEqual({});
  });
});
