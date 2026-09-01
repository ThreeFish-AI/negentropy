import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * remarkMathSanitize —— 净化 PDF 提取语料中 remark-math 产生的病态公式节点，
 * 消除 rehype-katex 构建期告警与实际渲染缺陷。须挂在 `remarkMath` 之后。
 *
 * 三类病灶与处置：
 *  1. 货币 `$` 误配对：正文「按输入 $3/ 百万 token 、输出 $15/ 百万 token」的相邻
 *     货币符被 remark-math 配成 inlineMath，中间中文全进 math mode（KaTeX 逐字告警
 *     unicodeTextInMathMode）。处置：值内含 `\text{...}` 之外的 CJK 字符 → 判定
 *     误配对，降级回正文 text 节点（补回字面 `$`）。仅作用于 inlineMath——真实
 *     display 公式（`$$` 围栏）无货币配对形态，且误降级代价高（丢公式渲染）。
 *  2. `%` 未转义：`$11.5%\to15.0%$` 中 `%` 是 TeX 注释符，渲染吞掉其后内容
 *     （commentAtEnd 告警即其末态）。处置：未转义的 `%` → `\%`。
 *  3. Unicode 符号无度量：`‖`/`∥`/`•` KaTeX 无字形度量（unknownSymbol + No
 *     character metrics，渲染为 tofu）。处置：映射为 LaTeX 等价命令
 *     `\Vert`/`\parallel`/`\bullet`（Pandoc texmath 同款归一化思路）。
 *
 * 判据均先剥离 `\text{...}` 片段再检验——`\text{中文}` 是合法用法（正文注释进公式），
 * 不得触发 CJK 误判，`\text` 内的符号也保持原样（走浏览器字体）。
 */

/** 最小 mdast 节点结构（仅用到 type / value / data.hChildren）；避免直接依赖 `mdast` 类型包。 */
interface MathNode {
  type: "inlineMath" | "math";
  value: string;
  data?: {
    hChildren?: HastLike[];
    [key: string]: unknown;
  };
}

function isMathNode(node: unknown): node is MathNode {
  return (
    typeof node === "object" &&
    node !== null &&
    ((node as { type?: unknown }).type === "inlineMath" ||
      (node as { type?: unknown }).type === "math") &&
    typeof (node as { value?: unknown }).value === "string"
  );
}

/** 最小 hast 内容节点（text 或 element，后者含 children）。 */
interface HastLike {
  type?: string;
  value?: unknown;
  children?: HastLike[];
}

/**
 * 同步写入公式值：`node.value` 与 `node.data.hChildren` 中的 hast text 副本须一并
 * 更新——mdast-util-math 解析时把值存了两份，remark-rehype 转 hast 走 `data.hChildren`
 * （rehype-katex 从 hast 取文本），只改 `node.value` 不会到达 KaTeX。副本层级不定
 * （inlineMath 是 `hChildren[0].value`，display 是 `hChildren[0](code).children[0].value`），
 * 递归替换其中的 text 节点。
 */
function setMathValue(node: MathNode, value: string): void {
  node.value = value;
  const sync = (n: HastLike): void => {
    if (n.type === "text" && typeof n.value === "string") {
      n.value = value;
      return;
    }
    for (const child of n.children ?? []) sync(child);
  };
  for (const child of node.data?.hChildren ?? []) sync(child);
}

const CJK_RE = /[㐀-鿿豈-﫿]/;

/** 剥离 `\text{...}` / `\textbf{...}` 等文本宏片段，仅在剩余「数学体」部分做判据检验。 */
function stripTextMacros(src: string): string {
  return src.replace(/\\(?:text|textbf|textit|texttt|mathrm|mbox)\s*\{[^{}]*\}/g, "");
}

/** 转义数学体中未转义的 `%`（TeX 注释符）。 */
function escapePercent(src: string): string {
  return src.replace(/(?<!\\)%/g, "\\%");
}

/** 数学体中 Unicode 符号 → LaTeX 等价命令（KaTeX 有度量，消除 tofu）。 */
function normalizeSymbols(src: string): string {
  return src
    .replace(/‖/g, "\\Vert ")
    .replace(/∥/g, "\\parallel ")
    .replace(/•/g, "\\bullet ")
    // 下标裸 CJK（`\underbrace{…}_{常数 2}` 这类 PDF 提取的标注）包进 `\text{}`，
    // 消除逐字 unicodeTextInMathMode 告警（KaTeX 对 \text 内 Unicode 走文本模式）。
    .replace(/(_\{|\^\{)([^{}]*[㐀-鿿豈-﫿][^{}]*)\}/g, "$1\\text{$2}}");
}

/** 可写父节点结构（demote 时按索引替换 child）。 */
interface ParentLike {
  children: { type?: string; value?: string }[];
}

export const remarkMathSanitize: Plugin = () => (tree) => {
  visit(tree, (node, index, parent) => {
    if (!isMathNode(node)) return;
    // visit 回调的 parent 经泛型推断为 never（与 rehype-notranslate 的 hast 类型坑同款），
    // 经 unknown 最小收窄为可写结构。
    const holder = parent as unknown as ParentLike | undefined;
    if (index == null || !holder) return;

    // 1. 货币误配对降级：数学体含 CJK → 还原为正文文本（含字面 `$` 定界符）。
    if (node.type === "inlineMath" && CJK_RE.test(stripTextMacros(node.value))) {
      holder.children[index] = { type: "text", value: `$${node.value}$` };
      return;
    }

    // 2 & 3. `%` 转义 + 符号归一，均限于数学体（`\text{...}` 内保持原样）。
    const cleaned = replaceOutsideTextMacros(node.value, (s) =>
      normalizeSymbols(escapePercent(s)),
    );
    if (cleaned !== node.value) setMathValue(node, cleaned);
  });
};

/** 仅对 `\text{...}` 片段之外的部分应用 transform，文本宏片段原样保留。 */
function replaceOutsideTextMacros(src: string, transform: (s: string) => string): string {
  const TEXT_MACRO_RE = /\\(?:text|textbf|textit|texttt|mathrm|mbox)\s*\{[^{}]*\}/g;
  let out = "";
  let last = 0;
  for (const m of src.matchAll(TEXT_MACRO_RE)) {
    const at = m.index ?? 0;
    out += transform(src.slice(last, at)) + m[0];
    last = at + m[0].length;
  }
  return out + transform(src.slice(last));
}

export default remarkMathSanitize;
