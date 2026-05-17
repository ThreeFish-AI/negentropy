import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { AnchorHeading } from "./AnchorHeading";
import { ResponsiveTable } from "./ResponsiveTable";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="wiki-markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
              return (
                <CodeBlock className={codeChild.className} >
                  {codeChild.value}
                </CodeBlock>
              );
            }
            return <pre>{children}</pre>;
          },
          table: ({ children }) => <ResponsiveTable>{children}</ResponsiveTable>,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? ""}
              loading="lazy"
              decoding="async"
              style={{ borderRadius: "var(--wiki-radius)" }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function extractCodeChild(children: React.ReactNode): { value: string; className?: string } | null {
  if (!children) return null;
  // React Markdown renders pre > code
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
