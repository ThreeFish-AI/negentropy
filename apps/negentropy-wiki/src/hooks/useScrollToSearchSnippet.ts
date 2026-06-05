"use client";

import { useEffect } from "react";

/**
 * useScrollToSearchSnippet
 *
 * 检测 URL 中的 `?search_snippet=...` 参数，在 Markdown 内容渲染后，
 * 查找包含该片段文本的最近标题（h2/h3/h4），并滚动到该位置。
 *
 * 工作原理：
 * 1. 从 URL searchParams 提取 snippet 文本
 * 2. 用 requestAnimationFrame 轮询等待 Markdown 标题就绪（避免固定延迟竞态）
 * 3. 第一轮精确匹配：找首个 section 文本包含 snippet 的标题
 * 4. 第二轮模糊匹配：按命中词数择优
 * 5. 滚动到最佳匹配标题；无论是否命中均清理 URL 参数
 */
export function useScrollToSearchSnippet() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const snippet = params.get("search_snippet");
    if (!snippet) return;

    let cancelled = false;
    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 60; // 约 1s（60 帧）内轮询标题就绪

    const clearSnippetParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("search_snippet");
      window.history.replaceState({}, "", url.toString());
    };

    const run = () => {
      if (cancelled) return;
      const headingList = Array.from(
        document.querySelectorAll(
          ".wiki-main h2[id], .wiki-main h3[id], .wiki-main h4[id]",
        ),
      );

      // 标题尚未就绪：继续轮询，超时后放弃并清理参数
      if (!headingList.length) {
        if (attempts++ < maxAttempts) {
          rafId = requestAnimationFrame(run);
        } else {
          clearSnippetParam();
        }
        return;
      }

      // 折叠空白以与 collectSectionText 的归一化对称
      const snippetLower = snippet.toLowerCase().replace(/\s+/g, " ").trim();
      let bestHeading: Element | null = null;

      // 第一轮：精确匹配——首个 section 文本包含完整 snippet 的标题
      for (let i = 0; i < headingList.length; i++) {
        const sectionText = collectSectionText(
          headingList[i],
          headingList[i + 1] ?? null,
        );
        if (sectionText.includes(snippetLower)) {
          bestHeading = headingList[i];
          break;
        }
      }

      // 第二轮：模糊匹配——按命中词数择优
      if (!bestHeading) {
        const terms = snippetLower.split(/\s+/).filter(Boolean);
        let bestScore = 0;
        for (let i = 0; i < headingList.length; i++) {
          const sectionText = collectSectionText(
            headingList[i],
            headingList[i + 1] ?? null,
          );
          let score = 0;
          for (const term of terms) {
            if (sectionText.includes(term)) score++;
          }
          if (score > bestScore) {
            bestScore = score;
            bestHeading = headingList[i];
          }
        }
      }

      if (bestHeading) {
        (bestHeading as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      clearSnippetParam();
    };

    rafId = requestAnimationFrame(run);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
}

/** 收集当前标题到下一个标题之间的所有文本内容（空白折叠以提升匹配稳健性） */
function collectSectionText(
  heading: Element,
  nextHeading: Element | null,
): string {
  let text = "";
  let node: Element | null = heading.nextElementSibling;
  while (node && node !== nextHeading) {
    text += (node.textContent || "") + " ";
    node = node.nextElementSibling;
  }
  // 折叠空白，使跨元素拼接的文本与 snippet 比较更稳健
  return text.toLowerCase().replace(/\s+/g, " ");
}
