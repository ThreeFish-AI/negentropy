"use client";

/**
 * 轻量版 MentionPopover —— 仅显示 6 Agents 候选。
 *
 * 与 negentropy-ui 的 4-Tab MentionPopover 不同：
 * - wiki 场景下只需 agent 提及（corpus/output/graph 暂不支持，按需扩展）
 * - 视觉上对齐 wiki 的 CSS Variable 主题（--wiki-* token）
 */
import { useEffect, useMemo, useRef } from "react";
import type { AgentSummary } from "@/lib/agent-chat/use-agents";

export interface AgentMentionPopoverProps {
  /** 候选 Agent 列表（含 root + faculties）。 */
  candidates: AgentSummary[];
  /** 当前 @ 后键入的过滤词（不含 @）。 */
  query: string;
  /** 选中索引（键盘导航高亮）。 */
  activeIndex: number;
  /** 选中时回调，传回 Agent 对象。 */
  onSelect: (agent: AgentSummary) => void;
  /** 高亮位置变更（鼠标 hover 时同步）。 */
  onActiveIndexChange: (idx: number) => void;
  /** 锚定 textarea —— popover 跟随光标位置。 */
  anchorEl: HTMLElement | null;
}

function filterByQuery(
  agents: AgentSummary[],
  query: string,
): AgentSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return agents;
  return agents.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.displayName.toLowerCase().includes(q),
  );
}

export function AgentMentionPopover({
  candidates,
  query,
  activeIndex,
  onSelect,
  onActiveIndexChange,
  anchorEl,
}: AgentMentionPopoverProps) {
  const filtered = useMemo(
    () => filterByQuery(candidates, query),
    [candidates, query],
  );
  const listRef = useRef<HTMLUListElement | null>(null);

  // 高亮项滚动到视口（避免被 max-height 隐藏）
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLLIElement>(
      `[data-mention-idx="${activeIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (filtered.length === 0 || !anchorEl) return null;

  return (
    <div className="wiki-agent-mention-popover" role="listbox">
      <div className="wiki-agent-mention-popover__hint">
        选择 Agent · ↑↓ 导航 · Enter 确认 · Esc 取消
      </div>
      <ul ref={listRef} className="wiki-agent-mention-popover__list">
        {filtered.map((agent, idx) => (
          <li
            key={agent.name}
            data-mention-idx={idx}
            role="option"
            aria-selected={idx === activeIndex}
            className={
              idx === activeIndex
                ? "wiki-agent-mention-popover__item wiki-agent-mention-popover__item--active"
                : "wiki-agent-mention-popover__item"
            }
            onMouseEnter={() => onActiveIndexChange(idx)}
            onMouseDown={(e) => {
              // 用 mousedown 而非 click，避免 textarea 失焦导致 popover 关闭
              e.preventDefault();
              onSelect(agent);
            }}
          >
            <div className="wiki-agent-mention-popover__label">
              <span
                className="wiki-agent-mention-popover__name"
                title={agent.name}
              >
                {agent.displayName}
              </span>
              {agent.isRoot ? (
                <span className="wiki-agent-mention-popover__badge">主</span>
              ) : (
                <span className="wiki-agent-mention-popover__badge wiki-agent-mention-popover__badge--faculty">
                  翼
                </span>
              )}
            </div>
            {agent.description ? (
              <div className="wiki-agent-mention-popover__desc">
                {agent.description}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function clampActiveIndex(activeIndex: number, len: number): number {
  if (len === 0) return 0;
  return ((activeIndex % len) + len) % len;
}
