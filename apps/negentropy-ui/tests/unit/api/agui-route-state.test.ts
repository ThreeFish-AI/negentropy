import { describe, expect, it } from "vitest";
import { buildStateDeltaFromForwardedProps } from "@/app/api/agui/route";

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
});
