"use client";

import { useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CopilotKitProvider } from "@copilotkitnext/react";

import { useAuth } from "../components/providers/AuthProvider";
import { NdjsonHttpAgent } from "@/lib/agui/ndjson-agent";
import { buildAgentUrl } from "@/utils/session";

import { AGENT_ID, APP_NAME, HomeBody } from "./home-body";

const SESSION_ID_QUERY_KEY = "sessionId";

export default function Home() {
  const { user, status: authStatus, login } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pendingSendRef = useRef<string | null>(null);
  const pendingForSessionRef = useRef<string | null>(null);

  // 单一事实源（Single Source of Truth）：URL 的 ?sessionId= 参数。
  // 不再维护独立 React state — sessionId 完全派生自 URL，避免双 state 一致性问题
  // 与 useEffect 内 setState 的 React 18 反模式。这意味着：
  // 1. 刷新 / 复制 URL / 浏览器返回前进 → 自然恢复对应会话（ISSUE-059）；
  // 2. 书签 / 分享链接可直接指向特定会话；
  // 3. setSessionId 通过 router.replace 触发 Next.js 重渲染，子组件经 props 收到新值。
  const sessionId = searchParams?.get(SESSION_ID_QUERY_KEY) || null;

  const setSessionId = useCallback(
    (next: string | null) => {
      // history.replaceState 而非 push：避免污染浏览器历史栈，让"返回"键回到外部上一页。
      // 不刷新页面（router.replace + scroll: false），保留所有 client state。
      const params = new URLSearchParams(
        Array.from(searchParams?.entries() ?? []),
      );
      if (next) {
        params.set(SESSION_ID_QUERY_KEY, next);
      } else {
        params.delete(SESSION_ID_QUERY_KEY);
      }
      const queryString = params.toString();
      const target = queryString
        ? `${pathname}?${queryString}`
        : pathname || "/";
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const agent = useMemo(() => {
    if (!user || !sessionId) {
      return null;
    }
    const userId = user.userId;
    return new NdjsonHttpAgent({
      url: buildAgentUrl(sessionId, userId, APP_NAME),
      headers: {
        "X-Session-ID": sessionId,
        "X-User-ID": userId,
      },
      threadId: sessionId,
    });
  }, [sessionId, user]);

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        正在验证登录状态...
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 text-center dark:bg-zinc-950">
        <div className="max-w-md space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Negentropy UI
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            需要登录以继续
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            使用 Google OAuth 进行单点登录。
          </p>
        </div>
        <button
          className="rounded-full bg-black px-6 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black"
          onClick={login}
          type="button"
        >
          使用 Google 登录
        </button>
      </div>
    );
  }

  const homeBodyProps = {
    sessionId,
    userId: user.userId,
    setSessionId,
    pendingSendRef,
    pendingForSessionRef,
  };

  if (!agent) {
    return <HomeBody agent={null} {...homeBodyProps} />;
  }

  return (
    <CopilotKitProvider
      agents__unsafe_dev_only={{ [AGENT_ID]: agent }}
      showDevConsole="auto"
    >
      <HomeBody agent={agent} {...homeBodyProps} />
    </CopilotKitProvider>
  );
}
