import { fireEvent, render, screen } from "@testing-library/react";
import { McpServerCard } from "@/app/plugins/mcp/_components/McpServerCard";

const server = {
  id: "server-1",
  owner_id: "user-1",
  visibility: "private",
  name: "demo-server",
  display_name: "Demo Server",
  description: "Demo MCP server",
  transport_type: "stdio",
  command: "uvx",
  args: [],
  env: {},
  url: null,
  headers: {},
  is_enabled: true,
  auto_start: false,
  config: {},
  tool_count: 1,
};

const tool = {
  id: "tool-1",
  name: "demo_tool",
  title: "Demo Tool",
  display_name: null,
  description: "Tool description",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
    },
    required: ["query"],
  },
  output_schema: {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      result: {
        type: "string",
        description: "Search result",
      },
    },
  },
  icons: [{ src: "https://example.com/icon.png", mimeType: "image/png" }],
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
  },
  execution: {
    taskSupport: "optional",
  },
  meta: {
    source: "official",
  },
  is_enabled: true,
  call_count: 3,
};

describe("McpServerCard", () => {
  it("renders tool output schema and official metadata", () => {
    render(
      <McpServerCard
        server={server}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onLoad={vi.fn()}
        tools={[tool]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle tools list/i }));
    fireEvent.click(screen.getByRole("button", { name: "Demo Tool" }));

    expect(screen.getByText("Output Schema")).toBeInTheDocument();
    expect(screen.getByText("Tool Metadata")).toBeInTheDocument();
    expect(screen.getByText("Read Only Hint")).toBeInTheDocument();
    expect(screen.getByText("Idempotent Hint")).toBeInTheDocument();
    expect(screen.getByText("Task support")).toBeInTheDocument();
    expect(screen.getByText("optional")).toBeInTheDocument();
    expect(screen.getByText("JSON Schema 2020-12")).toBeInTheDocument();
    expect(screen.getByText("Advanced Metadata")).toBeInTheDocument();
  });

  it("hides empty output schema section", () => {
    render(
      <McpServerCard
        server={server}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onLoad={vi.fn()}
        tools={[{ ...tool, output_schema: {}, meta: {} }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /toggle tools list/i }));
    fireEvent.click(screen.getByRole("button", { name: "Demo Tool" }));

    expect(screen.queryByText("Output Schema")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced Metadata")).not.toBeInTheDocument();
  });
});
