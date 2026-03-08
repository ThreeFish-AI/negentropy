import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({
  default: mermaidMock,
}));

describe("MermaidDiagram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mermaidMock.parse.mockResolvedValue(true);
    mermaidMock.render.mockResolvedValue({ svg: "<svg><text>diagram</text></svg>" });
  });

  it("空 code 时不渲染图表", () => {
    const { container } = render(<MermaidDiagram code="   " />);

    expect(container).toBeEmptyDOMElement();
    expect(mermaidMock.parse).not.toHaveBeenCalled();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it("非空 code 时会渲染 Mermaid SVG", async () => {
    render(<MermaidDiagram code={"graph TD\nA-->B"} />);

    await waitFor(() => {
      expect(mermaidMock.parse).toHaveBeenCalled();
      expect(mermaidMock.render).toHaveBeenCalled();
    });

    expect(screen.getByText("diagram")).toBeInTheDocument();
  });
});
