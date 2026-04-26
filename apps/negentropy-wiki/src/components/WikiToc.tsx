"use client";

import { useEffect, useRef, useState } from "react";
import { useTocLayout } from "./WikiLayoutShell";
import type { TocHeading } from "@/lib/markdown-headings";

/**
 * 右栏 TOC（Table of Contents）— 章目录组件。
 *
 * 设计：
 *   - 折叠态：竖向 rail，仅显示折叠图标与章节计数；点击恢复展开。
 *   - 展开态：标题列表，按 H2/H3/H4 缩进；scroll-spy 高亮当前可视章节。
 *   - 折叠/展开状态由 `WikiLayoutShell` 提供的 Context 持有，已持久化到 LS。
 *   - 空 headings 时返回 null（虽然 `WikiLayoutShell.hasToc` 通常已先行控制）。
 */

interface WikiTocProps {
  headings: TocHeading[];
}

export function WikiToc({ headings }: WikiTocProps) {
  const { collapsed, toggle } = useTocLayout();
  const [activeId, setActiveId] = useState<string | undefined>(headings[0]?.slug);
  // 跟踪「最近一次用户点击」的 slug，用以抑制 IO 立刻把高亮抢回
  const clickedRef = useRef<string | null>(null);
  const clickedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 只在章节进入「上 30%」可视区时才更新 activeId，避免误命中。
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        if (visible.length === 0) return;
        const candidate = (visible[0].target as HTMLElement).id;
        if (clickedRef.current && candidate !== clickedRef.current) return;
        setActiveId(candidate);
      },
      {
        // 顶部 0、底部留 70% 余量 —— 章节标题靠近视口顶部时才视为「当前」。
        rootMargin: "0px 0px -70% 0px",
        threshold: [0, 1],
      },
    );

    for (const h of headings) {
      const el = document.getElementById(h.slug);
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  const handleAnchorClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    slug: string,
  ) => {
    const target = document.getElementById(slug);
    if (!target) return;
    event.preventDefault();
    setActiveId(slug);
    clickedRef.current = slug;
    if (clickedTimerRef.current) clearTimeout(clickedTimerRef.current);
    clickedTimerRef.current = setTimeout(() => {
      clickedRef.current = null;
    }, 800);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${slug}`);
    }
  };

  if (headings.length === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        className="wiki-toc-rail"
        aria-label={`展开目录（共 ${headings.length} 项）`}
        aria-expanded="false"
        onClick={toggle}
      >
        <ListIcon />
        <span className="wiki-toc-rail-count">{headings.length}</span>
      </button>
    );
  }

  return (
    <nav className="wiki-toc" aria-label="本页目录">
      <div className="wiki-toc-header">
        <span className="wiki-toc-title">目录</span>
        <button
          type="button"
          className="wiki-toc-collapse"
          aria-label="折叠目录"
          aria-expanded="true"
          onClick={toggle}
        >
          <CollapseIcon />
        </button>
      </div>
      <ul className="wiki-toc-list">
        {headings.map((h) => (
          <li
            key={h.slug}
            className={`wiki-toc-item depth-${h.depth}${
              activeId === h.slug ? " active" : ""
            }`}
          >
            <a
              href={`#${h.slug}`}
              onClick={(event) => handleAnchorClick(event, h.slug)}
              aria-current={activeId === h.slug ? "location" : undefined}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="12" x2="13" y2="12" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="11 3 5 8 11 13" />
    </svg>
  );
}
