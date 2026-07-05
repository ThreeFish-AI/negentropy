import { notFound } from "next/navigation";

import { TimelinePreview } from "./TimelinePreview";

/**
 * Transcript 视觉验证预览路由（dev-only，顶层路由，不经 /interface 鉴权守卫）。
 *
 * 默认 404；仅当 ``NEXT_PUBLIC_ENABLE_PREVIEW === "1"`` 时可达，确保生产环境不暴露。
 */
export default function DevTranscriptPreviewPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_PREVIEW !== "1") notFound();
  return <TimelinePreview />;
}
