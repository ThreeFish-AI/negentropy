/**
 * react-markdown 共享插件配置
 *
 * 集中管理 remark/rehype 插件链，确保所有 Markdown 渲染站点
 * 具备一致的解析能力（GFM + LaTeX 数学公式）。
 */
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkMathSanitize } from "./remark-math-sanitize";

/**
 * remark 插件链：GFM 扩展 + 数学公式语法解析 + 病态公式净化。
 *
 * remarkMathSanitize 须紧随 remarkMath 之后。它修复 remark-math 的通用缺陷，
 * 不限 PDF 语料：形如「输入 $3/ 百万 token ，输出 $15/ 百万 token」的相邻货币符
 * 会被配成 inlineMath，实测正文被打乱重复（`$15` 段渲染成 `$3` 段）并触发 5 次
 * KaTeX 告警——LLM 回复中报价文本极常见，故挂在全局链而非仅文档渲染处。
 * 与 wiki 端 MarkdownRenderer 的插件链保持一致。
 */
export const defaultRemarkPlugins = [remarkGfm, remarkMath, remarkMathSanitize];

/** rehype 插件链：KaTeX 渲染 */
export const defaultRehypePlugins = [rehypeKatex];
