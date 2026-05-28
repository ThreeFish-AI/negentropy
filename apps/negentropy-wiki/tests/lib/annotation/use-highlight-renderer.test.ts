import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMarkWrapRenderer,
  pickRenderer,
  supportsCSSHighlightAPI,
  type HighlightGroupInput,
} from "@/lib/annotation/use-highlight-renderer";

describe("supportsCSSHighlightAPI", () => {
  it("returns false in jsdom (no Highlight constructor)", () => {
    // jsdom 当前不实现 CSS Highlight API；该测试同时验证 detection 不会抛错
    expect(supportsCSSHighlightAPI()).toBe(false);
  });
});

describe("pickRenderer", () => {
  it("默认（非翻译态）选用 MarkWrap 渲染器", () => {
    const factory = pickRenderer({ isTranslated: false });
    const renderer = factory(
      () => {},
      () => {},
    );
    expect(renderer.supportsElementEvents).toBe(true);
  });

  it("翻译态但浏览器不支持 CSS Highlight → 降级到 MarkWrap", () => {
    const factory = pickRenderer({ isTranslated: true });
    const renderer = factory(
      () => {},
      () => {},
    );
    expect(renderer.supportsElementEvents).toBe(true);
  });
});

describe("createMarkWrapRenderer", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = "<p>Hello annotated world.</p>";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function makeRange(start: number, end: number): Range {
    const textNode = container.querySelector("p")!.firstChild as Text;
    const r = document.createRange();
    r.setStart(textNode, start);
    r.setEnd(textNode, end);
    return r;
  }

  it("apply 包裹 <mark> 标签到 Range", () => {
    const hoverStart = vi.fn();
    const hoverEnd = vi.fn();
    const renderer = createMarkWrapRenderer(hoverStart, hoverEnd);

    const group: HighlightGroupInput = {
      annotationIds: ["a1"],
      range: makeRange(6, 15), // "annotated"
      annotations: [],
    };
    renderer.apply([group]);

    const marks = container.querySelectorAll("mark.wiki-annotation-highlight");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("annotated");
    expect(marks[0].getAttribute("data-annotation-ids")).toBe("a1");
  });

  it("clear 还原 DOM（移除 mark 标签）", () => {
    const renderer = createMarkWrapRenderer(
      () => {},
      () => {},
    );
    const group: HighlightGroupInput = {
      annotationIds: ["a1"],
      range: makeRange(0, 5),
      annotations: [],
    };
    renderer.apply([group]);
    expect(container.querySelectorAll("mark").length).toBe(1);

    renderer.clear();
    expect(container.querySelectorAll("mark").length).toBe(0);
    expect(container.textContent).toBe("Hello annotated world.");
  });

  it("mouseenter 触发 hoverStart 回调", () => {
    const hoverStart = vi.fn();
    const hoverEnd = vi.fn();
    const renderer = createMarkWrapRenderer(hoverStart, hoverEnd);

    const group: HighlightGroupInput = {
      annotationIds: ["a1"],
      range: makeRange(0, 5),
      annotations: [],
    };
    renderer.apply([group]);

    const mark = container.querySelector("mark")!;
    mark.dispatchEvent(new MouseEvent("mouseenter"));
    expect(hoverStart).toHaveBeenCalledTimes(1);
    mark.dispatchEvent(new MouseEvent("mouseleave"));
    expect(hoverEnd).toHaveBeenCalledTimes(1);
  });

  it("apply 两次连续：先清旧再写新，无 mark 堆叠", () => {
    const renderer = createMarkWrapRenderer(
      () => {},
      () => {},
    );
    renderer.apply([
      { annotationIds: ["a1"], range: makeRange(0, 5), annotations: [] },
    ]);
    // 第一次 apply 后 DOM 已变（mark 包裹），需要重新基于当前 DOM 创建 Range。
    const p = container.querySelector("p")!;
    const newRange = document.createRange();
    newRange.selectNodeContents(p); // 选中整段做粗粒度演示
    renderer.apply([
      { annotationIds: ["a2"], range: newRange, annotations: [] },
    ]);
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].getAttribute("data-annotation-ids")).toBe("a2");
  });
});
