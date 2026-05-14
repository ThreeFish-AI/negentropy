/**
 * react-markdown 共享插件配置
 *
 * 集中管理 remark/rehype 插件链，确保所有 Markdown 渲染站点
 * 具备一致的解析能力（GFM + LaTeX 数学公式）。
 */
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** remark 插件链：GFM 扩展 + 数学公式语法解析 */
export const defaultRemarkPlugins = [remarkGfm, remarkMath];

/** rehype 插件链：KaTeX 渲染 */
export const defaultRehypePlugins = [rehypeKatex];
