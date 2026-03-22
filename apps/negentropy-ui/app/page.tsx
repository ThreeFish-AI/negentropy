"use client";

import { useMemo, useState } from "react";

import { CopilotKitProvider } from "@copilotkitnext/react";

import { useAuth } from "../components/providers/AuthProvider";
import { NdjsonHttpAgent } from "@/lib/agui/ndjson-agent";
import { buildAgentUrl } from "@/utils/session";

import { AGENT_ID, APP_NAME, HomeBody } from "./home-body";

export default function Home() {
  const { user, status: authStatus, login } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);

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

  const copilotAgents = agent ? { [AGENT_ID]: agent } : undefined;

  return (
    <CopilotKitProvider
      agents__unsafe_dev_only={copilotAgents}
      showDevConsole="auto"
    >
      <HomeBody
        sessionId={sessionId}
        userId={user.userId}
        setSessionId={setSessionId}
      />
    </CopilotKitProvider>
  );
}
