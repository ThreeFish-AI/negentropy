import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useEffect,
  useState,
  type Dispatch,
  type MutableRefObject,
} from "react";
import { compactEvents } from "@ag-ui/client";
import type { BaseEvent, Message } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import type { SessionProjectionState } from "@/types/common";
import { buildConversationTree, buildNodeTimestampIndex } from "@/utils/conversation-tree";
import {
  buildMessageLedger,
  ledgerEntriesToMessages,
  mergeMessageLedger,
} from "@/utils/message-ledger";
import { normalizeMessageContent } from "@/utils/message";
import {
  mergeOptimisticMessages,
  reconcileOptimisticMessages,
} from "@/utils/message-merge";
import { buildStateSnapshotFromEvents } from "@/utils/state";
import { buildTimelineItems } from "@/utils/timeline";
import {
  EMPTY_SESSION_PROJECTION,
  sessionProjectionReducer,
  shouldMergeHydratedProjection,
  type SessionProjectionAction,
} from "@/features/session/utils/session-projection";
import type { HydratedSessionDetail } from "@/utils/session-hydration";
import { deriveRunStates } from "@/utils/session-hydration";

export interface UseSessionProjectionOptions {
  sessionId: string | null;
  selectedNodeId: string | null;
  maxEvents?: number;
}

export interface UseSessionProjectionReturnValue {
  sessionProjection: SessionProjectionState;
  rawEvents: BaseEvent[];
  snapshotForRender: Record<string, unknown> | null;
  snapshotForDisplay: Record<string, unknown> | null;
  confirmedMessageLedger: SessionProjectionState["messageLedger"];
  renderMessageLedger: SessionProjectionState["messageLedger"];
  messagesForRenderBase: Message[];
  mergedMessagesForRender: Message[];
  conversationTree: ReturnType<typeof buildConversationTree>;
  nodeTimestampIndex: Map<string, number>;
  filteredRawEvents: BaseEvent[];
  compactedEvents: BaseEvent[];
  timelineItems: ReturnType<typeof buildTimelineItems>;
  pendingConfirmations: number;
  latestRunState: ReturnType<typeof import("@/utils/session-hydration").deriveRunStates>[number] | null;
  optimisticMessages: Message[];
  loadedSessionIdRef: MutableRefObject<string | null>;
  rawEventsRef: MutableRefObject<BaseEvent[]>;
  dispatchSessionProjection: Dispatch<SessionProjectionAction>;
  appendRealtimeEvent: (event: BaseEvent) => void;
  appendOptimisticMessage: (message: Message) => void;
  clearOptimisticMessages: () => void;
  clearSessionProjection: () => void;
  applyHydratedSession: (input: {
    sessionId: string;
    detail: HydratedSessionDetail;
    activeSessionId: string | null;
  }) => void;
}

export function useSessionProjection(
  options: UseSessionProjectionOptions,
): UseSessionProjectionReturnValue {
  const { sessionId, selectedNodeId, maxEvents = 10000 } = options;
  const [sessionProjection, dispatchSessionProjection] = useReducer(
    sessionProjectionReducer,
    EMPTY_SESSION_PROJECTION,
  );
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const loadedSessionIdRef = useRef<string | null>(sessionProjection.loadedSessionId);
  const rawEventsRef = useRef<BaseEvent[]>(sessionProjection.rawEvents);

  useEffect(() => {
    loadedSessionIdRef.current = sessionProjection.loadedSessionId;
  }, [sessionProjection.loadedSessionId]);

  useEffect(() => {
    rawEventsRef.current = sessionProjection.rawEvents;
  }, [sessionProjection.rawEvents]);

  const rawEvents = sessionProjection.rawEvents;
  const hasLoadedSession = sessionProjection.loadedSessionId === sessionId;
  const confirmedMessageLedger = hasLoadedSession
    ? sessionProjection.messageLedger
    : [];
  const snapshotForRender = hasLoadedSession ? sessionProjection.snapshot : null;

  const messagesForRenderBase = useMemo(
    () => ledgerEntriesToMessages(confirmedMessageLedger),
    [confirmedMessageLedger],
  );

  const mergedMessagesForRender = useMemo(() => {
    const pendingOptimistic = reconcileOptimisticMessages(
      messagesForRenderBase,
      optimisticMessages,
    );
    return mergeOptimisticMessages(messagesForRenderBase, pendingOptimistic).map(
      (message) =>
        !normalizeMessageContent(message).trim().length
          ? ({
              ...message,
              content: normalizeMessageContent(message),
            } as Message)
          : message,
    );
  }, [messagesForRenderBase, optimisticMessages]);

  const optimisticMessageLedger = useMemo(
    () =>
      buildMessageLedger({
        events: [],
        fallbackMessages: optimisticMessages,
      }),
    [optimisticMessages],
  );

  const renderMessageLedger = useMemo(
    () => mergeMessageLedger(confirmedMessageLedger, optimisticMessageLedger),
    [confirmedMessageLedger, optimisticMessageLedger],
  );

  const nodeTimestampIndex = useMemo(
    () =>
      buildNodeTimestampIndex(
        buildConversationTree({
          events: rawEvents,
          fallbackMessages: mergedMessagesForRender,
          messageLedger: renderMessageLedger,
        }),
      ),
    [mergedMessagesForRender, rawEvents, renderMessageLedger],
  );

  const filteredRawEvents = useMemo(() => {
    if (!selectedNodeId) {
      return rawEvents;
    }

    const cutoffTimestamp = nodeTimestampIndex.get(selectedNodeId);
    if (cutoffTimestamp === undefined) {
      return rawEvents;
    }

    return rawEvents.filter((event) => {
      const eventTimestamp = event.timestamp || 0;
      return eventTimestamp <= cutoffTimestamp;
    });
  }, [nodeTimestampIndex, rawEvents, selectedNodeId]);

  const compactedEvents = useMemo(
    () => compactEvents(filteredRawEvents),
    [filteredRawEvents],
  );
  const timelineItems = useMemo(
    () => buildTimelineItems(compactedEvents),
    [compactedEvents],
  );

  const conversationTree = useMemo(
    () =>
      buildConversationTree({
        events: rawEvents,
        fallbackMessages: mergedMessagesForRender,
        messageLedger: renderMessageLedger,
      }),
    [mergedMessagesForRender, rawEvents, renderMessageLedger],
  );

  const pendingConfirmations = useMemo(() => {
    const pending = new Set<string>();
    rawEvents.forEach((event) => {
      if (
        event.type === EventType.TOOL_CALL_START &&
        "toolCallName" in event &&
        "toolCallId" in event &&
        event.toolCallName === "ui.confirmation"
      ) {
        pending.add(String(event.toolCallId));
      }
      if (event.type === EventType.TOOL_CALL_RESULT && "toolCallId" in event) {
        pending.delete(String(event.toolCallId));
      }
    });
    return pending.size;
  }, [rawEvents]);

  const latestRunState = useMemo(() => {
    const runStates = deriveRunStates(rawEvents);
    return runStates[runStates.length - 1] || null;
  }, [rawEvents]);

  const historicalSnapshot = useMemo(
    () => buildStateSnapshotFromEvents(filteredRawEvents),
    [filteredRawEvents],
  );
  const snapshotForDisplay = useMemo(() => {
    if (!selectedNodeId) {
      return snapshotForRender;
    }
    return historicalSnapshot;
  }, [historicalSnapshot, selectedNodeId, snapshotForRender]);

  const appendRealtimeEvent = useCallback(
    (event: BaseEvent) => {
      dispatchSessionProjection({
        type: "append_realtime_events",
        events: [event],
        maxEvents,
      });
    },
    [maxEvents],
  );

  const appendOptimisticMessage = useCallback((message: Message) => {
    setOptimisticMessages((prev) => [...prev, message]);
  }, []);

  const clearOptimisticMessages = useCallback(() => {
    setOptimisticMessages([]);
  }, []);

  const clearSessionProjection = useCallback(() => {
    setOptimisticMessages([]);
    dispatchSessionProjection({ type: "reset" });
  }, []);

  const applyHydratedSessionAction = useCallback(
    (input: {
      sessionId: string;
      detail: HydratedSessionDetail;
      activeSessionId: string | null;
    }) => {
      const shouldMerge = shouldMergeHydratedProjection({
        currentLoadedSessionId: loadedSessionIdRef.current,
        activeSessionId: input.activeSessionId,
        incomingSessionId: input.sessionId,
        currentRawEvents: rawEventsRef.current,
      });
      dispatchSessionProjection({
        type: "hydrate_session",
        sessionId: input.sessionId,
        detail: input.detail,
        shouldMerge,
      });
    },
    [],
  );

  return {
    sessionProjection,
    rawEvents,
    snapshotForRender,
    snapshotForDisplay,
    confirmedMessageLedger,
    renderMessageLedger,
    messagesForRenderBase,
    mergedMessagesForRender,
    conversationTree,
    nodeTimestampIndex,
    filteredRawEvents,
    compactedEvents,
    timelineItems,
    pendingConfirmations,
    latestRunState,
    optimisticMessages,
    loadedSessionIdRef,
    rawEventsRef,
    dispatchSessionProjection,
    appendRealtimeEvent,
    appendOptimisticMessage,
    clearOptimisticMessages,
    clearSessionProjection,
    applyHydratedSession: applyHydratedSessionAction,
  };
}
