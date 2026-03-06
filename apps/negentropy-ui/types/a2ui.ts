import type { BaseEvent, Message } from "@ag-ui/core";

export type ConversationNodeType =
  | "turn"
  | "text"
  | "tool-call"
  | "tool-result"
  | "activity"
  | "reasoning"
  | "state-delta"
  | "state-snapshot"
  | "step"
  | "raw"
  | "custom"
  | "event"
  | "error";

export interface NodeTimeRange {
  start: number;
  end: number;
}

export interface ConversationNode {
  id: string;
  type: ConversationNodeType;
  parentId: string | null;
  children: ConversationNode[];
  threadId: string;
  runId?: string;
  messageId?: string;
  toolCallId?: string;
  timestamp: number;
  timeRange: NodeTimeRange;
  title: string;
  status?: string;
  role?: "user" | "assistant" | "system";
  summary?: string;
  visibility: "chat" | "collapsed" | "debug-only";
  isStructural?: boolean;
  payload: Record<string, unknown>;
  sourceEventTypes: string[];
  relatedMessageIds: string[];
}

export interface ConversationTree {
  roots: ConversationNode[];
  nodeIndex: Map<string, ConversationNode>;
  messageNodeIndex: Map<string, string>;
  toolNodeIndex: Map<string, string>;
}

export interface BuildConversationTreeOptions {
  events: BaseEvent[];
  fallbackMessages?: Message[];
}
