"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import type { ModelConfigItem } from "@/features/knowledge/utils/knowledge-api";

type LlmModelSelectProps = {
  models: ModelConfigItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

function buildFullModelName(vendor: string, modelName: string): string {
  return `${vendor}/${modelName}`;
}

type FlatItem = {
  vendor: string;
  item: ModelConfigItem | null;
  full: string;
  label: string;
  isPlaceholder?: boolean;
  isUnknown?: boolean;
};

export function LlmModelSelect({
  models,
  value,
  onChange,
  placeholder = "Default",
  allowClear = true,
  disabled,
  className,
  ariaLabel,
}: LlmModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [navIdx, setNavIdx] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [measuredTop, setMeasuredTop] = useState<number | null>(null);
  const [dropdownMaxH, setDropdownMaxH] = useState<number>(320);
  const [dropdownLeft, setDropdownLeft] = useState<number>(0);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelConfigItem[]>();
    for (const item of models) {
      if (!map.has(item.vendor)) {
        map.set(item.vendor, []);
      }
      map.get(item.vendor)!.push(item);
    }
    return Array.from(map.entries());
  }, [models]);

  const knownValues = useMemo(
    () =>
      new Set(
        models.map((item) => buildFullModelName(item.vendor, item.model_name)),
      ),
    [models],
  );

  const showUnknown = Boolean(value) && !knownValues.has(value);

  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];
    if (allowClear) {
      items.push({
        vendor: "",
        item: null,
        full: "",
        label: placeholder,
        isPlaceholder: true,
      });
    }
    if (showUnknown) {
      items.push({
        vendor: "",
        item: null,
        full: value,
        label: `${value}（未知）`,
        isUnknown: true,
      });
    }
    for (const [, modelItems] of grouped) {
      for (const item of modelItems) {
        const full = buildFullModelName(item.vendor, item.model_name);
        const label = item.display_name?.trim() ? item.display_name : full;
        items.push({ vendor: item.vendor, item, full, label });
      }
    }
    return items;
  }, [allowClear, showUnknown, value, placeholder, grouped]);

  const displayLabel = useMemo(() => {
    if (!value) return placeholder;
    const found = flatItems.find((f) => f.full === value);
    return found ? found.label : value;
  }, [value, flatItems, placeholder]);

  // 打开/关闭时重置 navIdx（在事件处理器中，不在 effect 中）
  const handleTriggerClick = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => {
      if (!prev) {
        // 即将打开 → 同步 navIdx 到当前选中值
        const idx = flatItems.findIndex((f) => f.full === value);
        setNavIdx(idx >= 0 ? idx : 0);
      }
      return !prev;
    });
  }, [disabled, flatItems, value]);

  // 测量下拉面板高度并向上偏移
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      const dropdown = dropdownRef.current;
      if (!trigger || !dropdown) return;
      const rect = trigger.getBoundingClientRect();
      const dropdownH = dropdown.offsetHeight;
      const availableAbove = rect.top - 8;
      const maxAllowedH = Math.min(320, availableAbove);
      const effectiveH = Math.min(dropdownH, maxAllowedH);
      setMeasuredTop(rect.top - effectiveH - 4);
      setDropdownMaxH(maxAllowedH);
      setDropdownLeft(rect.left);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, flatItems.length]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const dropdown = dropdownRef.current;
      const trigger = triggerRef.current;
      if (!dropdown || !trigger) return;
      if (
        !dropdown.contains(e.target as Node) &&
        !trigger.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setNavIdx((i) => (i + 1) % flatItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setNavIdx((i) => (i - 1 + flatItems.length) % flatItems.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const picked = flatItems[navIdx];
        if (picked) {
          onChange(picked.full);
          setIsOpen(false);
        }
        return;
      }
      if (e.key === "Tab") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [isOpen, flatItems, navIdx, onChange]);

  // 滚动选中项进入视野
  useEffect(() => {
    const dropdown = dropdownRef.current;
    if (!dropdown) return;
    const item = dropdown.querySelector<HTMLDivElement>(`[data-active="true"]`);
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [navIdx]);

  const handlePick = useCallback(
    (item: FlatItem) => {
      onChange(item.full);
      setIsOpen(false);
    },
    [onChange],
  );

  return (
    <div className={className ?? "relative inline-flex items-center"}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? "LLM Model"}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleTriggerClick}
        className="h-7 rounded-md border border-border/50 bg-transparent pl-2 pr-6 text-xs text-foreground outline-none transition-colors hover:border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <span className="truncate max-w-48 inline-block align-middle">{displayLabel}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-1.5 h-3 w-3 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label={ariaLabel ?? "LLM Model"}
            aria-activedescendant={
              flatItems[navIdx] ? `model-option-${navIdx}` : undefined
            }
            data-testid="llm-model-dropdown"
            className="fixed z-50 min-w-[200px] rounded-xl border border-border bg-card text-foreground shadow-xl"
            style={{
              top: measuredTop ?? 0,
              left: dropdownLeft,
              maxHeight: `${dropdownMaxH}px`,
              overflowY: "auto",
              visibility: measuredTop === null ? "hidden" : undefined,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {allowClear && (
              <ModelOption
                idx={0}
                active={navIdx === 0}
                label={placeholder}
                onHover={() => setNavIdx(0)}
                onPick={() => handlePick(flatItems[0])}
                isMuted
              />
            )}
            {showUnknown && (
              <ModelOption
                idx={allowClear ? 1 : 0}
                active={navIdx === (allowClear ? 1 : 0)}
                label={`${value}（未知）`}
                onHover={() => setNavIdx(allowClear ? 1 : 0)}
                onPick={() => handlePick(flatItems[allowClear ? 1 : 0])}
                isMuted
              />
            )}
            {grouped.map(([vendor, items]) => {
              let baseIdx = allowClear ? 1 : 0;
              baseIdx += showUnknown ? 1 : 0;
              for (const [v, prevItems] of grouped) {
                if (v === vendor) break;
                baseIdx += prevItems.length;
              }
              return (
                <div key={vendor} role="group" aria-label={vendor}>
                  <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted select-none">
                    {vendor}
                  </div>
                  {items.map((item, i) => {
                    const flatIdx = baseIdx + i;
                    const full = buildFullModelName(item.vendor, item.model_name);
                    const label = item.display_name?.trim() ? item.display_name : full;
                    return (
                      <ModelOption
                        key={item.id}
                        idx={flatIdx}
                        active={navIdx === flatIdx}
                        label={label}
                        selected={value === full}
                        onHover={() => setNavIdx(flatIdx)}
                        onPick={() =>
                          handlePick({ vendor, item, full, label })
                        }
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

function ModelOption({
  idx,
  active,
  label,
  selected,
  isMuted,
  onHover,
  onPick,
}: {
  idx: number;
  active: boolean;
  label: string;
  selected?: boolean;
  isMuted?: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <div
      id={`model-option-${idx}`}
      role="option"
      aria-selected={active}
      data-active={active ? "true" : undefined}
      className={`cursor-pointer px-3 py-1.5 text-xs ${
        active ? "bg-input" : "hover:bg-input/60"
      } ${isMuted ? "text-muted" : "text-foreground"} ${selected ? "font-medium" : ""}`}
      onMouseEnter={onHover}
      onClick={onPick}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}
