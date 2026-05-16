/**
 * 从 ConversationTree 中提取某次 run 的 assistant 最终回答文本。
 *
 * 业务用途：Home Composer 通过 ``@Corpus`` 标记输出沉淀目标后，
 * 在 RUN_FINISHED 事件触发时由此函数取回本轮助手回答，作为新 Document
 * 摄入到目标 Corpus（``ingestText``）。
 *
 * 实现要点：
 * - 只挑选 ``type === "text" && role === "assistant" && runId === target``；
 * - 按 ``sourceOrder`` 升序拼接 ``payload.content``（与 ChatStream 渲染顺序一致）；
 * - 不递归 tree.roots —— 直接遍历 ``nodeIndex`` Map 即可（已是扁平索引）。
 */
import type { ConversationNode, ConversationTree } from "@/types/a2ui";

export function extractFinalAssistantText(
  tree: ConversationTree | null | undefined,
  runId: string,
): string {
  if (!tree || !runId) return "";
  const nodes: ConversationNode[] = [];
  for (const node of tree.nodeIndex.values()) {
    if (
      node.type === "text" &&
      node.role === "assistant" &&
      node.runId === runId
    ) {
      nodes.push(node);
    }
  }
  nodes.sort((a, b) => a.sourceOrder - b.sourceOrder);
  const parts: string[] = [];
  for (const node of nodes) {
    const content = node.payload?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      parts.push(content);
    }
  }
  // 多段 streaming text 之间用单空行衔接，与 Markdown 段落语义一致。
  return parts.join("\n\n").trim();
}
