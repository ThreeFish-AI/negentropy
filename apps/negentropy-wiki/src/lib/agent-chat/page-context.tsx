"use client";

/**
 * usePageContext —— Client-side 提取当前 wiki 页面的「上下文锚点」。
 *
 * 设计选择：不通过 RSC 层显式注入 Provider（侵入式且需要改每个 page/layout），
 * 改由客户端从 `next/navigation.usePathname()` + DOM 中即时抓取：
 *
 * - pubSlug / entrySlug：从 pathname 段解析（与 wiki 动态路由对齐）
 * - title：取 `<h1>` 文本（wiki 内容页 H1 即标题）
 * - headings：抓 main 区域内的 H1/H2，限 50 项
 *
 * 这样 PR-3 不需要触碰任何 entry/pub 页面，符合「最小干预」原则。
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export interface WikiPageContext {
  pubSlug: string | null;
  entrySlug: string[] | null;
  title: string | null;
  pathname: string | null;
  headings: Array<{ depth: 1 | 2 | 3; text: string; slug: string }>;
}

export const defaultPageContext: WikiPageContext = {
  pubSlug: null,
  entrySlug: null,
  title: null,
  pathname: null,
  headings: [],
};

function parsePathname(pathname: string): {
  pubSlug: string | null;
  entrySlug: string[] | null;
} {
  // 路由模式：
  //   "/"                  → null / null
  //   "/{pubSlug}"         → pubSlug / null
  //   "/{pubSlug}/...slug" → pubSlug / [...]
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return { pubSlug: null, entrySlug: null };
  const [pub, ...rest] = segs;
  return {
    pubSlug: pub ?? null,
    entrySlug: rest.length > 0 ? rest : null,
  };
}

function extractHeadingsFromDom(): WikiPageContext["headings"] {
  if (typeof document === "undefined") return [];
  // wiki 的主内容区固定 id="wiki-main"
  const main =
    document.getElementById("wiki-main") ?? document.querySelector("main");
  if (!main) return [];
  const nodes = main.querySelectorAll<HTMLHeadingElement>("h1, h2, h3");
  const out: WikiPageContext["headings"] = [];
  nodes.forEach((node) => {
    const depth = (Number(node.tagName.slice(1)) as 1 | 2 | 3) || 2;
    if (depth > 2) return; // 只取 H1 / H2，控制体积
    const text = node.textContent?.trim() ?? "";
    if (!text) return;
    const slug = node.id || "";
    out.push({ depth, text, slug });
    if (out.length >= 50) {
      return;
    }
  });
  return out.slice(0, 50);
}

function extractTitleFromDom(): string | null {
  if (typeof document === "undefined") return null;
  const main =
    document.getElementById("wiki-main") ?? document.querySelector("main");
  const h1 = main?.querySelector("h1");
  if (h1?.textContent) return h1.textContent.trim();
  // 退路：document.title 拆掉 "— pubSlug" 后缀
  const docTitle = document.title;
  if (docTitle) {
    const idx = docTitle.indexOf(" — ");
    return idx > 0 ? docTitle.slice(0, idx) : docTitle;
  }
  return null;
}

export function usePageContext(): WikiPageContext {
  const pathname = usePathname();
  const [ctx, setCtx] = useState<WikiPageContext>(defaultPageContext);

  useEffect(() => {
    if (!pathname) {
      setCtx(defaultPageContext);
      return;
    }
    const { pubSlug, entrySlug } = parsePathname(pathname);
    // 等下一帧让 React 完成 hydration / DOM 写入
    const id = window.requestAnimationFrame(() => {
      setCtx({
        pubSlug,
        entrySlug,
        title: extractTitleFromDom(),
        pathname,
        headings: extractHeadingsFromDom(),
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return ctx;
}

// 兼容旧名 export（use-chat-agent.ts 使用）。
export const useWikiPageContext = usePageContext;
