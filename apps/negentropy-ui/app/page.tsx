import { redirect } from "next/navigation";

/**
 * 根路径 ``/`` → 自动重定向到 ``/studio``（Plan §3 方案 A）。
 *
 * 设计动机：Studio 与 Dashboard 是 Home 下并存的两个子页面，根路径不承载实际内容，
 * 仅做导航。书签 / 分享 ``?sessionId=`` 链接的兼容性由 Studio 子页面承担。
 *
 * 实现细节：用 server-side ``redirect()``（Next.js 15+ App Router 原生）而非
 * client-side router.push，避免 hydration mismatch；不读 searchParams 因为根路径
 * 不再消费 sessionId（Plan §3 确认 sessionId 是 Studio 专属语义）。
 */
export default function Home() {
  redirect("/studio");
}
