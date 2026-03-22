import type { BaseEvent } from "@ag-ui/core";
import type {
  SessionProjectionState,
} from "@/types/common";
import { buildMessageLedger, mergeMessageLedger } from "@/utils/message-ledger";
import {
  hasSameEventSequence,
  mergeEvents,
  type HydratedSessionDetail,
} from "@/utils/session-hydration";

export const EMPTY_SESSION_PROJECTION: SessionProjectionState = {
  loadedSessionId: null,
  rawEvents: [],
  messageLedger: [],
  snapshot: null,
};

export type SessionProjectionAction =
  | {
      type: "reset";
    }
  | {
      type: "append_realtime_events";
      events: BaseEvent[];
      maxEvents?: number;
    }
  | {
      type: "hydrate_session";
      sessionId: string;
      detail: HydratedSessionDetail;
      shouldMerge: boolean;
    };

export function shouldMergeHydratedProjection(input: {
  currentLoadedSessionId: string | null;
  activeSessionId: string | null;
  incomingSessionId: string;
  currentRawEvents: BaseEvent[];
}): boolean {
  return (
    input.currentLoadedSessionId === input.incomingSessionId ||
    (input.activeSessionId === input.incomingSessionId &&
      input.currentRawEvents.length > 0)
  );
}

export function applyRealtimeEvents(
  state: SessionProjectionState,
  events: BaseEvent[],
  maxEvents = 10000,
): SessionProjectionState {
  const nextRawEvents = mergeEvents(state.rawEvents, events).slice(-maxEvents);
  if (hasSameEventSequence(state.rawEvents, nextRawEvents)) {
    return state;
  }
  return {
    ...state,
    rawEvents: nextRawEvents,
    messageLedger: buildMessageLedger({ events: nextRawEvents }),
  };
}

export function applyHydratedSession(
  state: SessionProjectionState,
  input: {
    sessionId: string;
    detail: HydratedSessionDetail;
    shouldMerge: boolean;
  },
): SessionProjectionState {
  if (!input.shouldMerge) {
    return {
      loadedSessionId: input.sessionId,
      rawEvents: input.detail.events,
      messageLedger: input.detail.messageLedger,
      snapshot: input.detail.snapshot,
    };
  }

  const nextRawEvents = mergeEvents(state.rawEvents, input.detail.events);
  return {
    loadedSessionId: input.sessionId,
    rawEvents: nextRawEvents,
    messageLedger: mergeMessageLedger(
      state.messageLedger,
      input.detail.messageLedger,
    ),
    snapshot: input.detail.snapshot ?? state.snapshot,
  };
}

export function sessionProjectionReducer(
  state: SessionProjectionState,
  action: SessionProjectionAction,
): SessionProjectionState {
  switch (action.type) {
    case "reset":
      return EMPTY_SESSION_PROJECTION;
    case "append_realtime_events":
      return applyRealtimeEvents(state, action.events, action.maxEvents);
    case "hydrate_session":
      return applyHydratedSession(state, action);
    default:
      return state;
  }
}
