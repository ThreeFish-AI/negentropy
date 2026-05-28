import { describe, it, expect } from "vitest";
import {
  debounce,
  isContainerTranslated,
  isTranslationMutation,
} from "@/lib/annotation/use-translation-detect";

describe("isContainerTranslated", () => {
  it("returns false for plain DOM without <font> wrappers", () => {
    const div = document.createElement("div");
    div.innerHTML = "<p>Hello world</p>";
    expect(isContainerTranslated(div)).toBe(false);
  });

  it("returns true when <font> wrapper is present (Chrome translate signature)", () => {
    const div = document.createElement("div");
    div.innerHTML = '<p><font style="vertical-align: inherit;">你好</font></p>';
    expect(isContainerTranslated(div)).toBe(true);
  });

  it("returns true when MS Edge translation attrs present", () => {
    const div = document.createElement("div");
    div.innerHTML = '<p _msttexthash="abc">test</p>';
    expect(isContainerTranslated(div)).toBe(true);
  });

  it("returns false for null container", () => {
    expect(isContainerTranslated(null)).toBe(false);
  });
});

describe("isTranslationMutation", () => {
  function mkMutation(init: Partial<MutationRecord>): MutationRecord {
    return {
      type: "childList",
      target: document.createElement("div"),
      addedNodes: document.createDocumentFragment().childNodes,
      removedNodes: document.createDocumentFragment().childNodes,
      previousSibling: null,
      nextSibling: null,
      attributeName: null,
      attributeNamespace: null,
      oldValue: null,
      ...init,
    } as MutationRecord;
  }

  it("flags <font> insertion as translation", () => {
    const fragment = document.createDocumentFragment();
    const font = document.createElement("font");
    fragment.appendChild(font);
    const m = mkMutation({
      type: "childList",
      addedNodes: fragment.childNodes,
    });
    expect(isTranslationMutation(m)).toBe(true);
  });

  it("flags characterData changes as translation", () => {
    const m = mkMutation({ type: "characterData" });
    expect(isTranslationMutation(m)).toBe(true);
  });

  it("flags lang attribute change as translation", () => {
    const m = mkMutation({ type: "attributes", attributeName: "lang" });
    expect(isTranslationMutation(m)).toBe(true);
  });

  it("ignores irrelevant childList changes (e.g. our own <mark>)", () => {
    const fragment = document.createDocumentFragment();
    const mark = document.createElement("mark");
    mark.className = "wiki-annotation-highlight";
    fragment.appendChild(mark);
    const m = mkMutation({
      type: "childList",
      addedNodes: fragment.childNodes,
    });
    // mark 节点不在 TRANSLATION_TAG_NAMES 中，且无翻译特征 attribute，应不视为翻译
    expect(isTranslationMutation(m)).toBe(false);
  });
});

describe("debounce", () => {
  it("collapses rapid calls into a single trailing call", async () => {
    let count = 0;
    const fn = debounce(() => {
      count += 1;
    }, 30);
    fn();
    fn();
    fn();
    expect(count).toBe(0);
    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(1);
  });

  it("cancel() prevents the pending invocation", async () => {
    let count = 0;
    const fn = debounce(() => {
      count += 1;
    }, 30);
    fn();
    fn.cancel();
    await new Promise((r) => setTimeout(r, 50));
    expect(count).toBe(0);
  });
});
