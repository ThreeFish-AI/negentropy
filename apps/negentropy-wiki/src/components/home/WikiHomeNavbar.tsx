"use client";

import { useState, useEffect, useRef } from "react";
import { ThemePreference } from "@/components/ThemePreference";

interface NavTab {
  label: string;
  href: string;
}

interface WikiHomeNavbarProps {
  tabs: NavTab[];
}

export function WikiHomeNavbar({ tabs }: WikiHomeNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="home-navbar">
        <div className="home-navbar-inner">
          <a href="/" className="home-navbar-brand">
            数智通识
          </a>

          <nav className="home-navbar-nav" aria-label="主导航">
            {tabs.map((tab) =>
              tab.href ? (
                <a key={tab.label} href={tab.href} className="home-navbar-tab">
                  {tab.label}
                </a>
              ) : (
                <span key={tab.label} className="home-navbar-tab home-navbar-tab--disabled">
                  {tab.label}
                </span>
              ),
            )}
          </nav>

          <div className="home-navbar-actions">
            <div className="home-navbar-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="搜索..." className="home-navbar-search-input" />
            </div>

            <a
              href="https://github.com/ThreeFish-AI/negentropy"
              target="_blank"
              rel="noopener noreferrer"
              className="home-navbar-icon-btn"
              aria-label="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>

            <div className="home-navbar-theme">
              <ThemePreference />
            </div>

            <button
              className="home-navbar-hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="打开导航菜单"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="home-navbar-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <div
        ref={drawerRef}
        className={`home-navbar-drawer${mobileOpen ? " home-navbar-drawer--open" : ""}`}
      >
        <div className="home-navbar-drawer-header">
          <span className="home-navbar-brand">数智通识</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="home-navbar-drawer-close"
            aria-label="关闭导航菜单"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="home-navbar-drawer-nav">
          {tabs.map((tab) =>
            tab.href ? (
              <a key={tab.label} href={tab.href} className="home-navbar-drawer-tab" onClick={() => setMobileOpen(false)}>
                {tab.label}
              </a>
            ) : (
              <span key={tab.label} className="home-navbar-drawer-tab home-navbar-drawer-tab--disabled">
                {tab.label}
              </span>
            ),
          )}
        </nav>
        <div className="home-navbar-drawer-search">
          <input type="text" placeholder="搜索..." className="home-navbar-search-input" />
        </div>
      </div>
    </>
  );
}
