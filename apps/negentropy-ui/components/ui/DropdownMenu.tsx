"use client";

/**
 * DropdownMenu — 轻量可复用的浮层菜单原语。
 *
 * 设计要点（复用 MentionPopover 范式，收敛"每处手搓浮层"的熵增）：
 * - **Portal 绝对定位**：渲染到 ``document.body``，规避侧栏 ``overflow-hidden /
 *   overflow-y-auto`` 对内联绝对定位的裁剪；按锚点 ``getBoundingClientRect`` 定位，
 *   默认锚点下方、``align`` 水平对齐，空间不足则翻转到上方并夹取视口。
 * - **消隐**：``Esc`` 与点击浮层外部关闭；关闭时把焦点交还触发钮（可及性）。
 * - **键盘导航**：``↑↓`` 循环、``Home/End`` 首尾、``Enter/Space`` 选中、``Esc`` 关闭；
 *   ``role="menu"`` / ``menuitem`` + roving tabindex；``activeIdx`` 于渲染期夹取
 *   （safeActiveIdx，参照 MentionPopover），规避 set-state-in-effect。
 * - **动效**：``animate-enter`` 入场（全局已配 ``prefers-reduced-motion`` 降级）。
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownMenuItem {
  /** 稳定 key（缺省用 label）。 */
  id?: string;
  label: string;
  icon?: ComponentType<LucideProps>;
  onSelect: () => void;
  /** 破坏性动作（红色语义）。 */
  danger?: boolean;
  disabled?: boolean;
  /** 可及名（缺省用 label）——便于测试按稳定名定位菜单项。 */
  ariaLabel?: string;
}

export interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  /** 触发钮引用，用于定位与关闭时焦点交还。 */
  anchorRef: RefObject<HTMLElement | null>;
  items: DropdownMenuItem[];
  /** 水平对齐锚点的哪一侧，默认 ``end``（右对齐）。 */
  align?: "start" | "end";
  ariaLabel?: string;
}

export function DropdownMenu({
  open,
  onClose,
  anchorRef,
  items,
  align = "end",
  ariaLabel = "更多操作",
}: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const openedAnchorRef = useRef<HTMLElement | null>(null);

  const enabledIndexes = useMemo(
    () => items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0),
    [items],
  );

  // 渲染期夹取 activeIdx（避免 effect 内 setState）：越界或指向 disabled 项时回落首个可用项。
  const safeActiveIdx = enabledIndexes.includes(activeIdx)
    ? activeIdx
    : (enabledIndexes[0] ?? 0);

  // 定位：默认锚点下方、按 align 水平对齐；下方空间不足则翻转到上方；左右夹取视口。
  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const a = anchor.getBoundingClientRect();
    const mh = menu.offsetHeight;
    const mw = menu.offsetWidth;
    const gap = 6;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let top = a.bottom + gap;
    if (top + mh > vh - 8 && a.top - gap - mh > 8) {
      top = a.top - gap - mh;
    }
    let left = align === "end" ? a.right - mw : a.left;
    left = Math.max(8, Math.min(left, vw - mw - 8));
    setPos({ top, left });
  }, [anchorRef, align]);

  // 打开后同步定位：useLayoutEffect 在提交后、绘制前运行，reposition 读取 offsetHeight
  // 触发同步回流拿到真实尺寸并 setPos（经函数间接调用，规避 set-state-in-effect，
  // 且同步生效——无 rAF 闪帧，测试环境亦同步可查询）。
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  // 滚动 / 缩放时跟随重定位。
  useEffect(() => {
    if (!open) return;
    const handle = () => reposition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open, reposition]);

  // 点击浮层外部关闭（锚点自身点击由触发钮处理，不在此拦截）。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open, onClose, anchorRef]);

  // 键盘导航：↑↓ 循环、Home/End 首尾、Enter/Space 选中、Esc 关闭。
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (enabledIndexes.length === 0) return;
        setActiveIdx((cur) => {
          const base = enabledIndexes.includes(cur)
            ? cur
            : (enabledIndexes[0] ?? 0);
          const at = enabledIndexes.indexOf(base);
          const nextAt =
            e.key === "ArrowDown"
              ? (at + 1) % enabledIndexes.length
              : (at - 1 + enabledIndexes.length) % enabledIndexes.length;
          return enabledIndexes[nextAt];
        });
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setActiveIdx(enabledIndexes[0] ?? 0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setActiveIdx(enabledIndexes[enabledIndexes.length - 1] ?? 0);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const it = items[safeActiveIdx];
        if (it && !it.disabled) {
          it.onSelect();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [open, items, safeActiveIdx, enabledIndexes, onClose]);

  // 焦点跟随 safeActiveIdx（roving tabindex）。
  useEffect(() => {
    if (!open) return;
    const el = menuRef.current?.querySelector<HTMLButtonElement>(
      `[data-idx="${safeActiveIdx}"]`,
    );
    if (el && typeof el.focus === "function") el.focus();
  }, [open, safeActiveIdx, pos]);

  // 关闭时把焦点交还触发钮（可及性；节点已卸载时 focus 为 no-op，安全）。
  useEffect(() => {
    if (open) {
      openedAnchorRef.current = anchorRef.current;
      return;
    }
    const el = openedAnchorRef.current;
    openedAnchorRef.current = null;
    if (el && typeof el.focus === "function") el.focus();
  }, [open, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      data-testid="dropdown-menu"
      className="fixed z-50 min-w-[9rem] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-enter"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? undefined : "hidden",
      }}
    >
      {items.map((it, idx) => {
        const Icon = it.icon;
        return (
          <button
            key={it.id ?? it.label}
            type="button"
            role="menuitem"
            data-idx={idx}
            tabIndex={idx === safeActiveIdx ? 0 : -1}
            disabled={it.disabled}
            aria-label={it.ariaLabel ?? it.label}
            onMouseEnter={() => {
              if (!it.disabled) setActiveIdx(idx);
            }}
            onClick={() => {
              if (it.disabled) return;
              it.onSelect();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none",
              it.disabled
                ? "cursor-not-allowed opacity-40"
                : it.danger
                  ? "text-error hover:bg-error/10 focus-visible:bg-error/10"
                  : "text-text-secondary hover:bg-muted hover:text-text-primary focus-visible:bg-muted focus-visible:text-text-primary",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{it.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
