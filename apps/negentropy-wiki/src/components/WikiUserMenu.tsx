"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useWikiAuth } from "@/lib/auth/wiki-auth";

/**
 * Wiki 头部用户菜单 — 点击式下拉
 *
 * - 已登录：头像按钮 → 下拉面板（用户信息 + 退出登录）
 * - 未登录：用户图标按钮 → 下拉面板（登录入口）
 * - loading：不渲染
 */
export function WikiUserMenu() {
  const { status, user, login, logout } = useWikiAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleToggle = useCallback(() => setOpen((prev) => !prev), []);
  const handleClose = useCallback(() => setOpen(false), []);

  const handleLogout = useCallback(async () => {
    setOpen(false);
    await logout();
  }, [logout]);

  const handleLogin = useCallback(() => {
    setOpen(false);
    login();
  }, [login]);

  if (status === "loading") return null;

  const displayName = user?.name || user?.email || "用户";

  return (
    <div className="wiki-user-menu" ref={menuRef}>
      <button
        type="button"
        className="wiki-header-action-btn wiki-user-menu-trigger"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={status === "authenticated" ? displayName : "用户菜单"}
        title={status === "authenticated" ? displayName : "登录"}
      >
        {status === "authenticated" && user ? (
          user.picture ? (
            <img
              src={user.picture}
              alt=""
              width={24}
              height={24}
              className="wiki-header-avatar-img"
            />
          ) : (
            <span className="wiki-header-avatar-initials">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </button>

      {open && (
        <div className="wiki-user-menu-panel" role="menu">
          {status === "authenticated" && user ? (
            <>
              <div className="wiki-user-menu-header">
                <span className="wiki-user-menu-name">{user.name || "用户"}</span>
                {user.email && (
                  <span className="wiki-user-menu-email">{user.email}</span>
                )}
              </div>
              <div className="wiki-user-menu-separator" />
              <button
                type="button"
                className="wiki-user-menu-item"
                role="menuitem"
                onClick={handleLogout}
              >
                退出登录
              </button>
            </>
          ) : (
            <button
              type="button"
              className="wiki-user-menu-item"
              role="menuitem"
              onClick={handleLogin}
            >
              登录
            </button>
          )}
        </div>
      )}
    </div>
  );
}
