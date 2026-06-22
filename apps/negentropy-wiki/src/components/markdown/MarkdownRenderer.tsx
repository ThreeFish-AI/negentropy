import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./CodeBlock";
import { AnchorHeading } from "./AnchorHeading";
import { ResponsiveTable } from "./ResponsiveTable";
import { MermaidDiagram } from "./MermaidDiagram";
import { ZoomableImage } from "./ZoomableImage";

const wikiSanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    img: [
      ...((defaultSchema.attributes ?? {}).img ?? []),
      "width",
      "height",
      "loading",
      "decoding",
      // ISSUE-094 R8：后端 _image_to_markdown 输出形如
      // <img ... style="max-width:100%;height:auto;" />，确保前端渲染时
      // 图片在窄屏下自适应不超出容器。rehype-sanitize 内置 CSS 白名单
      // 已防 expression() / url(javascript:) 等 XSS。
      "style",
    ],
    figure: [],
    figcaption: [],
  },
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    // 不设 translate="no"，允许浏览器翻译。翻译态下注解由 Pillar 1-5 保护：
    // Snapshot 锚定 + MutationObserver 自动重应用 + CSS Highlight API 渲染。
    <div className="wiki-markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, wikiSanitizeSchema],
          rehypeKatex,
          rehypeSlug,
          rehypeHighlight,
        ]}
        components={{
          h1: ({ id, children }) => <AnchorHeading level={1} id={id}>{children}</AnchorHeading>,
          h2: ({ id, children }) => <AnchorHeading level={2} id={id}>{children}</AnchorHeading>,
          h3: ({ id, children }) => <AnchorHeading level={3} id={id}>{children}</AnchorHeading>,
          h4: ({ id, children }) => <AnchorHeading level={4} id={id}>{children}</AnchorHeading>,
          h5: ({ id, children }) => <AnchorHeading level={5} id={id}>{children}</AnchorHeading>,
          h6: ({ id, children }) => <AnchorHeading level={6} id={id}>{children}</AnchorHeading>,
          pre: ({ children }) => {
            const codeChild = extractCodeChild(children);
            if (codeChild) {
              const mermaidMatch = /language-mermaid/.exec(codeChild.className || "");
              if (mermaidMatch) {
                return <MermaidDiagram code={codeChild.value} />;
              }
              return (
                <CodeBlock className={codeChild.className} codeText={codeChild.value}>
                  {codeChild.reactChildren}
                </CodeBlock>
              );
            }
            return <pre>{children}</pre>;
          },
          table: ({ children }) => <ResponsiveTable>{children}</ResponsiveTable>,
          // 单击图片在整页 Lightbox 中最大化查看（业界常规 click-to-zoom 交互）。
          // 显式解构丢弃 react-markdown 传入的 hast `node`，避免无用节点对象跨
          // Server→Client 边界。isLargeFigure 等宽度逻辑已迁入 ZoomableImage。
          img: ({ src, alt, title, width, height, style }) => (
            <ZoomableImage
              src={src}
              alt={alt}
              title={title}
              width={width}
              height={height}
              style={style}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * 从 React 元素树中递归提取纯文本（叶子字符串拼接）。
 * rehype-highlight 将 code children 转为 <span class="hljs-*"> 元素树，
 * 此函数遍历该树提取纯文本，供「复制」按钮和 Mermaid 使用。
 */
function extractTextContent(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(extractTextContent).join("");
  if ("props" in node) {
    const el = node as { props?: { children?: React.ReactNode } };
    return extractTextContent(el.props?.children);
  }
  return "";
}

function extractCodeChild(
  children: React.ReactNode,
): { value: string; className?: string; reactChildren: React.ReactNode } | null {
  if (!children) return null;
  const reactChildren = Array.isArray(children) ? children : [children];
  for (const child of reactChildren) {
    if (child && typeof child === "object" && "props" in child) {
      const codeEl = child as { props?: { children?: React.ReactNode; className?: string } };
      if (codeEl.props?.children != null) {
        const codeChildren = codeEl.props.children;
        const value = typeof codeChildren === "string"
          ? codeChildren
          : extractTextContent(codeChildren);
        return { value, className: codeEl.props.className, reactChildren: codeChildren };
      }
    }
  }
  return null;
}
