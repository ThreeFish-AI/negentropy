"use client";

/**
 * MentionPopover — Home Composer 的 @ 弹层。
 *
 * 设计要点：
 * - **Portal 绝对定位**（不复用 BaseModal —— 它是 modal 语义，会拦截背景交互）；
 * - **2 个 Tab**（Agents / Corpus）按 kind 区分候选项；Tab 仅渲染图标，
 *   hover 时由 Radix Tooltip 弹出中文标签；
 * - **键盘导航**：↑↓ 切换条目、Tab 切换 Tab、Enter/Tab 选中、Esc 关闭；
 * - **过滤**：按 queryText 子串（不区分大小写）；
 * - **可访问性**：role=listbox + aria-activedescendant + Tab 按钮 aria-label；
 * - **空态**：显示加载 / 错误 / "暂无匹配"提示。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, BookOpen, Loader2 } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { MentionCandidate, MentionKind } from "@negentropy/agents-chat-core/parse";

interface PopoverPosition {
  top: number;
  left: number;
}

export interface MentionPopoverProps {
  /** 是否显示。 */
  open: boolean;
  /** 屏幕坐标（textarea 当前光标的视口位置）；通常由 Composer 计算后传入。 */
  position: PopoverPosition;
  /** 用户在 ``@`` 之后键入的过滤文本（不含 ``@``）。 */
  queryText: string;
  /** Agent 候选项（已按业务规则过滤，例如排除 root / 禁用项）。 */
  agentCandidates: MentionCandidate[];
  /** Corpus 候选项（kind 由弹层在选中时强制写为 ``corpus``）。 */
  corpusCandidates: MentionCandidate[];
  /** Agents 加载状态。 */
  agentsLoading?: boolean;
  agentsError?: string | null;
  /** Corpora 加载状态。 */
  corporaLoading?: boolean;
  corporaError?: string | null;
  /** 选中候选项回调。 */
  onPick: (candidate: MentionCandidate) => void;
  /** 关闭弹层回调（Esc / 点击外部）。 */
  onClose: () => void;
}

const _TAB_DEFS: Array<{ kind: MentionKind; label: string; icon: typeof Bot }> = [
  { kind: "agent", label: "Agents", icon: Bot },
  { kind: "corpus", label: "Corpus", icon: BookOpen },
];

function _filter(candidates: MentionCandidate[], q: string): MentionCandidate[] {
  if (!q) return candidates;
  const lower = q.toLowerCase();
  return candidates.filter((c) => {
    const inLabel = c.label.toLowerCase().includes(lower);
    const inDesc = (c.description ?? "").toLowerCase().includes(lower);
    return inLabel || inDesc;
  });
}

export function MentionPopover({
  open,
  position,
  queryText,
  agentCandidates,
  corpusCandidates,
  agentsLoading,
  agentsError,
  corporaLoading,
  corporaError,
  onPick,
  onClose,
}: MentionPopoverProps) {
  const [tab, _setTabRaw] = useState<MentionKind>("agent");
  const [activeIdx, setActiveIdx] = useState(0);
  // 切换 Tab 时同步把 activeIdx 重置到 0；避免 useEffect 内 setState 触发额外渲染。
  const setTab = useCallback((next: MentionKind) => {
    _setTabRaw(next);
    setActiveIdx(0);
  }, []);
  const listRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // 向上定位：先渲染测量实际高度，再向上偏移
  const [measuredTop, setMeasuredTop] = useState<number | null>(null);

  const items = useMemo(() => {
    if (!open) return [] as MentionCandidate[];
    if (tab === "agent") return _filter(agentCandidates, queryText);
    // Corpus 分支：候选项 kind 始终为 ``corpus``，无需再 spread 改写。
    return _filter(corpusCandidates, queryText);
  }, [open, tab, agentCandidates, corpusCandidates, queryText]);

  // items.length 变化时，render 时直接 clamp activeIdx，避免 useEffect 内 setState
  // 触发额外渲染（react-hooks/set-state-in-effect）。
  const safeActiveIdx =
    items.length === 0 ? 0 : Math.min(activeIdx, items.length - 1);

  // 测量弹层实际高度，向上偏移以避免超出视口底部
  // open=false 时组件直接 return null，无需重置 measuredTop
  useEffect(() => {
    if (!open) return;
    // 等待 DOM 渲染后测量高度（rAF 回调内 setState 是异步的，符合 lint 要求）
    const raf = requestAnimationFrame(() => {
      const el = popoverRef.current;
      if (!el) return;
      setMeasuredTop(position.top - el.offsetHeight - 4);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, position.top, tab, items.length]);

  // 全局 keydown：弹层打开时拦截 ↑↓ Enter Esc Tab
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) =>
          items.length === 0 ? 0 : (i - 1 + items.length) % items.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (items.length === 0) {
          // 允许 Enter 落入 textarea 的默认行为（发送）
          if (e.key === "Tab") {
            // Tab 时切换到下一个 Tab，避免抢走焦点
            e.preventDefault();
            const idx = _TAB_DEFS.findIndex((t) => t.kind === tab);
            const next = _TAB_DEFS[(idx + 1) % _TAB_DEFS.length];
            setTab(next.kind);
          }
          return;
        }
        e.preventDefault();
        const picked = items[safeActiveIdx];
        if (picked) onPick(picked);
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [open, items, safeActiveIdx, onPick, onClose, tab, setTab]);

  // 滚动选中项进入视野
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLLIElement>(`[data-active="true"]`);
    // jsdom 不实现 scrollIntoView；生产环境正常调用
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [safeActiveIdx, tab]);

  if (!open || typeof document === "undefined") return null;

  const loading = tab === "agent" ? agentsLoading : corporaLoading;
  const error = tab === "agent" ? agentsError : corporaError;

  return createPortal(
    <Tooltip.Provider delayDuration={150} skipDelayDuration={120}>
      <div
        ref={popoverRef}
        data-testid="mention-popover"
        role="dialog"
        aria-label="Mention 候选项"
        className="fixed z-50 w-80 rounded-xl border border-border bg-card text-foreground shadow-xl"
        style={{
          top: measuredTop ?? position.top,
          left: position.left,
          visibility: measuredTop === null && open ? "hidden" : undefined,
        }}
        onMouseDown={(e) => {
          // 阻止 mousedown 抢走 textarea 焦点（点击候选项时仍要保留输入态）
          e.preventDefault();
        }}
      >
        {/* Tab 切换栏（图标 + Tooltip） */}
        <div
          className="flex items-center gap-1 border-b border-border p-1"
          role="tablist"
          aria-label="Mention 类别"
        >
          {_TAB_DEFS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.kind;
            return (
              <Tooltip.Root key={t.kind}>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    data-testid={`mention-tab-${t.kind}`}
                    aria-selected={active}
                    aria-label={t.label}
                    title={t.label}
                    role="tab"
                    className={`inline-flex h-7 w-9 items-center justify-center rounded-md transition-colors ${
                      active
                        ? "bg-input text-foreground"
                        : "text-muted hover:text-foreground hover:bg-input/60"
                    }`}
                    onClick={() => setTab(t.kind)}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    sideOffset={6}
                    className="z-[60] rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-white shadow-lg dark:bg-zinc-700 dark:text-zinc-100"
                  >
                    {t.label}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </div>

        {/* 候选项列表 */}
        <ul
          ref={listRef}
          role="listbox"
          aria-activedescendant={
            items[safeActiveIdx]
              ? `mention-item-${items[safeActiveIdx].refId}`
              : undefined
          }
          className="max-h-64 overflow-y-auto py-1"
          data-testid="mention-listbox"
        >
          {loading && (
            <li className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> 加载中…
            </li>
          )}
          {!loading && error && (
            <li className="px-3 py-3 text-xs text-rose-500" data-testid="mention-error">
              加载失败：{error}
            </li>
          )}
          {!loading && !error && items.length === 0 && (
            <li
              className="px-3 py-3 text-xs text-muted"
              data-testid="mention-empty"
            >
              {tab === "agent" ? "暂无匹配的 Agent" : "暂无匹配的语料库"}
            </li>
          )}
          {!loading &&
            !error &&
            items.map((c, idx) => {
              const active = idx === safeActiveIdx;
              return (
                <li
                  key={c.refId}
                  id={`mention-item-${c.refId}`}
                  role="option"
                  aria-selected={active}
                  data-active={active ? "true" : undefined}
                  data-testid="mention-option"
                  className={`cursor-pointer px-3 py-2 ${
                    active
                      ? "bg-input"
                      : "hover:bg-input/60"
                  }`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => onPick(c)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium">{c.label}</span>
                  </div>
                  {c.description && (
                    <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">
                      {c.description}
                    </p>
                  )}
                </li>
              );
            })}
        </ul>

        {/* 底部提示 */}
        <div className="border-t border-border px-3 py-1 text-[10px] text-muted">
          ↑↓ 选择 · Enter 确认 · Tab 切换分类 · Esc 关闭
        </div>
      </div>
    </Tooltip.Provider>,
    document.body,
  );
}
