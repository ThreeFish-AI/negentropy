"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type WikiAuthUser = {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
};

export type WikiAuthStatus = "loading" | "authenticated" | "unauthenticated";

type WikiAuthContextType = {
  status: WikiAuthStatus;
  user: WikiAuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
};

const WikiAuthContext = createContext<WikiAuthContextType | undefined>(undefined);

async function fetchAuthUser(): Promise<{
  status: WikiAuthStatus;
  user: WikiAuthUser | null;
}> {
  try {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) {
      return { status: "unauthenticated", user: null };
    }
    const payload = (await response.json()) as { user: WikiAuthUser };
    return { status: "authenticated", user: payload.user };
  } catch {
    return { status: "unauthenticated", user: null };
  }
}

export function WikiAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WikiAuthStatus>("loading");
  const [user, setUser] = useState<WikiAuthUser | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const next = await fetchAuthUser();
      if (!active) return;
      setUser(next.user);
      setStatus(next.status);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const login = () => {
    window.location.href = "/api/auth/login";
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setStatus("unauthenticated");
    setUser(null);
    window.location.href = "/";
  };

  return (
    <WikiAuthContext.Provider value={{ status, user, login, logout }}>
      {children}
    </WikiAuthContext.Provider>
  );
}

export function useWikiAuth() {
  const context = useContext(WikiAuthContext);
  if (context === undefined) {
    throw new Error("useWikiAuth must be used within a WikiAuthProvider");
  }
  return context;
}
