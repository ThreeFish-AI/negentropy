import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { remarkWikiLink } from "@/lib/agent-chat/remark-wiki-link";
import type { Root, Link, Text, Paragraph } from "mdast";

function transform(md: string): Root {
  const processor = unified().use(remarkParse).use(remarkWikiLink);
  const tree = processor.parse(md);
  return processor.runSync(tree) as Root;
}

describe("remarkWikiLink", () => {
  it("把 [[wiki:/slug#anchor|label]] 转为带 data-wiki-link 的链接节点", () => {
    const tree = transform("Hello [[wiki:/engineering/auth#sso|SSO 文档]] world");
    const para = tree.children[0] as Paragraph;
    expect(para.type).toBe("paragraph");
    const [pre, link, post] = para.children;
    expect((pre as Text).value).toBe("Hello ");
    expect(link.type).toBe("link");
    expect((link as Link).url).toBe("/engineering/auth#sso");
    expect((link as Link).data?.hProperties).toMatchObject({
      "data-wiki-link": "/engineering/auth#sso",
    });
    expect(((link as Link).children[0] as Text).value).toBe("SSO 文档");
    expect((post as Text).value).toBe(" world");
  });

  it("无 label 时回退到 href 作为可见文本", () => {
    const tree = transform("[[wiki:/foo/bar]]");
    const para = tree.children[0] as Paragraph;
    const link = para.children[0] as Link;
    expect(link.url).toBe("/foo/bar");
    expect((link.children[0] as Text).value).toBe("/foo/bar");
  });

  it("不影响普通 Markdown 链接 / 文本", () => {
    const tree = transform("plain [foo](https://example.com) text");
    const para = tree.children[0] as Paragraph;
    expect(para.children).toHaveLength(3);
    const link = para.children[1] as Link;
    expect(link.url).toBe("https://example.com");
    expect(link.data?.hProperties).toBeUndefined();
  });

  it("一段内可识别多个 wiki 链接", () => {
    const tree = transform("[[wiki:/a|A]] / [[wiki:/b|B]]");
    const para = tree.children[0] as Paragraph;
    const links = para.children.filter((c) => c.type === "link") as Link[];
    expect(links).toHaveLength(2);
    expect(links[0]!.url).toBe("/a");
    expect(links[1]!.url).toBe("/b");
  });

  it("href 不以 / 开头时不匹配（防止外部 URL 误转）", () => {
    // 当前正则要求 /，"wiki:foo" 不会匹配
    const tree = transform("[[wiki:foo]]");
    const para = tree.children[0] as Paragraph;
    // 整段保留为原 text
    expect(para.children[0]?.type).toBe("text");
    expect((para.children[0] as Text).value).toBe("[[wiki:foo]]");
  });
});
