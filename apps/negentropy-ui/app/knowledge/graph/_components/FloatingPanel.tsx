"use client";

import { type ReactNode, useCallback, useEffect } from "react";
import { X } from "lucide-react";

interface FloatingPanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function FloatingPanel({ open, title, onClose, children }: FloatingPanelProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    },
    [open, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      role="dialog"
      aria-label={title}
      aria-hidden={!open}
      className={`absolute bottom-0 right-0 top-0 z-30 flex w-80 flex-col border-l border-border bg-card shadow-lg transition-transform duration-200 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border p-3">
        <h3 className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="rounded p-1 text-text-muted hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{open && children}</div>
    </div>
  );
}
