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

  it("renders all headings in expanded mode and applies depth classes", () => {
    render(wrap(<WikiToc headings={headings} />));
    const items = document.querySelectorAll(".wiki-toc-item");
    expect(items.length).toBe(3);
    expect(items[0].className).toContain("depth-2");
    expect(items[1].className).toContain("depth-3");
    expect(items[2].className).toContain("depth-4");
    expect(screen.getByText("Intro")).toBeTruthy();
    expect(screen.getByText("Why")).toBeTruthy();
    expect(screen.getByText("Detail")).toBeTruthy();
  });

  it("collapses to rail and persists state to localStorage", () => {
    render(wrap(<WikiToc headings={headings} />));
    const collapseBtn = screen.getByRole("button", { name: /折叠目录/ });
    fireEvent.click(collapseBtn);
    expect(window.localStorage.getItem("wiki:toc:collapsed")).toBe("1");
    expect(document.querySelector(".wiki-toc-rail")).not.toBeNull();
    expect(document.querySelector(".wiki-toc")).toBeNull();

    const railBtn = screen.getByRole("button", { name: /展开目录/ });
    fireEvent.click(railBtn);
    expect(window.localStorage.getItem("wiki:toc:collapsed")).toBe("0");
    expect(document.querySelector(".wiki-toc")).not.toBeNull();
  });

  it("writes data-toc='none' on layout when hasToc=false", () => {
    const { container } = render(wrap(<WikiToc headings={[]} />, false));
    expect(container.querySelector('[data-toc="none"]')).not.toBeNull();
  });

  it("writes data-toc='expanded' by default when hasToc=true", () => {
    const { container } = render(wrap(<WikiToc headings={headings} />, true));
    expect(container.querySelector('[data-toc="expanded"]')).not.toBeNull();
  });
});
