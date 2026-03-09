import type { BaseEvent, Message } from "@ag-ui/core";
import type { CanonicalMessageRole } from "@/types/agui";
import type { MessageLedgerEntry } from "@/types/common";
import type { ChatMessage, ToolCallStatus } from "@/types/common";

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
  sourceOrder: number;
  title: string;
  status?: string;
  role?: CanonicalMessageRole;
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
  messageLedger?: MessageLedgerEntry[];
}

export interface ToolExecutionEntry {
  id: string;
  nodeId: string;
  resultNodeId?: string;
  name: string;
  args: string;
  result?: string;
  status: ToolCallStatus;
  startedAt?: number;
  endedAt?: number;
  summary: string[];
}

export interface ChatMessageDisplayBlock {
  id: string;
  kind: "message";
  nodeId: string;
  timestamp: number;
  message: ChatMessage;
}

export interface ToolGroupDisplayBlock {
  id: string;
  kind: "tool-group";
  nodeId: string;
  anchorNodeId?: string;
  timestamp: number;
  parallel: boolean;
  defaultExpanded: boolean;
  status: ToolCallStatus;
  title: string;
  summary: string;
  tools: ToolExecutionEntry[];
}

export interface TurnStatusDisplayBlock {
  id: string;
  kind: "turn-status";
  nodeId: string;
  timestamp: number;
  status: "running" | "finished" | "blocked" | "error";
  title: string;
  detail?: string;
}

export interface ErrorDisplayBlock {
  id: string;
  kind: "error";
  nodeId: string;
  timestamp: number;
  title: string;
  message: string;
  code?: string;
}

export interface SummaryDisplayBlock {
  id: string;
  kind: "summary";
  nodeId: string;
  timestamp: number;
  title: string;
  lines: string[];
}

export type ChatDisplayBlock =
  | ChatMessageDisplayBlock
  | ToolGroupDisplayBlock
  | TurnStatusDisplayBlock
  | ErrorDisplayBlock
  | SummaryDisplayBlock;
