import { describe, it, expect } from "vitest";
import { captureSnapshot } from "@/lib/annotation/use-snapshot";

describe("captureSnapshot", () => {
  it("captures textContent and text node references with original values", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    div.innerHTML = "<p>Hello world</p><p>Second paragraph</p>";

    const snap = captureSnapshot(div);
    expect(snap.textContent).toBe("Hello worldSecond paragraph");
    expect(snap.textNodes.length).toBe(2);
    expect(snap.originalNodeValues.get(snap.textNodes[0])).toBe("Hello world");
    expect(snap.originalNodeValues.get(snap.textNodes[1])).toBe("Second paragraph");
    expect(snap.textHash).toMatch(/^[0-9a-f]{8}$/);

    document.body.removeChild(div);
  });

  it("preserves text node references after nodeValue is mutated (translation simulation)", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    div.innerHTML = "<p>Hello world</p>";

    const snap = captureSnapshot(div);
    const originalNode = snap.textNodes[0];

    // 模拟浏览器翻译：原地修改 text node 的 nodeValue
    originalNode.nodeValue = "你好世界";

    // text node 引用仍指向同一个 DOM 节点（虽然内容变了）
    expect(snap.textNodes[0]).toBe(originalNode);
    expect(snap.textNodes[0].nodeValue).toBe("你好世界");
    // snapshot 中保留的原文不变
    expect(snap.originalNodeValues.get(originalNode)).toBe("Hello world");

    document.body.removeChild(div);
  });

  it("indexes block-level elements with xpath, text and offset", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    div.innerHTML = "<p>First</p><p><strong>Second</strong></p>";

    const snap = captureSnapshot(div);
    const blocks = snap.blockElements;
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    const first = blocks.find((b) => b.text === "First");
    const second = blocks.find((b) => b.text === "Second");
    expect(first?.offset).toBe(0);
    expect(second?.offset).toBe(5); // "First".length
    expect(first?.xpath).toMatch(/^\/p/);
    expect(second?.xpath).toMatch(/^\/p/);

    document.body.removeChild(div);
  });

  it("hash changes when textContent changes", () => {
    const div1 = document.createElement("div");
    div1.textContent = "Hello";
    const snap1 = captureSnapshot(div1);
    const div2 = document.createElement("div");
    div2.textContent = "你好";
    const snap2 = captureSnapshot(div2);
    expect(snap1.textHash).not.toBe(snap2.textHash);
  });

  it("same textContent produces same hash (deterministic)", () => {
    const a = document.createElement("div");
    a.textContent = "stable";
    const b = document.createElement("div");
    b.textContent = "stable";
    expect(captureSnapshot(a).textHash).toBe(captureSnapshot(b).textHash);
  });
});
