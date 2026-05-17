import { redirect } from "next/navigation";

/**
 * 根路径 ``/`` → 自动重定向到 ``/studio``（Plan §3 方案 A）。
 *
 * 设计动机：Studio 与 Dashboard 是 Home 下并存的两个子页面，根路径不承载实际内容，
 * 仅做导航。书签 / 分享 ``?sessionId=`` 链接的兼容性由本函数透传：命中 sessionId
 * 时拼接到 ``/studio?sessionId=`` 上，避免旧书签静默失活。
 *
 * 实现细节：用 server-side ``redirect()``（Next.js 15+ App Router 原生）而非
 * client-side router.push，避免 hydration mismatch；searchParams 在 Next.js 16
 * 为 Promise，需 await 后再读取。
 */
interface RootPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: RootPageProps) {
  const params = await searchParams;
  const raw = params.sessionId;
  const sessionId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  redirect(sessionId ? `/studio?sessionId=${encodeURIComponent(sessionId)}` : "/studio");
}
