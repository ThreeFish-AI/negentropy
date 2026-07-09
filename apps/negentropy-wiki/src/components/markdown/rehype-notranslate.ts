import type { Plugin } from "unified";
import { visit, SKIP } from "unist-util-visit";

/**
 * rehypeNotranslate —— 为「不需要翻译的内容块」注入 Google 翻译约定的 `notranslate` class，
 * 使 Chrome / Google 翻译在翻译整页时跳过这些块及其子树，避免误翻。
 *
 * 本插件只负责**无 React 组件钩子**的两类块：
 *  - 行内代码（裸 <code>，父节点非 <pre>）：如 `useState`、`true`、`git commit`。
 *  - KaTeX 公式（rehype-katex 输出的原始 HTML）：块级 `.katex-display` / 行内 `.katex`。
 *
 * Fenced 代码块与 Mermaid 走各自的 React 组件（CodeBlock / MermaidDiagram）内注入，
 * 不在此处理——因为 fenced <code> 的 className 会被 CodeBlock 用于计算语言标签，
 * 在此追加 class 会污染标签显示。
 *
 * 挂载位置须在 `rehypeKatex` 之后（保证 `.katex` 节点已生成）。`className` 位于
 * rehype-sanitize 默认白名单内，故无需扩展 sanitize schema，也不受插件顺序中 sanitize 的影响。
 */
const NOTRANSLATE = "notranslate";

/** 最小 hast element 结构（仅用到 tagName / properties.className）；避免直接依赖 `hast` 类型包。 */
interface HastElement {
  type: "element";
  tagName: string;
  properties?: {
    className?: string | number | (string | number)[];
    [key: string]: unknown;
  };
}

function isElement(node: unknown): node is HastElement {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { type?: unknown }).type === "element" &&
    typeof (node as { tagName?: unknown }).tagName === "string"
  );
}

/** 判断某节点是否为 <pre> element（返回布尔而非类型谓词，避免对 parent 收窄成 never）。 */
function isPreElement(node: unknown): boolean {
  return isElement(node) && node.tagName === "pre";
}

/** 读取 element 上的 class 令牌数组（兼容 string / string[] / 缺省）。 */
function classTokens(node: HastElement): string[] {
  const cn = node.properties?.className;
  if (Array.isArray(cn)) return cn.map(String);
  if (typeof cn === "string") return cn.split(/\s+/).filter(Boolean);
  return [];
}

/** 幂等地把 `notranslate` 追加到 element 的 className。 */
function addNotranslate(node: HastElement): void {
  const tokens = classTokens(node);
  if (tokens.includes(NOTRANSLATE)) return;
  tokens.push(NOTRANSLATE);
  const props = node.properties ?? (node.properties = {});
  props.className = tokens;
}

export const rehypeNotranslate: Plugin = () => (tree) => {
  visit(tree, (node, _index, parent) => {
    if (!isElement(node)) return;
    const tokens = classTokens(node);

    // 公式：命中 KaTeX 最外层节点即豁免整棵，SKIP 避免下钻内部（含 MathML）造成冗余标记。
    // 块级结构为 span.katex-display > span.katex，SKIP 于外层即可覆盖内层。
    if (tokens.includes("katex-display") || tokens.includes("katex")) {
      addNotranslate(node);
      return SKIP;
    }

    // 行内代码：裸 <code> 且父节点非 <pre>（fenced 的内层 code 交给 CodeBlock 组件处理）。
    if (node.tagName === "code" && !isPreElement(parent)) {
      addNotranslate(node);
    }

    return undefined;
  });
};

export default rehypeNotranslate;
