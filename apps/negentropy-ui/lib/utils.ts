import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * cn — 类名合并原语：`tailwind-merge(clsx(...))`。
 *
 * 设计要点：
 * - **正确覆盖**：相较早期「朴素拼接」实现，能识别 Tailwind 冲突类并令后者覆盖前者
 *   （如 `cn("px-2","px-4")→"px-4"`、`cn("max-w-sm","max-w-[92vw]")→"max-w-[92vw]"`）。
 * - **自定义 token 适配**：tailwind-merge 默认配置按 Tailwind v3 对齐，不识本仓 `@theme`
 *   自定义 token；此处经 {@link extendTailwindMerge} 显式登记，避免误判（详见下文）。
 * - **签名兼容**：保留 `string | undefined | null | false` 入参，并扩展支持 clsx 的
 *   数组/对象（ClassValue）写法；返回值仍为 `string`。
 *
 * 为何 font-size 必须登记到 `classGroups` 而非 `theme`：
 * - 本仓 `@theme` 定义了字号 token `--text-{display,h1..h4,body-lg,body,caption,micro}`，
 *   生成工具类 `text-caption` 等——与颜色 `text-{color}`（如 `text-white`）共享 `text-` 前缀。
 * - tailwind-merge 的 `text-color` 组带「任意值校验器」会兜底匹配任意 `text-*`；
 *   若不把自定义字号显式归入 `font-size` 组，`text-caption` 会被判为颜色，与 `text-white`
 *   同串时丢其一（全仓 229 行存在 `text-{size}+text-{color}` 同串共现，关乎大面积回归）。
 * - 实测 `extend.theme` 对 `font-size` 不生效（颜色校验器优先）；`extend.classGroups` 经
 *   `mergeConfigProperties` 的 concat 语义追加，默认字号（xs/sm/lg/...）与任意值校验器全保留。
 */
const FONT_SIZE_CUSTOM = [
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "body-lg",
  "body",
  "caption",
  "micro",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // 关键：自定义字号归入 font-size 组，避免被 text-color 任意值校验器吞并。
      "font-size": [{ text: [...FONT_SIZE_CUSTOM] }],
      // 以下当前虽无同组共现冲突，登记以保证语义自洽、前向安全（concat 追加，不覆盖默认）：
      rounded: [{ rounded: ["modal", "card", "control"] }],
      tracking: [{ tracking: ["heading", "body", "default", "caption", "overline", "label"] }],
      leading: [{ leading: ["body-lg", "body", "caption"] }],
      animate: [{ animate: ["enter", "fade-in", "slide-in-right", "shimmer", "working-pulse"] }],
      duration: [{ duration: ["fast", "base", "slow"] }],
    },
  },
});

/**
 * 合并类名：去 falsy、解 clsx 结构、消解 Tailwind 冲突类（后者胜）。
 * @param inputs 类名（支持字符串 / 条件布尔 / 数组 / 对象，详见 clsx ClassValue）。
 * @returns 合并后的单一类名字符串。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
