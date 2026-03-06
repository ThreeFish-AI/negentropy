import { BaseEvent, EventType } from "@ag-ui/core";
import type { AdkEventPayload } from "@/lib/adk";
import { adkEventToAguiEvents } from "@/lib/adk";

const ALLOWED_ROLES = new Set(["assistant", "user", "system", "developer"]);

type NormalizableEvent = BaseEvent & { role?: string; delta?: unknown };

function jsonPointerEscape(segment: string) {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function toPatchOperations(delta: Record<string, unknown>) {
  return Object.entries(delta).map(([key, value]) => ({
    op: "add",
    path: `/${jsonPointerEscape(key)}`,
    value,
  }));
}

export function normalizeAguiEvent(event: BaseEvent): BaseEvent {
  const next = { ...event } as NormalizableEvent;
  if (
    "role" in next &&
    typeof next.role === "string" &&
    !ALLOWED_ROLES.has(next.role)
  ) {
    next.role = "assistant";
  }
  if (
    next.type === EventType.STATE_DELTA &&
    next.delta &&
    !Array.isArray(next.delta)
  ) {
    if (typeof next.delta === "object") {
      next.delta = toPatchOperations(next.delta as Record<string, unknown>);
    } else {
      next.delta = [];
    }
  }
  return next;
}

export function resolveEventRunAndThread(
  event: BaseEvent,
  fallback: { runId: string; threadId: string },
): BaseEvent {
  return {
    ...event,
    threadId:
      "threadId" in event &&
      typeof event.threadId === "string" &&
      event.threadId.trim() &&
      event.threadId !== "default"
        ? event.threadId
        : fallback.threadId,
    runId:
      "runId" in event &&
      typeof event.runId === "string" &&
      event.runId.trim() &&
      event.runId !== "default"
        ? event.runId
        : fallback.runId,
  };
}

export function mapAdkPayloadToNormalizedAguiEvents(
  payload: AdkEventPayload,
  fallback: { runId: string; threadId: string },
): BaseEvent[] {
  return adkEventToAguiEvents(payload).map((event) =>
    normalizeAguiEvent(resolveEventRunAndThread(event, fallback)),
  );
}
