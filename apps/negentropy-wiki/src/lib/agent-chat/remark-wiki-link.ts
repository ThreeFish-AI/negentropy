/**
 * remark 插件：把 Agent 回答中的 `[[wiki:/slug#anchor|可选标签]]` 占位符
 * 转为内部链接节点，由 react-markdown 的 components.a override 渲染为
 * `next/link` 实现站内跳转（不全量刷新、Drawer 状态保留）。
 *
 * 语法：
 *   `[[wiki:/engineering/auth#sso|SSO 文档]]` → <a data-wiki-link="/engineering/auth#sso">SSO 文档</a>
 *   `[[wiki:/engineering/auth]]` → <a data-wiki-link="/engineering/auth">/engineering/auth</a>
 *
 * 与 wiki 内链网络编织 —— 让 Agent 回答可点击穿越到任意 wiki 页面。
 */
import type { Plugin } from "unified";
import type { Root, Text, Link, PhrasingContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";

/** 匹配 [[wiki:/path#anchor|label]] —— path 强制以 / 开头，label 可选。 */
const WIKI_LINK_RE = /\[\[wiki:(\/[^|\]]+)(?:\|([^\]]+))?\]\]/g;

export const remarkWikiLink: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || typeof index !== "number") return;
      const value = node.value;
      if (!value.includes("[[wiki:")) return;

      const newChildren: PhrasingContent[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      WIKI_LINK_RE.lastIndex = 0;

      while ((match = WIKI_LINK_RE.exec(value)) !== null) {
        const [full, href, label] = match;
        const start = match.index;
        if (start > lastIndex) {
          newChildren.push({
            type: "text",
            value: value.slice(lastIndex, start),
          });
        }
        const link: Link = {
          type: "link",
          url: href ?? "",
          title: null,
          children: [{ type: "text", value: label ?? href ?? "" }],
          // mdast Link 没有 data 属性槽，react-markdown 通过 hProperties 透传
          // ；我们用 data 标记，由组件层在 components.a 中识别。
          data: {
            hProperties: { "data-wiki-link": href ?? "" },
          },
        };
        newChildren.push(link);
        lastIndex = start + full.length;
      }

      if (lastIndex === 0) return;
      if (lastIndex < value.length) {
        newChildren.push({ type: "text", value: value.slice(lastIndex) });
      }

      // 替换当前 text 节点为多节点序列
      (parent.children as PhrasingContent[]).splice(index, 1, ...newChildren);
      // 跳过新插入的节点，避免重复 visit
      return [SKIP, index + newChildren.length];
    });
  };
};
