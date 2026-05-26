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
                <CodeBlock className={codeChild.className}>
                  {codeChild.value}
                </CodeBlock>
              );
            }
            return <pre>{children}</pre>;
          },
          table: ({ children }) => <ResponsiveTable>{children}</ResponsiveTable>,
          img: ({ src, alt, width, height, style }) => {
            // ISSUE-094 R8：透传后端 _image_to_markdown 输出的 width / height /
            // style，避免图片自然宽度（PNG 像素）造成 PDF→Markdown 视觉缩放失真。
            // 与 apps/negentropy-ui/.../DocumentMarkdownRenderer.tsx (DocumentImage)
            // 语义对齐：让 <img> 在容器内按 PDF pt × (96/72) CSS 像素显示，同时
            // 通过 max-width:100%; height:auto 在窄屏下自适应缩放。
            //
            // style 合并优先级：后端 inline style（含 max-width / height）位于
            // 用户视觉契约的源头，本组件追加 borderRadius 作为站点视觉规范。
            const mergedStyle: React.CSSProperties = {
              ...(style && typeof style === "object" ? style : {}),
              borderRadius: "var(--wiki-radius)",
            };
            // eslint-disable-next-line @next/next/no-img-element
            return (
              <img
                src={src}
                alt={alt ?? ""}
                width={width}
                height={height}
                loading="lazy"
                decoding="async"
                style={mergedStyle}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function extractCodeChild(children: React.ReactNode): { value: string; className?: string } | null {
  if (!children) return null;
  const reactChildren = Array.isArray(children) ? children : [children];
  for (const child of reactChildren) {
    if (child && typeof child === "object" && "props" in child) {
      const codeEl = child as { props?: { children?: React.ReactNode; className?: string } };
      if (codeEl.props?.children != null) {
        const value = typeof codeEl.props.children === "string"
          ? codeEl.props.children
          : String(codeEl.props.children);
        return { value, className: codeEl.props.className };
      }
    }
  }
  return null;
}
