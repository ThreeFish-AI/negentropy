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

  it("preferred_agent 字符串 → 写入", () => {
    const out = buildStateDeltaFromForwardedProps({
      preferred_agent: "PerceptionFaculty",
    });
    expect(out).toEqual({ preferred_agent: "PerceptionFaculty" });
  });

  it("preferred_agent = null → 写入 null（显式清空）", () => {
    const out = buildStateDeltaFromForwardedProps({ preferred_agent: null });
    expect(out).toEqual({ preferred_agent: null });
  });

  it("preferred_agent 空串 → 不写入（保守不影响 session.state）", () => {
    const out = buildStateDeltaFromForwardedProps({ preferred_agent: "" });
    expect(out).toEqual({});
  });

  it("corpus_ids 数组 → 过滤、去重、保持首现顺序", () => {
    const out = buildStateDeltaFromForwardedProps({
      corpus_ids: [VALID_UUID, "not-uuid", VALID_UUID],
    });
    expect(out).toEqual({ corpus_ids: [VALID_UUID] });
  });

  it("corpus_ids 空数组 → 写入 []（显式清空）", () => {
    const out = buildStateDeltaFromForwardedProps({ corpus_ids: [] });
    expect(out).toEqual({ corpus_ids: [] });
  });

  it("corpus_ids 非数组（字符串）→ 不写入", () => {
    const out = buildStateDeltaFromForwardedProps({
      corpus_ids: "not-array",
    });
    expect(out).toEqual({});
  });

  it("已废弃字段（scoped/output/graph_mode）→ 被忽略，不写入 state_delta", () => {
    const out = buildStateDeltaFromForwardedProps({
      scoped_corpus_ids: [VALID_UUID],
      output_corpus_ids: [VALID_UUID],
      graph_mode_corpus_ids: [VALID_UUID],
    });
    expect(out).toEqual({});
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
