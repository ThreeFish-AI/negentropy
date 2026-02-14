"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        setStatus("unauthenticated");
        setUser(null);
        return;
      }
      const payload = (await response.json()) as { user: AuthUser };
      setUser(payload.user);
      setStatus("authenticated");
    } catch (error) {
      console.warn("Failed to load auth state", error);
      setStatus("unauthenticated");
      setUser(null);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = () => {
    window.location.href = "/api/auth/login";
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setStatus("unauthenticated");
      setUser(null);
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
