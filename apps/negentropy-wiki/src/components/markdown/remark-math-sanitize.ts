import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * remarkMathSanitize —— 净化 PDF 提取语料中 remark-math 产生的病态公式节点，
 * 消除 rehype-katex 构建期告警与实际渲染缺陷。须挂在 `remarkMath` 之后。
 *
 * ⚠️ 本文件是**逐字节孪生副本**，同时存在于：
 *   - `apps/negentropy-wiki/src/components/markdown/remark-math-sanitize.ts`
 *   - `apps/negentropy-ui/utils/remark-math-sanitize.ts`
 * 两端渲染同一份 PDF 提取语料（wiki 静态站 / UI 知识库文档详情页），判据一旦单边漂移
 * 即产生渲染不对称。未提为共享包是因 wiki 无 workspace 依赖且以 GitHub Pages 为出口，
 * 为单个插件引入构建链的爆炸半径过大（参照 rehype-notranslate 亦为单端持有）。
 * **改动任一份时必须同步另一份，并同步两端回归用例。**
 * 一致性由 `scripts/check_twin_files.py` 在 pre-commit 与 CI 双侧执法（精确字节相等）。
 *
 * 三类病灶与处置：
 *  1. 货币 `$` 误配对：正文「按输入 $3/ 百万 token 、输出 $15/ 百万 token」的相邻
 *     货币符被 remark-math 配成 inlineMath，中间中文全进 math mode（KaTeX 逐字告警
 *     unicodeTextInMathMode）。处置：值内含 `\text{...}` 之外的 CJK 字符 → 判定
 *     误配对，降级回正文 text 节点（补回字面 `$`）。仅作用于 inlineMath——真实
 *     display 公式（`$$` 围栏）无货币配对形态，且误降级代价高（丢公式渲染）。
 *  2. `%` 未转义：`$11.5%\to15.0%$` 中 `%` 是 TeX 注释符，渲染吞掉其后内容
 *     （commentAtEnd 告警即其末态）。处置：未转义的 `%` → `\%`，作用于整串——
 *     `%` 是 KaTeX 词法层 catcode 14，文本模式内不豁免（见 escapePercent）。
 *  3. Unicode 符号无度量：`‖`/`∥`/`•` KaTeX 无字形度量（unknownSymbol + No
 *     character metrics，渲染为 tofu）。处置：映射为 LaTeX 等价命令
 *     `\Vert`/`\parallel`/`\bullet`（Pandoc texmath 同款归一化思路）。
 *
 * 判据均先剥离 `\text{...}` 片段再检验——`\text{中文}` 是合法用法（正文注释进公式），
 * 不得触发 CJK 误判，`\text` 内的 Unicode 符号也保持原样（走浏览器字体）。
 * 例外是 `%`：它在词法层被吞，`\text{}` 内外一律转义。
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

/**
 * CJK 字符类源串：统一表意文字扩展 A 起至基本区（U+3400–U+9FFF）+ 兼容表意文字
 * （U+F900–U+FAFF）。以转义码位书写——兼容区 U+F900 与普通汉字 U+8C48 字形相同码位
 * 不同，字面量易混淆致区间误跨谚文段与代理项。下方两处判据共用此串，避免双处漂移。
 */
const CJK_CLASS = "[\\u3400-\\u9FFF\\uF900-\\uFAFF]";
const CJK_RE = new RegExp(CJK_CLASS);

/**
 * KaTeX 文本模式宏全集（`src/functions/text.ts` 的 `names`）+ `\mathrm` / `\mbox`。
 * 遗漏项会使其内的 CJK 逃过剥离，被货币误配对分支判为误配对而整条降级丢渲染。
 */
const TEXT_MACRO_SOURCE =
  "\\\\(?:text|textrm|textsf|texttt|textnormal|textbf|textmd|textit|textup|emph|mathrm|mbox)\\s*\\{[^{}]*\\}";

/** 剥离 `\text{...}` / `\textbf{...}` 等文本宏片段，仅在剩余「数学体」部分做判据检验。 */
function stripTextMacros(src: string): string {
  return src.replace(new RegExp(TEXT_MACRO_SOURCE, "g"), "");
}

/**
 * 转义未转义的 `%`（TeX 注释符）。按前导反斜杠奇偶判定——`\\%`（换行符紧邻裸 `%`）
 * 中的 `%` 实为未转义，单字符回看 `(?<!\\)` 会漏判。作用于整串而非仅数学体：
 * KaTeX 的 `%` 是 Lexer 构造期设定的 catcode 14，与数学/文本模式无关，
 * `\text{增长 50%}` 的 `%` 会注释掉闭合 `}` 直接抛 ParseError。
 */
function escapePercent(src: string): string {
  return src.replace(/(\\*)%/g, (_m, slashes: string) =>
    slashes.length % 2 === 0 ? `${slashes}\\%` : `${slashes}%`,
  );
}

/** 数学体中 Unicode 符号 → LaTeX 等价命令（KaTeX 有度量，消除 tofu）。 */
function normalizeSymbols(src: string): string {
  return src
    .replace(/‖/g, "\\Vert ")
    .replace(/∥/g, "\\parallel ")
    .replace(/•/g, "\\bullet ")
    // 下标裸 CJK（`\underbrace{…}_{常数 2}` 这类 PDF 提取的标注）包进 `\text{}`，
    // 消除逐字 unicodeTextInMathMode 告警（KaTeX 对 \text 内 Unicode 走文本模式）。
    .replace(
      new RegExp(`(_\\{|\\^\\{)([^{}]*${CJK_CLASS}[^{}]*)\\}`, "g"),
      "$1\\text{$2}}",
    );
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

    // 2. `%` 转义作用于整串（catcode 14 不分模式）；3. 符号归一仅限数学体
    //    （`\text{...}` 内的 Unicode 符号保持原样，走浏览器字体）。
    const cleaned = escapePercent(replaceOutsideTextMacros(node.value, normalizeSymbols));
    if (cleaned !== node.value) setMathValue(node, cleaned);
  });
};

/** 仅对 `\text{...}` 片段之外的部分应用 transform，文本宏片段原样保留。 */
function replaceOutsideTextMacros(src: string, transform: (s: string) => string): string {
  const TEXT_MACRO_RE = new RegExp(TEXT_MACRO_SOURCE, "g");
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
