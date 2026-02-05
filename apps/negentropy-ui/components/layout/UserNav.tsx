"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function UserNav() {
  const { user, login, logout, status } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return <div className="text-xs text-zinc-400">Loading...</div>;
  }

  if (!user) {
    return (
      <button
        className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-transform active:scale-95"
        onClick={login}
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-transparent p-1 pr-3 transition-colors outline-none",
          isOpen
            ? "bg-zinc-100 border-zinc-200"
            : "hover:bg-zinc-100 hover:border-zinc-200",
        )}
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name || "User"}
            className="h-7 w-7 rounded-full border border-zinc-200 object-cover"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
            {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-medium text-zinc-700 hidden sm:inline-block max-w-[100px] truncate">
          {user.name || "User"}
        </span>
        <svg
          className={cn(
            "h-3 w-3 text-zinc-400 transition-transform",
            isOpen && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
          <div className="px-2 py-1.5 mb-1">
            <p className="text-sm font-medium text-zinc-900 truncate">
              {user.name || "User"}
            </p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>

          <div className="h-px bg-zinc-100 my-1 -mx-1" />

          <button
            onClick={() => {
              logout();
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
