import { render } from "@testing-library/react";
import { DocumentPdfViewer } from "@/features/knowledge/components/DocumentPdfViewer";

describe("DocumentPdfViewer", () => {
  const SRC = "/api/knowledge/base/corpus-1/documents/doc-1/preview?app_name=negentropy";

  it("以 <object type=application/pdf data=src> 内联渲染 PDF", () => {
    const { container } = render(<DocumentPdfViewer src={SRC} filename="report.pdf" />);

    const object = container.querySelector("object");
    expect(object).not.toBeNull();
    expect(object).toHaveAttribute("type", "application/pdf");
    expect(object).toHaveAttribute("data", SRC);
  });

  it("嵌套 <iframe> 作为兜底并指向同一 src", () => {
    const { container } = render(<DocumentPdfViewer src={SRC} />);

    const iframe = container.querySelector("object iframe");
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute("src", SRC);
  });

  it("始终提供「在新标签打开」逃生链接（target=_blank + noopener）", () => {
    const { container } = render(<DocumentPdfViewer src={SRC} filename="report.pdf" />);

    const links = Array.from(container.querySelectorAll(`a[href="${SRC}"]`));
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]?.getAttribute("rel")).toContain("noopener");
  });

  it("渲染加载占位（spinner），供原生查看器绘制前占位（纯 CSS、无 onLoad 依赖）", () => {
    const { container } = render(<DocumentPdfViewer src={SRC} />);

    // 占位层位于 <object> 之下（z-0），原生查看器绘制后其不透明背景自然覆盖。
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
    // object 仍嵌套 iframe 兜底，结构未因占位层而破坏。
    expect(container.querySelector("object iframe")).not.toBeNull();
  });
});
