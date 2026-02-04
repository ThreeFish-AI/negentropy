"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePathname } from "next/navigation";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const { user, login, logout, status } = useAuth();
  const pathname = usePathname();

  const isKnowledgePage = pathname?.startsWith("/knowledge");

  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-4 sticky top-0 z-50">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Brand and Primary Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Negentropy
            </span>
            <span className="text-lg font-bold text-zinc-900 leading-tight">
              UI
            </span>
          </Link>

          <nav className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-full">
            <Link
              href="/"
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                !isKnowledgePage
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Chat
            </Link>
            <Link
              href="/knowledge"
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                isKnowledgePage
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Knowledge
            </Link>
          </nav>
        </div>

        {/* User Area and Actions */}
        <div className="flex items-center gap-3 text-sm">
          {children}

          <div className="h-4 w-px bg-zinc-200 mx-2 hidden sm:block"></div>

          {status === "loading" ? (
            <div className="text-xs text-zinc-400">Loading...</div>
          ) : user ? (
            <div className="flex items-center gap-3 group relative pointer-events-auto">
              <div className="flex items-center gap-2 cursor-default">
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
                <span className="text-xs font-medium text-zinc-700 hidden sm:inline-block">
                  {user.name || "User"}
                </span>
              </div>

              <button
                onClick={() => logout()}
                className="px-3 py-1 text-[10px] font-medium text-zinc-500 hover:text-red-600 border border-zinc-200 rounded-full hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-transform active:scale-95"
              onClick={login}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
