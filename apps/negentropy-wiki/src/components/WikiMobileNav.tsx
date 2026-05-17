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

  // Lock body scroll when open
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
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          border: "none",
          background: "transparent",
          color: "var(--wiki-text)",
          cursor: "pointer",
          padding: 4,
          borderRadius: 6,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div
          className="wiki-mobile-overlay"
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 40,
          }}
        />
      )}

      <aside
        className="wiki-mobile-drawer"
        role="dialog"
        aria-label="导航菜单"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "85vw",
          maxWidth: 320,
          background: "var(--wiki-sidebar-bg)",
          borderRight: "1px solid var(--wiki-border)",
          zIndex: 45,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          overflowY: "auto",
          padding: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <button
            onClick={close}
            aria-label="关闭导航菜单"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--wiki-text-secondary)",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: 4,
              fontSize: "1.2em",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .wiki-mobile-hamburger { display: inline-flex !important; }
          .wiki-sidebar { display: none !important; }
        }
      `}</style>
    </>
  );
}
