import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "./Header";

const NAV_ITEMS = [
  { href: "/knowledge", label: "Dashboard" },
  { href: "/knowledge/base", label: "Knowledge Base" },
  { href: "/knowledge/graph", label: "Knowledge Graph" },
  { href: "/knowledge/memory", label: "User Memory" },
  { href: "/knowledge/pipelines", label: "Pipelines" },
];

type AuthUser = {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  provider?: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export function KnowledgeNav({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          setAuthStatus("unauthenticated");
          setAuthUser(null);
          return;
        }
        const payload = (await response.json()) as { user: AuthUser };
        setAuthUser(payload.user);
        setAuthStatus("authenticated");
      } catch (error) {
        console.warn("Failed to load auth state", error);
        setAuthStatus("unauthenticated");
      }
    };
    loadAuth();
  }, []);

  const handleLogin = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.warn("Failed to logout", error);
    }
  }, []);

  return (
    <>
      <Header
        title="Knowledge"
        showHomeLink={true}
        user={authUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
      >
        <span className="hidden text-xs text-zinc-500 sm:inline-block">/</span>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      </Header>

      <div className="border-b border-zinc-200 bg-white px-6 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {description && (
            <p className="text-xs text-zinc-500 border-l border-zinc-200 pl-4">
              {description}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
