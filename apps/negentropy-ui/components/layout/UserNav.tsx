"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

export function UserNav() {
  const { user, login, logout, status } = useAuth();

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
  );
}
