import type { ConversationNode } from "@/types/a2ui";

export function safeJsonParse(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNodePayloadEmpty(node: ConversationNode): boolean {
  switch (node.type) {
    case "text":
      return String(node.payload.content || "").trim().length === 0;
    case "tool-call":
      return (
        String(node.payload.toolCallName || node.title || "").trim().length === 0 &&
        String(node.payload.args || "").trim().length === 0
      );
    case "tool-result": {
      const content = safeJsonParse(node.payload.content);
      if (typeof content === "string") {
        return content.trim().length === 0;
      }
      if (Array.isArray(content)) {
        return content.length === 0;
      }
      if (isPlainObject(content)) {
        return Object.keys(content).length === 0;
      }
      return content == null;
    }
    case "activity":
    case "raw":
    case "custom": {
      const payload =
        node.type === "activity"
          ? node.payload.content
          : node.type === "raw"
            ? node.payload.data
            : node.payload.data;
      const value = safeJsonParse(payload);
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      if (isPlainObject(value)) {
        return Object.keys(value).length === 0;
      }
      return value == null || String(value).trim().length === 0;
    }
    case "state-delta":
      return Array.isArray(node.payload.delta)
        ? node.payload.delta.length === 0
        : isPlainObject(node.payload.delta)
          ? Object.keys(node.payload.delta).length === 0
          : true;
    case "state-snapshot":
      return isPlainObject(node.payload.snapshot)
        ? Object.keys(node.payload.snapshot).length === 0
        : true;
    default:
      return false;
  }
}

export function classifyNodeVisibility(
  node: ConversationNode,
): "chat" | "collapsed" | "debug-only" {
  if (node.type === "turn" || node.type === "text" || node.type === "tool-call" || node.type === "tool-result") {
    return "chat";
  }
  if (node.type === "custom") {
    const eventType = String(node.payload.eventType || "");
    if (eventType === "ne.a2ui.link") {
      return "debug-only";
    }
    if (eventType === "ne.a2ui.reasoning") {
      return "debug-only";
    }
  }
  if (node.type === "raw") {
    return "debug-only";
  }
  if (isNodePayloadEmpty(node)) {
    return "debug-only";
  }
  if (
    node.type === "activity" ||
    node.type === "reasoning" ||
    node.type === "step" ||
    node.type === "state-delta" ||
    node.type === "state-snapshot" ||
    node.type === "custom" ||
    node.type === "error" ||
    node.type === "event"
  ) {
    return "collapsed";
  }
  return "chat";
}

export function buildNodeSummary(node: ConversationNode): string[] {
  const lines: string[] = [];

  if (node.type === "tool-call") {
    const parsed = safeJsonParse(node.payload.args);
    if (isPlainObject(parsed)) {
      const keys = Object.keys(parsed).slice(0, 3);
      if (keys.length > 0) {
        lines.push(`参数 ${keys.join("、")}`);
      }
    } else if (typeof parsed === "string" && parsed.trim()) {
      lines.push(parsed.trim().slice(0, 120));
    }
  }

  if (node.type === "tool-result" || node.type === "activity") {
    const parsed = safeJsonParse(
      node.type === "tool-result" ? node.payload.content : node.payload.content,
    );
    if (isPlainObject(parsed)) {
      const status = parsed.status;
      const message = parsed.message;
      const record = isPlainObject(parsed.record) ? parsed.record : null;
      const activity = record?.activity;
      if (typeof status === "string") lines.push(`状态: ${status}`);
      if (typeof activity === "string") lines.push(activity);
      if (typeof message === "string") lines.push(message);
      if (lines.length === 0) {
        lines.push(`${Object.keys(parsed).length} 个字段`);
      }
    } else if (typeof parsed === "string" && parsed.trim()) {
      lines.push(parsed.trim().slice(0, 160));
    }
  }

  if (node.type === "state-delta") {
    const delta = node.payload.delta;
    if (Array.isArray(delta)) {
      lines.push(`${delta.length} 个变更操作`);
    } else if (isPlainObject(delta)) {
      lines.push(`${Object.keys(delta).length} 个状态字段`);
    }
  }

  if (node.type === "state-snapshot" && isPlainObject(node.payload.snapshot)) {
    lines.push(`${Object.keys(node.payload.snapshot).length} 个状态字段`);
  }

  if (node.type === "reasoning" || node.type === "step") {
    if (node.summary) {
      lines.push(node.summary);
    } else if (typeof node.payload.phase === "string") {
      lines.push(`阶段: ${node.payload.phase}`);
    }
  }

  if (node.type === "custom") {
    const eventType = String(node.payload.eventType || node.title || "custom");
    lines.push(eventType);
    const data = safeJsonParse(node.payload.data);
    if (isPlainObject(data)) {
      lines.push(`${Object.keys(data).length} 个字段`);
    }
  }

  if (node.type === "error" && typeof node.payload.message === "string") {
    lines.push(node.payload.message);
  }

  return lines.slice(0, 3);
}
