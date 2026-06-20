/// <reference lib="dom" />
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WikiToc } from "@/components/WikiToc";
import { WikiLayoutShell } from "@/components/WikiLayoutShell";
import type { TocHeading } from "@/lib/markdown-headings";

// jsdom 不实现 IntersectionObserver；提供最小 stub 以避免 mount 异常。
class IOStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
}

beforeEach(() => {
  cleanup();
  // @ts-expect-error 测试环境注入
  globalThis.IntersectionObserver = IOStub;
  window.localStorage.clear();
});

const headings: TocHeading[] = [
  { depth: 2, slug: "intro", text: "Intro" },
  { depth: 3, slug: "why", text: "Why" },
  { depth: 4, slug: "detail", text: "Detail" },
];

function wrap(toc: React.ReactNode, hasToc = true) {
  return (
    <WikiLayoutShell sidebar={<div>side</div>} toc={toc} hasToc={hasToc}>
      <article>main</article>
    </WikiLayoutShell>
  );
}

describe("WikiToc", () => {
  it("renders nothing when there are no headings", () => {
    const { container } = render(wrap(<WikiToc headings={[]} />, false));
    expect(container.querySelector(".wiki-toc")).toBeNull();
    expect(container.querySelector(".wiki-toc-rail")).toBeNull();
  });

  // WikiLayoutShell 初始 collapsed=true（默认折叠，hydration 安全）；空 localStorage 时保持折叠。
  it("默认折叠：渲染为 rail（非展开列表），data-toc='collapsed'", () => {
    const { container } = render(wrap(<WikiToc headings={headings} />));
    expect(container.querySelector(".wiki-toc-rail")).not.toBeNull();
    expect(container.querySelector(".wiki-toc")).toBeNull();
    expect(container.querySelector('[data-toc="collapsed"]')).not.toBeNull();
  });

  it("从折叠态展开后，渲染全部 headings 并应用 depth 类、data-toc='expanded'", () => {
    const { container } = render(wrap(<WikiToc headings={headings} />));
    // 默认折叠 → 点击 rail 的「展开目录」按钮
    fireEvent.click(screen.getByRole("button", { name: /展开目录/ }));

    const items = document.querySelectorAll(".wiki-toc-item");
    expect(items.length).toBe(3);
    expect(items[0].className).toContain("depth-2");
    expect(items[1].className).toContain("depth-3");
    expect(items[2].className).toContain("depth-4");
    expect(screen.getByText("Intro")).toBeTruthy();
    expect(screen.getByText("Why")).toBeTruthy();
    expect(screen.getByText("Detail")).toBeTruthy();
    expect(container.querySelector('[data-toc="expanded"]')).not.toBeNull();
  });

  it("折叠/展开切换并持久化到 localStorage", () => {
    render(wrap(<WikiToc headings={headings} />));
    // 展开（默认折叠）→ localStorage "0"
    fireEvent.click(screen.getByRole("button", { name: /展开目录/ }));
    expect(window.localStorage.getItem("wiki:toc:collapsed")).toBe("0");
    expect(document.querySelector(".wiki-toc")).not.toBeNull();

    // 折叠 → localStorage "1"，回到 rail
    fireEvent.click(screen.getByRole("button", { name: /折叠目录/ }));
    expect(window.localStorage.getItem("wiki:toc:collapsed")).toBe("1");
    expect(document.querySelector(".wiki-toc-rail")).not.toBeNull();
    expect(document.querySelector(".wiki-toc")).toBeNull();

    // 再次展开 → localStorage "0"
    fireEvent.click(screen.getByRole("button", { name: /展开目录/ }));
    expect(window.localStorage.getItem("wiki:toc:collapsed")).toBe("0");
  });

  it("writes data-toc='none' on layout when hasToc=false", () => {
    const { container } = render(wrap(<WikiToc headings={[]} />, false));
    expect(container.querySelector('[data-toc="none"]')).not.toBeNull();
  });
});
