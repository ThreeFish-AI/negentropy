"use client";

import { useState, useCallback, useEffect } from "react";

interface WikiMobileNavProps {
  children: React.ReactNode;
}

export function WikiMobileNav({ children }: WikiMobileNavProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        className="wiki-mobile-hamburger"
        onClick={() => setOpen(true)}
        aria-label="打开导航菜单"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="wiki-mobile-overlay" onClick={close} />
      )}

      <aside
        className={`wiki-mobile-drawer${open ? " open" : ""}`}
        role="dialog"
        aria-label="导航菜单"
      >
        <div className="wiki-mobile-drawer-header">
          <button
            onClick={close}
            aria-label="关闭导航菜单"
            className="wiki-mobile-drawer-close"
          >
            ✕
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
