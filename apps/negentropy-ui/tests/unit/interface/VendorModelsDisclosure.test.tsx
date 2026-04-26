import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VendorModelsDisclosure } from "@/components/interface/VendorModelsDisclosure";
import type { ModelConfigRecord } from "@/types/interface-models";

function makeModel(overrides: Partial<ModelConfigRecord> = {}): ModelConfigRecord {
  return {
    id: overrides.id ?? "m-1",
    model_type: overrides.model_type ?? "llm",
    display_name: overrides.display_name ?? "GPT-4o",
    vendor: overrides.vendor ?? "openai",
    model_name: overrides.model_name ?? "gpt-4o",
    is_default: overrides.is_default ?? false,
    enabled: overrides.enabled ?? true,
    config: overrides.config ?? {},
  };
}

describe("VendorModelsDisclosure", () => {
  it("该 vendor 无已启用模型时完全不渲染", () => {
    const { container } = render(
      <VendorModelsDisclosure
        vendor="anthropic"
        vendorLabel="Anthropic"
        models={[makeModel({ vendor: "openai", model_type: "llm" })]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("存在已启用模型时默认收起并展示总数", () => {
    render(
      <VendorModelsDisclosure
        vendor="openai"
        vendorLabel="OpenAI"
        models={[
          makeModel({ id: "a", model_type: "llm", display_name: "GPT-4o" }),
          makeModel({ id: "b", model_type: "embedding", display_name: "TextEmb3" }),
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /OpenAI 已启用模型/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("GPT-4o")).not.toBeInTheDocument();
  });

  it("点击后展开，仅渲染非空分组", async () => {
    const user = userEvent.setup();
    render(
      <VendorModelsDisclosure
        vendor="openai"
        vendorLabel="OpenAI"
        models={[
          makeModel({ id: "a", model_type: "llm", display_name: "GPT-4o" }),
          makeModel({ id: "b", model_type: "embedding", display_name: "TextEmb3" }),
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /OpenAI 已启用模型/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByText("LLM")).toBeInTheDocument();
    expect(screen.getByText("Embedding")).toBeInTheDocument();
    expect(screen.queryByText("Rerank")).not.toBeInTheDocument();

    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.getByText("TextEmb3")).toBeInTheDocument();
  });

  it("过滤掉 enabled=false 与其他 vendor 的条目", async () => {
    const user = userEvent.setup();
    render(
      <VendorModelsDisclosure
        vendor="openai"
        vendorLabel="OpenAI"
        models={[
          makeModel({ id: "keep", model_type: "llm", display_name: "GPT-4o" }),
          makeModel({
            id: "disabled",
            model_type: "llm",
            display_name: "GPT-3.5",
            enabled: false,
          }),
          makeModel({
            id: "other-vendor",
            vendor: "anthropic",
            model_type: "llm",
            display_name: "Claude-4",
          }),
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /OpenAI 已启用模型/ });
    await user.click(trigger);
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
    expect(screen.queryByText("GPT-3.5")).not.toBeInTheDocument();
    expect(screen.queryByText("Claude-4")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("1");
  });

  it("默认模型显示 Default 徽章；embedding 含 dimensions 时显示维度徽章", async () => {
    const user = userEvent.setup();
    render(
      <VendorModelsDisclosure
        vendor="openai"
        models={[
          makeModel({
            id: "def",
            model_type: "llm",
            display_name: "GPT-4o",
            is_default: true,
          }),
          makeModel({
            id: "emb",
            model_type: "embedding",
            display_name: "TextEmb3",
            config: { dimensions: 1536 },
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /已启用模型/ }));
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("1536 dims")).toBeInTheDocument();
  });

  it("aria-controls 与展开区 id 对应", async () => {
    const user = userEvent.setup();
    render(
      <VendorModelsDisclosure
        vendor="gemini"
        models={[makeModel({ vendor: "gemini", model_type: "llm" })]}
      />,
    );
    const trigger = screen.getByRole("button", { name: /已启用模型/ });
    expect(trigger).toHaveAttribute("aria-controls", "vendor-models-gemini");

    await user.click(trigger);
    const region = document.getElementById("vendor-models-gemini");
    expect(region).not.toBeNull();
  });
});
