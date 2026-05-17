import { redirect } from "next/navigation";

/**
 * 根路径 ``/`` → 自动重定向到 ``/studio``（Plan §3 方案 A）。
 *
 * 设计动机：Studio 与 Dashboard 是 Home 下并存的两个子页面，根路径不承载实际内容，
 * 仅做导航。书签 / 分享链接的兼容性由本函数承担：透传**全部** query 参数到
 * ``/studio?...``，避免任何携带 query 的旧链接静默失活，与 ``useSessionListService``
 * / ``studio/page.tsx`` 中 "URL 即单源" 的约束保持一致。
 *
 * 演进背景：早前仅白名单透传 ``?sessionId=`` 导致 ``/?view=archived`` 直达失败
 * （E2E `home-chat.spec.ts:725` 第 3 个守卫），泛化为全量透传后，根路径不再充当
 * query 白名单网关，新增 query 维度无需再回到本文件修补。
 *
 * 实现细节：用 server-side ``redirect()``（Next.js 15+ App Router 原生）而非
 * client-side router.push，避免 hydration mismatch；searchParams 在 Next.js 16
 * 为 Promise，需 await 后再读取；``URLSearchParams.toString()`` 负责百分号编码，
 * 比手写 ``encodeURIComponent`` 不易出错且原生支持重复 key（多值参数）。
 */
interface RootPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: RootPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    } else if (typeof value === "string") {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  redirect(qs ? `/studio?${qs}` : "/studio");
}
