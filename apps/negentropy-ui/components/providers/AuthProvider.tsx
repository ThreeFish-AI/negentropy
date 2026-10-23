"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type AuthUser = {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  provider?: string;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextType = {
  status: AuthStatus;
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchAuthUser(): Promise<{
  status: AuthStatus;
  user: AuthUser | null;
}> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (!response.ok) {
    return {
      status: "unauthenticated",
      user: null,
    };
  }
  const payload = (await response.json()) as { user: AuthUser };
  return {
    status: "authenticated",
    user: payload.user,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = async () => {
    try {
      const next = await fetchAuthUser();
      setUser(next.user);
      setStatus(next.status);
    } catch (error) {
      console.warn("Failed to load auth state", error);
      setStatus("unauthenticated");
      setUser(null);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const next = await fetchAuthUser();
        if (!active) return;
        setUser(next.user);
        setStatus(next.status);
      } catch (error) {
        if (!active) return;
        console.warn("Failed to load auth state", error);
        setStatus("unauthenticated");
        setUser(null);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const login = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- /api/auth/login 是 302 到外部 IdP 的 Route Handler，router.push() 无法承接跨源跳转
    window.location.href = "/api/auth/login";
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setStatus("unauthenticated");
      setUser(null);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 登出须整页重载以丢弃全部客户端状态，并让 Server Components 在已清空的 cookie 下重跑
      window.location.href = "/";
    } catch (error) {
      console.warn("Failed to logout", error);
    }
  };

  return (
    <AuthContext.Provider value={{ status, user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
