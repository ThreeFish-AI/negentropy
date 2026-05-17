/**
 * state-delta smoke 测试：覆盖核心路径与「显式清空」语义。
 *
 * 完整覆盖由 ui 端 tests/unit/api/agui-route-state.test.ts 通过 shim 提供。
 */
import { describe, expect, it } from "vitest";
import { buildStateDeltaFromForwardedProps } from "@negentropy/agents-chat-core/server";

const VALID_UUID = "f336d0bc-b841-465b-8045-024475c079dd";

describe("buildStateDeltaFromForwardedProps", () => {
  it("forwardedProps 为 null → 空对象", () => {
    expect(buildStateDeltaFromForwardedProps(null)).toEqual({});
  });

  it("preferred_subagent 字符串 → 写入", () => {
    const out = buildStateDeltaFromForwardedProps({
      preferred_subagent: "PerceptionFaculty",
    });
    expect(out).toEqual({ preferred_subagent: "PerceptionFaculty" });
  });

  it("preferred_subagent = null → 写入 null（显式清空）", () => {
    const out = buildStateDeltaFromForwardedProps({ preferred_subagent: null });
    expect(out).toEqual({ preferred_subagent: null });
  });

  it("preferred_subagent 空串 → 不写入（保守不影响 session.state）", () => {
    const out = buildStateDeltaFromForwardedProps({ preferred_subagent: "" });
    expect(out).toEqual({});
  });

  it("scoped_corpus_ids 数组 → 过滤、去重、保持首现顺序", () => {
    const out = buildStateDeltaFromForwardedProps({
      scoped_corpus_ids: [VALID_UUID, "not-uuid", VALID_UUID],
    });
    expect(out).toEqual({ scoped_corpus_ids: [VALID_UUID] });
  });

  it("scoped_corpus_ids 空数组 → 写入 []（显式清空）", () => {
    const out = buildStateDeltaFromForwardedProps({ scoped_corpus_ids: [] });
    expect(out).toEqual({ scoped_corpus_ids: [] });
  });

  it("scoped_corpus_ids 非数组（字符串）→ 不写入", () => {
    const out = buildStateDeltaFromForwardedProps({
      scoped_corpus_ids: "not-array",
    });
    expect(out).toEqual({});
  });

  it("graph_mode_corpus_ids 与 output_corpus_ids 共用相同 sanitize 路径", () => {
    const out = buildStateDeltaFromForwardedProps({
      graph_mode_corpus_ids: [VALID_UUID],
      output_corpus_ids: [],
    });
    expect(out).toEqual({
      graph_mode_corpus_ids: [VALID_UUID],
      output_corpus_ids: [],
    });
  });

  it("selected_llm_model + thinking_enabled 复合写入", () => {
    const out = buildStateDeltaFromForwardedProps({
      selected_llm_model: "claude-opus-4-7",
      thinking_enabled: true,
    });
    expect(out).toEqual({
      selected_llm_model: "claude-opus-4-7",
      thinking_enabled: true,
    });
  });
});
