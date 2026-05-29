"use client";

import { useAuth } from "@/components/providers/AuthProvider";

/**
 * AuthGuard - 全局认证守卫组件。
 *
 * 未登录时显示登录引导页面，已登录则渲染子组件。
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status, user, login } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-text-muted">
        正在验证登录状态...
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-center">
        <div className="max-w-md space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
            Negentropy UI
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            需要登录以继续
          </h1>
          <p className="text-sm text-text-muted">
            使用 Google OAuth 进行单点登录。
          </p>
        </div>
        <button
          className="rounded-full bg-foreground px-6 py-2 text-xs font-semibold text-background hover:opacity-90 transition-transform active:scale-95"
          onClick={login}
          type="button"
        >
          使用 Google 登录
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
