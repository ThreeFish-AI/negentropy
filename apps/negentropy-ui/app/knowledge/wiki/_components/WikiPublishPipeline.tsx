"use client";

import type { WikiPublishTarget } from "@/features/knowledge";

interface WikiPublishPipelineProps {
  /** 触发该状态条的操作类型。 */
  action: "publish" | "unpublish";
  /** 发布目标环境（publish 时必传，区分测试/生产上线文案）。 */
  target?: WikiPublishTarget;
  /** 本次发布递增后的版本号（publish 时展示）。 */
  version?: number;
}

/**
 * Wiki 发布后的精确状态条。
 *
 * wiki 纯静态化（``output: "export"``）后，内容更新 = 重建：
 *   - 测试环境：后端 fire-and-forget spawn ``build-wiki-local.sh`` 重建 ``out/``（:3092）；
 *   - 生产环境：后端 fire-and-forget spawn ``publish-wiki-pages.sh`` 推送 GitHub Pages。
 * 不存在运行时 ISR / SSG 通知 / content-status 轮询——历史的「保存版本 / 通知 SSG /
 * 验证内容」三步流水线与「5 分钟窗口」提示均为 ISR 时代残留，已退役。
 *
 * 本组件仅以一条精确文案如实反映「版本已保存 + 重建/发布已触发」，不再做任何
 * 轮询或 ISR 状态推断。
 */
export function WikiPublishPipeline({
  action,
  target,
  version,
}: WikiPublishPipelineProps) {
  const isPublish = action === "publish";
  const actionText = isPublish
    ? target === "production"
      ? "已触发生产发布（GitHub Pages），内容通常在数分钟内上线"
      : "已触发本地重建（:3092），重建完成后即可访问新内容"
    : "已取消发布（状态已回退为草稿）";

  const className = isPublish
    ? "mt-3 text-caption text-emerald-600 dark:text-emerald-400"
    : "mt-3 text-caption text-muted-foreground";

  return (
    <p className={className}>
      {isPublish && <>已保存版本 v{version ?? "?"} · </>}
      {actionText}
    </p>
  );
}
