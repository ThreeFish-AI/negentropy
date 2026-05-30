"use client";

import { Suspense, useCallback, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { CopilotKitProvider } from "@copilotkitnext/react";

import { useAuth } from "@/components/providers/AuthProvider";
import { NdjsonHttpAgent } from "@negentropy/agents-chat-core/client";
import { buildAgentUrl } from "@/utils/session";

import { AGENT_ID, APP_NAME, HomeBody } from "@/app/home-body";

const SESSION_ID_QUERY_KEY = "sessionId";

/**
 * 内部组件：承载 useSearchParams 等 client-side 路由 hooks。
 *
 * Next.js 16 SSG prerender 阶段对裸用 ``useSearchParams`` 的客户端组件强制要求
 * Suspense 边界（CSR bailout 协议）；不包裹会触发
 * ``missing-suspense-with-csr-bailout`` 让 build 失败。本拆分让 SSG 阶段渲染
 * Suspense fallback、CSR 阶段挂载真实 ``HomeInner``，链路上所有 hook（含
 * useSessionListService 内部的 useSearchParams）都被同一 Suspense 兜住。
 */
function HomeInner() {
  const { user, status: authStatus, login } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pendingSendRef = useRef<string | null>(null);
  const pendingForSessionRef = useRef<string | null>(null);

  // 单一事实源（Single Source of Truth）：URL 的 ?sessionId= 参数。
  // 不再维护独立 React state — sessionId 完全派生自 URL，避免双 state 一致性问题
  // 与 useEffect 内 setState 的 React 18 反模式。这意味着：
  // 1. 刷新 / 复制 URL / 浏览器返回前进 → 自然恢复对应会话（ISSUE-059）；
  // 2. 书签 / 分享链接可直接指向特定会话；
  // 3. setSessionId 通过 window.history.replaceState 更新 URL，
  //    Next.js App Router 的 useSearchParams 会监听 history API 变更并触发派生重渲染。
  //
  // ISSUE-062：useSearchParams() 每次 render 返回新的 ReadonlyURLSearchParams 引用
  // （即使 query 不变），如果直接列入 useCallback deps 会让 setSessionId 引用持续
  // 重建 → 传入 useSessionListService 后 loadSessions useCallback 也持续重建 →
  // useEffect(() => loadSessions(), [loadSessions]) 反复触发，与 startNewSession
  // 写入 sessionId 形成竞速导致 sessionId 被旧 list 覆盖。改用 toString() 派生稳定
  // 字符串作为 dep，让 React 用值相等性比较保持 callback 稳定。
  const queryString = searchParams?.toString() ?? "";
  const sessionId = searchParams?.get(SESSION_ID_QUERY_KEY) || null;

  const setSessionId = useCallback(
    (next: string | null) => {
      // ISSUE-088：Next.js 16.2.3 的 useRouter().replace(target, { scroll: false })
      // 在「同 pathname、仅 query 变化」场景下会输出 history.replaceState({__NA: true}, "", 旧URL)
      // 的 no-op 路径，URL 不会真正更新，导致 useSearchParams 永远派生旧值。
      // 直接调用 window.history.replaceState 绕开该 RSC 导航判定路径——
      // Next.js 14+ App Router 的 useSearchParams 会监听 history API 变更并触发重渲染。
      const params = new URLSearchParams(queryString);
      if (next) {
        params.set(SESSION_ID_QUERY_KEY, next);
      } else {
        params.delete(SESSION_ID_QUERY_KEY);
      }
      const nextQuery = params.toString();
      const target = nextQuery ? `${pathname}?${nextQuery}` : pathname || "/";
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", target);
      }
    },
    [pathname, queryString],
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
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-text-muted">
        正在验证登录状态...
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
        <div className="max-w-md space-y-2">
          <p className="text-xs uppercase tracking-label text-text-muted">
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

/**
 * 顶层导出：Suspense 兜住 ``HomeInner`` 内的 ``useSearchParams`` 等 client-side
 * 路由 hooks，满足 Next.js 16 SSG prerender 对 CSR bailout 的边界要求。
 *
 * fallback 选用与"正在验证登录状态..."相同的视觉容器，避免 SSG → CSR 切换
 * 时的视觉跳动。
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-text-muted">
          正在加载...
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
