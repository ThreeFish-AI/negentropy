/* eslint-disable react-hooks/immutability --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { randomUUID } from "@ag-ui/client";
import { EventType, Message, type BaseEvent } from "@ag-ui/core";

import { ChatStream } from "../components/ui/ChatStream";
import { Composer } from "../components/ui/Composer";
import type { ComposerAttachment } from "../components/ui/AttachmentChip";
import type { MentionCandidate, MentionToken } from "@/types/mention";
import { deriveForwardedPropsFromMentions } from "@/utils/mention-parser";
import { extractFinalAssistantText } from "@/utils/run-output";
import { useSubAgentsList } from "@/hooks/useSubAgentsList";
import { useCorporaList } from "@/app/knowledge/apis/_components/hooks/useCorporaList";
import { ingestText } from "@/features/knowledge/utils/knowledge-api";
import { EventTimeline } from "../components/ui/EventTimeline";
import { LogBufferPanel } from "../components/ui/LogBufferPanel";
import { SessionList } from "../components/ui/SessionList";
import { StateSnapshot } from "../components/ui/StateSnapshot";
import { CHAT_CONTENT_RAIL_CLASS } from "../components/ui/chat-layout";
import { useSessionListService } from "@/features/session/hooks/useSessionListService";
import { useSessionService } from "@/features/session/hooks/useSessionService";
import {
  fetchModelConfigs,
  type ModelConfigItem,
} from "@/features/knowledge/utils/knowledge-api";

import { useAgentSubscription, type AgentLike } from "@/hooks/useAgentSubscription";
import { useConfirmationTool } from "@/hooks/useConfirmationTool";
import { useConversationSearch } from "@/hooks/useConversationSearch";
import { ConversationSearchBar } from "@/components/ui/ConversationSearchBar";
import { ApprovalDialog, type ApprovalDecision } from "@/components/ui/ApprovalDialog";
import { ApprovalPolicySelector, useApprovalPolicy } from "@/components/ui/ApprovalPolicySelector";

import { toast } from "@/lib/activity-toast";

// 提取的工具函数
import { createSessionLabel } from "@/utils/session";
import { deriveConnectionState } from "@/utils/session-hydration";

// 统一的类型定义
import type {
  ConnectionState,
  LogEntry,
  ToolProgressMap,
  ToolProgressSnapshot,
} from "@/types/common";

export const AGENT_ID = "negentropy";
export const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

/**
 * Per-session LLM 模型选择的本地持久化键（按 sessionId 命名空间隔离）。
 *
 * 选型理由（最小干预 + 单一事实源）：
 * - 后端通过 `state_delta.selected_llm_model` 在用户 Send 时写入 session.state，
 *   做为跨设备的事实源（参见 app/api/agui/route.ts）；
 * - 但「选择模型却尚未发送消息」时，后端 state 不会更新，刷新即丢失选择；
 * - localStorage 在浏览器侧立即落盘，覆盖刷新场景，与后端 state 互为镜像（任意
 *   一方有值即可命中），不引入新的后端 API 表面。
 */
const LOCAL_LLM_MODEL_KEY_PREFIX = "negentropy:home:llm-model:";
const LOCAL_THINKING_KEY_PREFIX = "negentropy:home:thinking:";

function readPersistedLlmModel(sessionId: string | null): string | null {
  if (!sessionId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${LOCAL_LLM_MODEL_KEY_PREFIX}${sessionId}`,
    );
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function writePersistedLlmModel(
  sessionId: string | null,
  value: string | null,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = `${LOCAL_LLM_MODEL_KEY_PREFIX}${sessionId}`;
    if (value && value.length > 0) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // localStorage 不可用时静默降级到内存态。
  }
}

function readPersistedThinking(sessionId: string | null): boolean | null {
  if (!sessionId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${LOCAL_THINKING_KEY_PREFIX}${sessionId}`,
    );
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writePersistedThinking(
  sessionId: string | null,
  value: boolean,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LOCAL_THINKING_KEY_PREFIX}${sessionId}`,
      value ? "1" : "0",
    );
  } catch {
    // localStorage 不可用时静默降级到内存态。
  }
}

function splitModelName(fullModelName: string | null): {
  vendor: string;
  modelName: string;
} | null {
  if (!fullModelName) return null;
  const slashIndex = fullModelName.indexOf("/");
  if (slashIndex < 0) {
    return { vendor: "", modelName: fullModelName };
  }
  return {
    vendor: fullModelName.slice(0, slashIndex),
    modelName: fullModelName.slice(slashIndex + 1),
  };
}

function modelSupportsThinking(vendor: string, modelName: string): boolean {
  const normalizedVendor = vendor.toLowerCase();
  const normalizedModel = modelName.toLowerCase();
  if (normalizedVendor === "anthropic" || normalizedModel.includes("claude")) {
    return true;
  }
  if (normalizedVendor === "openai") {
    return normalizedModel.startsWith("gpt-5") || /^o[1-9]/.test(normalizedModel);
  }
  return false;
}

function isThinkingSupportedForSelection(
  selectedModel: string | null,
  models: ModelConfigItem[],
): boolean {
  if (!selectedModel) {
    // Default 模型由后端单一事实源解析；当前 fallback 为 GPT-5 系列，前端保持可切换。
    return true;
  }
  const known = models.find(
    (item) => `${item.vendor}/${item.model_name}` === selectedModel,
  );
  if (known) {
    return modelSupportsThinking(known.vendor, known.model_name);
  }
  const parsed = splitModelName(selectedModel);
  if (!parsed) return false;
  return modelSupportsThinking(parsed.vendor, parsed.modelName);
}

/** Agent 类型：兼容 NdjsonHttpAgent 与测试 Mock */
export type HomeBodyAgent = AgentLike & {
  threadId?: string;
  isRunning: boolean;
  addMessage: (message: Message) => void;
  runAgent: (params: {
    runId: string;
    forwardedProps?: Record<string, unknown>;
  }) => Promise<unknown>;
  forwardedProps?: Record<string, unknown>;
  /**
   * NDJSON Agent 提供 abortRun()；测试 Mock 可省略。
   * 由 Composer 中断门按钮触发，复用 AbortController 链路。
   */
  abortRun?: () => void;
};

/**
 * HITL 确认工具注册子组件
 *
 * 仅在 CopilotKitProvider 内部渲染，避免 useCopilotKit() context 缺失。
 */
function ConfirmationToolRegistrar({
  onFollowup,
}: {
  onFollowup: (payload: { action: string; note: string }) => void;
}) {
  useConfirmationTool(onFollowup);
  return null;
}

export function HomeBody({
  agent,
  sessionId,
  userId,
  setSessionId,
  pendingSendRef,
  pendingForSessionRef,
}: {
  agent: HomeBodyAgent | null;
  sessionId: string | null;
  userId: string;
  setSessionId: (id: string | null) => void;
  pendingSendRef: React.MutableRefObject<string | null>;
  pendingForSessionRef: React.MutableRefObject<string | null>;
}) {
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  // Home Composer 的 @ Mention（agent / corpus-retrieve / corpus-output）。
  // 与 inputValue 平行存在，仅承担 ① UI 高亮 ② forwardedProps 派生。
  const [mentions, setMentions] = useState<MentionToken[]>([]);
  // doSend 时 snapshot 的 output_corpus_ids；RUN_FINISHED 后被 ingestText 消费。
  // 用 Map<runId, ids[]> 支持并发 turn（虽然当前实现一次只跑一个 run，但低成本兜底）。
  const outputCorpusIdsByRunRef = useRef<Map<string, string[]>>(new Map());
  const userPromptByRunRef = useRef<Map<string, string>>(new Map());
  // @ 弹层候选项数据源
  const { subagents, loading: subagentsLoading, error: subagentsError } =
    useSubAgentsList();
  const { corpora, loading: corporaLoading, error: corporaError } = useCorporaList();
  const agentCandidates = useMemo<MentionCandidate[]>(
    () =>
      subagents.map((a) => ({
        kind: "agent" as const,
        refId: a.name,
        label: a.display_name || a.name,
        description: a.description || undefined,
      })),
    [subagents],
  );
  const corpusCandidates = useMemo<MentionCandidate[]>(
    () =>
      corpora.map((c) => ({
        kind: "corpus-retrieve" as const, // 仅占位；MentionPopover 切换 Tab 时会改写 kind
        refId: c.id,
        label: c.name,
        description: c.description || undefined,
      })),
    [corpora],
  );
  const validAgentRefIds = useMemo(
    () => new Set(subagents.map((a) => a.name)),
    [subagents],
  );
  const validCorpusRefIds = useMemo(
    () => new Set(corpora.map((c) => c.id)),
    [corpora],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);
  const [llmModels, setLlmModels] = useState<ModelConfigItem[]>([]);
  const [selectedLlmModel, setSelectedLlmModel] = useState<string | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  // 中断门 — 用户主动 cancel 后短暂屏蔽 onRunFailed/onRunErrorEvent 引发的 error 状态，
  // 避免被显示成"运行错误"。100ms 窗口足以覆盖 abort 信号 round-trip。
  const userCancelledAtRef = useRef<number>(0);
  // 并发 runId 隔离 — 记录当前活跃的 runId，过滤旧 run 的残留事件，防止双气泡。
  // doSend 时写入新 runId，RUN_FINISHED/RUN_ERROR 后清空。
  const activeRunIdRef = useRef<string | null>(null);
  const perThreadLlmRef = useRef<Record<string, string | null>>({});
  const perThreadThinkingRef = useRef<Record<string, boolean>>({});
  // 「无 session 时」用户预先选择的模型，待 startNewSession 后转入 perThreadLlmRef[newId]。
  // undefined = 无 pending；null = 用户主动清空；string = 选定模型。
  const pendingLlmRef = useRef<string | null | undefined>(undefined);
  const pendingThinkingRef = useRef<boolean | undefined>(undefined);
  // pending 仅对「startNewSession 创建出来的新 id」生效；首次进入既有 session 不消费。
  // 由 startNewSessionWithLlmTarget 在拿到新 id 时写入，Effect 1 命中后清零。
  const pendingLlmTargetIdRef = useRef<string | null>(null);
  const pendingThinkingTargetIdRef = useRef<string | null>(null);
  const rawEventHandlerRef = useRef<((event: BaseEvent) => void) | undefined>(
    undefined,
  );
  const updateSessionTimeRef = useRef<
    ((currentSessionId: string) => void) | undefined
  >(undefined);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  // Session 切换守卫：+New 点击后同步置 true，阻止 sendInput 在 agent/sessionId
  // 同步 flush 前路由到旧 session。在 agent 重建后（useMemo 依赖 sessionId 变化）清除。
  const switchingSessionRef = useRef(false);

  const addLog = useCallback(
    (
      level: LogEntry["level"],
      message: string,
      payload?: Record<string, unknown>,
    ) => {
      setLogEntries((prev) => {
        const next = [
          ...prev,
          {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level,
            message,
            payload,
          },
        ];
        return next.slice(-200);
      });
    },
    [],
  );

  const reportMetric = useCallback(
    (name: string, payload: Record<string, unknown>) => {
      addLog("info", name, payload);
    },
    [addLog],
  );

  // 中断门：包装 setConnection，在 cancel 后 100ms 窗口内屏蔽 "error"，让 idle 立即生效。
  const setConnectionGuarded = useCallback(
    (next: ConnectionState) => {
      if (
        next === "error" &&
        userCancelledAtRef.current > 0 &&
        Date.now() - userCancelledAtRef.current < 100
      ) {
        // 用户主动中断引发的 error，转为 idle（视觉上无错误提示）。
        setConnection("idle");
        return;
      }
      setConnection(next);
    },
    [],
  );

  const { setConnectionWithMetrics } = useAgentSubscription({
    agent,
    sessionId,
    onRawEvent: (event) => rawEventHandlerRef.current?.(event),
    onConnectionChange: setConnectionGuarded,
    onMetricReport: reportMetric,
    onUpdateSessionTime: (currentSessionId) =>
      updateSessionTimeRef.current?.(currentSessionId),
  });

  const {
    rawEvents,
    snapshotForDisplay,
    conversationTree,
    nodeTimestampIndex,
    timelineItems,
    pendingConfirmations,
    latestRunState,
    appendRealtimeEvent,
    appendOptimisticMessage,
    clearSessionServiceState,
    loadSessionDetail,
    scheduleSessionHydration,
  } = useSessionService({
    sessionId,
    selectedNodeId,
    userId,
    appName: APP_NAME,
    addLog,
    setConnectionWithMetrics,
  });

  const resetActiveSessionView = useCallback(() => {
    clearSessionServiceState();
    setSelectedNodeId(null);
  }, [clearSessionServiceState]);

  // G2 对话搜索：传入 conversationTree 中所有扁平节点，支持 Cmd/Ctrl+F 搜索。
  const allNodes = useMemo(
    () => Array.from(conversationTree.nodeIndex.values()),
    [conversationTree.nodeIndex],
  );
  const search = useConversationSearch(allNodes);

  // 同步 conversationTree 到 ref，供 rawEventHandler 内 RUN_FINISHED 沉淀钩子读取
  // （rawEventHandler 是 ref-based 回调，不会跟随 conversationTree 重建，需要 ref 来读最新值）。
  const conversationTreeRef = useRef(conversationTree);
  useEffect(() => {
    conversationTreeRef.current = conversationTree;
  }, [conversationTree]);

  // G3 审批门：从 snapshot 读取 pending_approvals；用户决策写回 BFF。
  const pendingApprovals = useMemo(
    () => (snapshotForDisplay?.pending_approvals as Record<string, unknown> | undefined) ?? null,
    [snapshotForDisplay],
  );
  const { mode: approvalPolicyMode } = useApprovalPolicy();

  const handleApprovalRespond = useCallback(
    async (actionId: string, decision: ApprovalDecision, reason?: string) => {
      if (!sessionId || !userId) return;
      const res = await fetch(
        `/api/agui/sessions/${encodeURIComponent(sessionId)}/approval_response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_name: APP_NAME,
            user_id: userId,
            action_id: actionId,
            decision,
            reason: reason || null,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`审批响应发送失败: ${res.status}`);
      }
    },
    [sessionId, userId],
  );

  const {
    sessions,
    sessionListView,
    activeSession,
    setSessionListView,
    loadSessions,
    startNewSession,
    archiveSession,
    unarchiveSession,
    renameSession,
    scheduleTitleRefresh,
    updateCurrentSessionTime,
  } = useSessionListService({
    sessionId,
    userId,
    appName: APP_NAME,
    setSessionId,
    addLog,
    setConnectionWithMetrics,
    onClearActiveSession: resetActiveSessionView,
  });

  // 仅对「startNewSession 创建出来的新 id」消费 pending 模型选择；
  // 通过同一入口包装内联调用与 SessionList 的 onNewSession 回调，避免遗漏路径。
  const startNewSessionWithLlmTarget = useCallback(async () => {
    switchingSessionRef.current = true;
    const newId = await startNewSession();
    if (newId) {
      pendingLlmTargetIdRef.current = newId;
      pendingThinkingTargetIdRef.current = newId;
      // 若 guard 已将消息缓存到 pendingSendRef，回填 target 为新 session ID。
      // 不检查 !pendingForSessionRef——前一次 pending 未消费时旧 target 仍残留，
      // 需无条件覆盖为新 ID，否则 auto-send Effect 的 sessionId 匹配会失败。
      if (pendingSendRef.current) {
        pendingForSessionRef.current = newId;
      }
    }
    return newId;
  }, [startNewSession, pendingSendRef, pendingForSessionRef]);

  useEffect(() => {
    rawEventHandlerRef.current = (event) => {
      // 并发 runId 隔离：若当前有活跃 run，过滤不属于该 run 的事件。
      // 防止用户快速连发时旧 run 的残留事件混入新 turn → 双气泡/乱序。
      // 无 runId 的事件（如 STATE_SNAPSHOT）不过滤，它们不绑定特定 run。
      const activeRunId = activeRunIdRef.current;
      if (activeRunId) {
        const eventRunId =
          "runId" in event && typeof event.runId === "string"
            ? event.runId
            : undefined;
        if (eventRunId && eventRunId !== activeRunId) {
          if (event.type === EventType.RUN_STARTED) {
            // 后端返回的 runId 与前端生成的不一致时，采纳后端 runId。
            // E2E mock 的 runId 与前端 randomUUID() 不同；生产环境后端
            // 理应透传前端 runId，若不一致也以首个 RUN_STARTED 为准。
            activeRunIdRef.current = eventRunId;
          } else if (
            event.type === EventType.RUN_FINISHED ||
            event.type === EventType.RUN_ERROR
          ) {
            // 终态事件始终放行，确保 activeRunIdRef 清空 + hydration 触发，
            // 避免连接状态卡死导致后续 Send 按钮 disabled。
          } else {
            return;
          }
        }
      }

      appendRealtimeEvent(event);
      if (
        sessionId &&
        (event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR)
      ) {
        // run 终止后清空活跃 runId，允许后续 run 的事件通过。
        activeRunIdRef.current = null;
        scheduleSessionHydration(sessionId, {
          reason: "run_terminal",
          runId:
            "runId" in event && typeof event.runId === "string"
              ? event.runId
              : undefined,
        });

        // @ Corpus 输出沉淀 —— RUN_FINISHED 成功路径才触发；RUN_ERROR 仅清理 ref。
        const finishedRunId =
          "runId" in event && typeof event.runId === "string"
            ? event.runId
            : null;
        if (finishedRunId) {
          const outputIds = outputCorpusIdsByRunRef.current.get(finishedRunId);
          const userPrompt = userPromptByRunRef.current.get(finishedRunId);
          outputCorpusIdsByRunRef.current.delete(finishedRunId);
          userPromptByRunRef.current.delete(finishedRunId);
          if (
            event.type === EventType.RUN_FINISHED &&
            outputIds &&
            outputIds.length > 0
          ) {
            // 延迟读 conversationTree —— RUN_FINISHED 触发的最后一波 state
            // 经 useSessionService 异步合并；200ms 足以覆盖单 turn 的最终 flush。
            setTimeout(() => {
              const answerText = extractFinalAssistantText(
                conversationTreeRef.current,
                finishedRunId,
              );
              if (!answerText) {
                toast.warning("沉淀失败：未获取到本轮助手回答");
                return;
              }
              const sourceUri = `home:session/${sessionId}:run/${finishedRunId}`;
              const metadata = {
                source: "home_chat",
                session_id: sessionId,
                run_id: finishedRunId,
                generated_at: new Date().toISOString(),
                ...(userPrompt
                  ? { user_prompt_excerpt: userPrompt.slice(0, 200) }
                  : {}),
              };
              void Promise.allSettled(
                outputIds.map((corpusId) =>
                  ingestText(corpusId, {
                    app_name: APP_NAME,
                    text: answerText,
                    source_uri: sourceUri,
                    metadata,
                  }),
                ),
              ).then((results) => {
                const ok = results.filter((r) => r.status === "fulfilled").length;
                const fail = results.length - ok;
                if (ok > 0) {
                  toast.success(`已沉淀到 ${ok} 个语料库`);
                }
                if (fail > 0) {
                  toast.warning(`${fail} 个语料库沉淀失败`);
                }
              });
            }, 200);
          }
        }
      }
    };
    updateSessionTimeRef.current = updateCurrentSessionTime;
  }, [
    appendRealtimeEvent,
    scheduleSessionHydration,
    sessionId,
    updateCurrentSessionTime,
  ]);

  const effectiveConnection = useMemo(() => {
    const derived = deriveConnectionState(rawEvents);
    if (derived === "blocked" || derived === "error") {
      return derived;
    }
    if (connection === "connecting" || connection === "streaming") {
      return connection;
    }
    if (connection === "error") {
      return connection;
    }
    if (connection === "idle" && derived === "streaming") {
      return "idle";
    }
    return derived;
  }, [connection, rawEvents]);

  const clearSessionState = useCallback(() => {
    resetActiveSessionView();
  }, [resetActiveSessionView]);

  /**
   * 中断门 — 用户主动取消当前 run（C4）。
   *
   * 复用 NdjsonHttpAgent.abortRun()（已实现的 AbortController）：
   * - 客户端 fetch signal 被 abort，后端 FastAPI 收到 client disconnect 自然 cleanup；
   * - onRunFailed 回调随后被触发，但 setConnectionGuarded 在 100ms 内屏蔽 error，
   *   保证用户立即看到 idle，不弹错误提示。
   * - 不引入新协议事件（RUN_STOPPED）：最小干预原则，避免污染事件流。
   */
  const handleCancelRun = useCallback(() => {
    if (!agent) return;
    if (typeof agent.abortRun !== "function") {
      addLog("warn", "agent_cancel_unsupported");
      return;
    }
    userCancelledAtRef.current = Date.now();
    // 用户主动取消时清空活跃 runId，允许后续 run 立即开始。
    activeRunIdRef.current = null;
    try {
      agent.abortRun();
    } catch (error) {
      addLog("warn", "agent_cancel_failed", { message: String(error) });
    }
    // 立即同步标记 idle，避免按钮短暂回退到 streaming
    setConnectionWithMetrics("idle");
    addLog("info", "user_cancelled_run", { sessionId });
  }, [agent, addLog, sessionId, setConnectionWithMetrics]);

  const handleConfirmationFollowup = useCallback(
    async (payload: { action: string; note: string }) => {
      if (
        !agent ||
        !sessionId ||
        agent.isRunning ||
        effectiveConnection === "streaming" ||
        effectiveConnection === "connecting"
      ) {
        return;
      }
      const followupMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: `HITL:${payload.action} ${payload.note || ""}`.trim(),
      };
      agent.addMessage(followupMessage);
      try {
        setConnectionWithMetrics("connecting");
        await agent.runAgent({
          runId: randomUUID(),
        });
        scheduleSessionHydration(sessionId);
        await loadSessions();
      } catch (error) {
        setConnectionWithMetrics("error");
        addLog("error", "hitl_submit_failed", { message: String(error) });
        console.warn("Failed to submit HITL response", error);
      }
    },
    [
      agent,
      addLog,
      effectiveConnection,
      loadSessions,
      scheduleSessionHydration,
      sessionId,
      setConnectionWithMetrics,
    ],
  );

  // Escape key to return to live view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedNodeId) {
        setSelectedNodeId(null);
        setShowRightPanel(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId]);

  // G2 对话搜索：Cmd/Ctrl+F 拦截浏览器默认查找，打开搜索栏。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (!search.isOpen) {
          search.open();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.isOpen, search.open]);

  const doSend = useCallback(
    async (input: string) => {
      if (!agent || !sessionId || !input.trim()) {
        return;
      }
      if (
        pendingConfirmations > 0 ||
        effectiveConnection === "streaming" ||
        effectiveConnection === "connecting" ||
        effectiveConnection === "blocked"
      ) {
        return;
      }

      const runId = randomUUID();
      // 设置活跃 runId，过滤旧 run 的残留事件（并发隔离）。
      activeRunIdRef.current = runId;
      const messageId = crypto.randomUUID();
      const createdAt = new Date();
      const newMessage = {
        id: messageId,
        role: "user" as const,
        content: input.trim(),
        createdAt,
        runId,
        threadId: sessionId,
        streaming: false,
      };
      appendOptimisticMessage(newMessage);
      agent.addMessage(newMessage);
      setScrollToBottomTrigger((prev) => prev + 1);
      updateCurrentSessionTime(sessionId);
      const shouldPollTitle =
        !activeSession ||
        activeSession.label === createSessionLabel(sessionId);
      // C5 MVP — 附件以轻量 metadata 透传后端（仅文件名/类型/体积），
      // PDF 抓取场景目前走 paper.fetch(url)，不需要把整个 base64 灌入 stream。
      // 完整附件读取（read_attachment 工具）将在 V1 增强（参见 docs/framework.md §9 协议规范）。
      const attachmentMeta = attachments.map((a) => ({
        id: a.id,
        name: a.name,
        mime: a.mime,
        size: a.size,
      }));

      // @ Mention —— 从 mentions 派生本轮 turn 的偏好与 corpus 范围；
      // 仅非空字段透传 forwardedProps（BFF 会进一步做 UUID/类型校验）。
      const derivedMention = deriveForwardedPropsFromMentions(mentions, {
        agents: validAgentRefIds,
        corpora: validCorpusRefIds,
      });
      // snapshot output_corpus_ids，留待 RUN_FINISHED 时触发 ingest 沉淀。
      if (derivedMention.output_corpus_ids.length > 0) {
        outputCorpusIdsByRunRef.current.set(runId, derivedMention.output_corpus_ids);
        userPromptByRunRef.current.set(runId, input.trim());
      }
      try {
        setConnectionWithMetrics("connecting");
        // AbstractAgent.prepareRunAgentInput 从 runAgent 的参数读 forwardedProps，
        // 实例属性 ``agent.forwardedProps = ...`` 不会被读取——必须把字段透传到
        // ``runAgent({forwardedProps, runId})``。下面合并实例属性兜底以兼容历史调用方。
        //
        // 关键修复：``preferred_subagent`` / ``scoped_corpus_ids`` / ``output_corpus_ids``
        // 必须始终显式写入，让本轮派生值（可能为 ``null`` / ``[]``）覆盖实例属性上残留的
        // 上一轮值。BFF ``buildStateDeltaFromForwardedProps`` 据此把 ``null`` / ``[]``
        // 视作清空指令，避免 ADK ``session.state`` 中孤儿值被后端继续消费。
        const baseForwardedProps =
          (agent.forwardedProps as Record<string, unknown> | undefined) ?? {};
        const forwardedProps: Record<string, unknown> = {
          ...baseForwardedProps,
          approval_policy: { mode: approvalPolicyMode },
          selected_llm_model: selectedLlmModel ?? null,
          thinking_enabled: isThinkingSupportedForSelection(
            selectedLlmModel,
            llmModels,
          )
            ? thinkingEnabled
            : false,
          ...(attachmentMeta.length > 0 ? { attachments: attachmentMeta } : {}),
          // 三个 mention 字段无条件覆盖，确保跨 turn 不残留。
          preferred_subagent: derivedMention.preferred_subagent,
          scoped_corpus_ids: derivedMention.scoped_corpus_ids,
          output_corpus_ids: derivedMention.output_corpus_ids,
        };
        agent.forwardedProps = forwardedProps; // 留作 backward-compat（其他读 ref 的逻辑）
        // 清空 Composer 附件区 + Mention 区（与 inputValue 已被清空的语义一致）
        setAttachments([]);
        setMentions([]);
        await agent.runAgent({
          runId,
          forwardedProps,
        });
        scheduleSessionHydration(sessionId);
        await loadSessions();
        if (shouldPollTitle) {
          scheduleTitleRefresh();
        }
      } catch (error) {
        activeRunIdRef.current = null;
        setConnectionWithMetrics("error");
        addLog("error", "run_agent_failed", { message: String(error) });
        console.warn("Failed to run agent", error);
      }
    },
    [
      agent,
      sessionId,
      pendingConfirmations,
      effectiveConnection,
      appendOptimisticMessage,
      updateCurrentSessionTime,
      activeSession,
      setConnectionWithMetrics,
      scheduleSessionHydration,
      loadSessions,
      scheduleTitleRefresh,
      addLog,
      selectedLlmModel,
      thinkingEnabled,
      llmModels,
      attachments,
      approvalPolicyMode,
      mentions,
      validAgentRefIds,
      validCorpusRefIds,
    ],
  );

  const sendInput = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    // 静默拒绝场景的"可见反馈"：避免 ISSUE-064 复发——
    // Send 按钮看似 enabled、点击却 no-op。早返时给出 toast，
    // 让用户立刻知道为什么没反应（而不是默默吞掉点击）。
    if (pendingConfirmations > 0) {
      toast.info("请先回应当前的人工确认请求，再发送下一条指令");
      return;
    }
    if (
      effectiveConnection === "streaming" ||
      effectiveConnection === "connecting"
    ) {
      toast.info("Agent 正在响应中，请等待完成或点 Stop 中断");
      return;
    }
    if (effectiveConnection === "blocked") {
      toast.warning("Agent 通道当前被阻塞，请稍后重试");
      return;
    }

    // 无 Session 时自动创建（不需要 agent）
    if (!sessionId) {
      if (isCreatingSession) {
        return;
      }
      pendingSendRef.current = trimmed;
      setInputValue("");
      setScrollToBottomTrigger((prev) => prev + 1);
      setIsCreatingSession(true);
      try {
        const newId = await startNewSessionWithLlmTarget();
        if (newId) {
          pendingForSessionRef.current = newId;
        } else {
          setInputValue(pendingSendRef.current || "");
          pendingSendRef.current = null;
          pendingForSessionRef.current = null;
        }
      } finally {
        setIsCreatingSession(false);
      }
      return;
    }

    if (!agent || switchingSessionRef.current || (agent.threadId != null && agent.threadId !== sessionId)) {
      console.warn("[ISSUE-NEW] stale-agent guard", { switching: switchingSessionRef.current, agentThreadId: agent?.threadId ?? null, sessionId });
      // sessionId 已存在但 agent 尚未就绪（或 agent 实例 stale —
      // router.replace 异步 flush 导致 threadId !== 当前 sessionId）：
      // 把指令缓存到 pendingSendRef，待 agent 重建完毕由「自动重发 pending」
      // Effect 接力发送（与 !sessionId 路径同源）。同时给用户可见反馈，
      // 避免 silent no-op（ISSUE-064 根因）。
      //
      // 评审 #6：连续 Send 时若上一条尚未被自动重发 Effect 消费，新一条会覆盖
      // pendingSendRef。这是有意为之（用户更可能想让"最后一条"发出），但必须给
      // 区分性 toast，让用户知道前一条已被替换，避免再次出现 silent drop。
      const hadPending = pendingSendRef.current !== null;
      pendingSendRef.current = trimmed;
      // 切换中不设 target — 待 startNewSessionWithLlmTarget 拿到新 ID 后回填；
      // 非切换场景（agent 尚未就绪）直接用当前 sessionId。
      if (!switchingSessionRef.current) {
        pendingForSessionRef.current = sessionId;
      }
      setInputValue("");
      setScrollToBottomTrigger((prev) => prev + 1);
      if (hadPending) {
        toast.warning("Agent 仍在初始化，已用最新指令替换排队消息");
      } else {
        toast.info("Agent 正在初始化，已排队待发送...");
      }
      return;
    }
    setInputValue("");
    await doSend(trimmed);
  };

  // 新 Session 创建后、Agent 重建完毕，自动发送 pending 消息
  useEffect(() => {
    if (
      !pendingSendRef.current ||
      !pendingForSessionRef.current ||
      !agent ||
      !sessionId
    ) {
      return;
    }
    if (sessionId !== pendingForSessionRef.current) {
      return;
    }
    switchingSessionRef.current = false;
    const pending = pendingSendRef.current;
    pendingSendRef.current = null;
    pendingForSessionRef.current = null;
    void doSend(pending);
  }, [agent, sessionId, doSend, pendingSendRef, pendingForSessionRef]);

  // Session 切换完成后（sessionId 从 URL 同步更新）清除 switchingSessionRef。
  // 不能依赖 [agent]——旧 agent 在 render 间不变会导致过早清除。
  useEffect(() => {
    if (switchingSessionRef.current) {
      switchingSessionRef.current = false;
    }
  }, [sessionId]);

  /* Refactored: State clearing moved to handleSessionChange to avoid set-state-in-effect */
  const handleSessionChange = useCallback((newId: string | null) => {
    setSessionId(newId);
    clearSessionState();
  }, [clearSessionState, setSessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    void loadSessionDetail(sessionId);
  }, [sessionId, loadSessionDetail]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchModelConfigs({
          modelType: "llm",
          enabled: true,
        });
        if (!cancelled) {
          setLlmModels(items);
        }
      } catch (error) {
        if (!cancelled) {
          addLog("warn", "llm_options_fetch_failed", {
            message: String(error),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addLog]);

  useEffect(() => {
    if (!sessionId) {
      // 离开 session：保留 pending 选择，避免「无 session 选模型」的瞬时回退。
      setSelectedLlmModel(pendingLlmRef.current ?? null);
      return;
    }
    if (sessionId in perThreadLlmRef.current) {
      setSelectedLlmModel(perThreadLlmRef.current[sessionId] ?? null);
      // 进入已知 session：丢弃 pending，避免后续被错误消费。
      pendingLlmRef.current = undefined;
      pendingLlmTargetIdRef.current = null;
      return;
    }
    if (
      pendingLlmRef.current !== undefined &&
      pendingLlmTargetIdRef.current === sessionId
    ) {
      // startNewSession 创建的新 id：转移 pending，让 Effect 2 跳过 snapshot 覆盖。
      const carried = pendingLlmRef.current;
      perThreadLlmRef.current[sessionId] = carried;
      setSelectedLlmModel(carried ?? null);
      writePersistedLlmModel(sessionId, carried ?? null);
      pendingLlmRef.current = undefined;
      pendingLlmTargetIdRef.current = null;
      return;
    }
    // 首次进入既有 session：优先从 localStorage 还原（覆盖「选了模型但未 Send 即刷新」
    // 场景），未命中再让 Effect 2 用后端 snapshot 初始化。
    pendingLlmRef.current = undefined;
    pendingLlmTargetIdRef.current = null;
    const persisted = readPersistedLlmModel(sessionId);
    if (persisted) {
      perThreadLlmRef.current[sessionId] = persisted;
      setSelectedLlmModel(persisted);
    } else {
      setSelectedLlmModel(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setThinkingEnabled(pendingThinkingRef.current ?? false);
      return;
    }
    if (sessionId in perThreadThinkingRef.current) {
      setThinkingEnabled(perThreadThinkingRef.current[sessionId] ?? false);
      pendingThinkingRef.current = undefined;
      pendingThinkingTargetIdRef.current = null;
      return;
    }
    if (
      pendingThinkingRef.current !== undefined &&
      pendingThinkingTargetIdRef.current === sessionId
    ) {
      const carried = pendingThinkingRef.current;
      perThreadThinkingRef.current[sessionId] = carried;
      setThinkingEnabled(carried);
      writePersistedThinking(sessionId, carried);
      pendingThinkingRef.current = undefined;
      pendingThinkingTargetIdRef.current = null;
      return;
    }
    pendingThinkingRef.current = undefined;
    pendingThinkingTargetIdRef.current = null;
    const persisted = readPersistedThinking(sessionId);
    if (persisted !== null) {
      perThreadThinkingRef.current[sessionId] = persisted;
      setThinkingEnabled(persisted);
    } else {
      setThinkingEnabled(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    if (sessionId in perThreadLlmRef.current) {
      return;
    }
    const raw = snapshotForDisplay?.["selected_llm_model"];
    const initial = typeof raw === "string" && raw ? raw : null;
    perThreadLlmRef.current[sessionId] = initial;
    setSelectedLlmModel(initial);
    // 后端 snapshot 与 localStorage 互为镜像：snapshot 命中即把值同步回 localStorage，
    // 让后续刷新可直接走 Effect 1 的本地快路径。
    if (initial) {
      writePersistedLlmModel(sessionId, initial);
    }
  }, [sessionId, snapshotForDisplay]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    if (sessionId in perThreadThinkingRef.current) {
      return;
    }
    const raw = snapshotForDisplay?.["thinking_enabled"];
    const initial = raw === true;
    perThreadThinkingRef.current[sessionId] = initial;
    setThinkingEnabled(initial);
    writePersistedThinking(sessionId, initial);
  }, [sessionId, snapshotForDisplay]);

  const handleSelectedLlmModelChange = useCallback(
    (next: string | null) => {
      setSelectedLlmModel(next);
      if (sessionId) {
        perThreadLlmRef.current[sessionId] = next;
        pendingLlmRef.current = undefined;
        // 即时落盘到 localStorage，让刷新页面时（即便用户尚未 Send）也能复原选择。
        writePersistedLlmModel(sessionId, next);
      } else {
        // 用户在「无 session」状态下选模型：暂存到 pending，等 startNewSession 后由 Effect 1 转移。
        pendingLlmRef.current = next;
      }
    },
    [sessionId],
  );

  const handleThinkingEnabledChange = useCallback(
    (next: boolean) => {
      setThinkingEnabled(next);
      if (sessionId) {
        perThreadThinkingRef.current[sessionId] = next;
        pendingThinkingRef.current = undefined;
        writePersistedThinking(sessionId, next);
      } else {
        pendingThinkingRef.current = next;
      }
    },
    [sessionId],
  );

  const thinkingSupported = useMemo(
    () => isThinkingSupportedForSelection(selectedLlmModel, llmModels),
    [llmModels, selectedLlmModel],
  );

  /**
   * Tool Progress 旁路提取（C3）— 从 snapshotForDisplay.tool_progress 提取 toolCallId → progress 映射，
   * 不进入 conversationTree / message-ledger，规避 ISSUE-031 时间窗双气泡风险。
   *
   * 后端 ADK 通过 state_delta 推送：state.tool_progress[tool_call_id] = { percent, eta?, stage? }
   * 前端 useSessionService → snapshotForDisplay 自动同步该字段（无需新协议事件）。
   */
  const toolProgressMap: ToolProgressMap = useMemo(() => {
    const raw = snapshotForDisplay?.["tool_progress"];
    if (!raw || typeof raw !== "object") return {};
    const out: ToolProgressMap = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const node = v as Record<string, unknown>;
      const percent = Number(node.percent);
      if (!Number.isFinite(percent)) continue;
      const snap: ToolProgressSnapshot = { percent };
      if (typeof node.eta === "number" && Number.isFinite(node.eta)) {
        snap.eta = node.eta;
      }
      if (typeof node.stage === "string" && node.stage.length > 0) {
        snap.stage = node.stage;
      }
      out[k] = snap;
    }
    return out;
  }, [snapshotForDisplay]);

  // Filter log entries based on selected message timestamp
  const filteredLogEntries = useMemo(() => {
    if (!selectedNodeId) {
      return logEntries;
    }

    const cutoffTimestamp = nodeTimestampIndex.get(selectedNodeId);
    if (cutoffTimestamp === undefined) {
      return logEntries;
    }

    const cutoffMs = cutoffTimestamp * 1000;

    return logEntries.filter((entry) => entry.timestamp <= cutoffMs);
  }, [logEntries, nodeTimestampIndex, selectedNodeId]);

  return (
    <div className="h-full flex flex-col bg-zinc-50 text-zinc-900 overflow-hidden dark:bg-zinc-950 dark:text-zinc-100">
      {agent && (
        <ConfirmationToolRegistrar onFollowup={handleConfirmationFollowup} />
      )}
      <div className="flex h-full overflow-hidden relative">
        {/* Left Sidebar: Session List */}
        <div
          className={`shrink-0 h-full border-r border-zinc-200 bg-white transition-all duration-300 ease-in-out overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 ${
            showLeftPanel
              ? "w-64 translate-x-0 opacity-100"
              : "w-0 -translate-x-10 opacity-0"
          }`}
        >
          <div className="w-64 h-full overflow-hidden flex flex-col">
            <SessionList
              sessions={sessions}
              activeId={sessionId}
              view={sessionListView}
              onSwitchView={setSessionListView}
              onSelect={handleSessionChange}
              onNewSession={startNewSessionWithLlmTarget}
              onRename={renameSession}
              onArchive={archiveSession}
              onUnarchive={unarchiveSession}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-zinc-50 relative overflow-hidden transition-all duration-300 dark:bg-zinc-950">
          {/* Internal Toolbar for Toggles */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-zinc-200/50 bg-white/50 backdrop-blur-sm z-10 w-full dark:border-zinc-700/50 dark:bg-zinc-900/50">
            <button
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-700/80"
              title={showLeftPanel ? "Close Sidebar" : "Open Sidebar"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                />
                {/* Replaced with a simple Sidebar Icon */}
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>

            <div className="text-xs font-medium text-zinc-400 max-w-md truncate mx-4 dark:text-zinc-500">
              {activeSession
                ? `${activeSession.label}${latestRunState?.status === "blocked" ? " · 等待确认" : ""}`
                : "Negentropy"}
            </div>

            {/* G2 对话搜索栏 */}
            {search.isOpen && (
              <ConversationSearchBar
                query={search.query}
                onQueryChange={search.setQuery}
                matchCount={search.matchCount}
                currentIndex={search.currentIndex}
                onNavigateNext={search.navigateNext}
                onNavigatePrev={search.navigatePrev}
                onClose={search.close}
              />
            )}

            {/* G3 审批策略选择器 */}
            <ApprovalPolicySelector className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" />

            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="group p-1.5 rounded-md hover:bg-zinc-200/80 text-zinc-500 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-700/80"
              title={showRightPanel ? "Close Panel" : "Open Panel"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
          </div>

          {/* Chat Stream Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            <ChatStream
              nodes={conversationTree.roots}
              selectedNodeId={selectedNodeId}
              onNodeSelect={(id) => {
                if (!showRightPanel) {
                  return;
                }
                if (selectedNodeId === id) {
                  setSelectedNodeId(null);
                } else {
                  setSelectedNodeId(id);
                }
              }}
              scrollToBottomTrigger={scrollToBottomTrigger}
              toolProgressMap={toolProgressMap}
              pending={
                effectiveConnection === "connecting" ||
                effectiveConnection === "streaming"
              }
              highlightedNodeIds={search.matchingNodeIds}
              scrollToNodeId={search.currentMatchNodeId}
            />
            <div
              className={`${CHAT_CONTENT_RAIL_CLASS} shrink-0 w-full pt-2 pb-6`}
            >
              <Composer
                value={inputValue}
                onChange={setInputValue}
                onSend={sendInput}
                isGenerating={
                  effectiveConnection === "streaming" ||
                  effectiveConnection === "connecting"
                }
                isBlocked={effectiveConnection === "blocked"}
                disabled={
                  isCreatingSession ||
                  effectiveConnection === "blocked" ||
                  pendingConfirmations > 0
                }
                models={llmModels}
                selectedLlmModel={selectedLlmModel}
                onSelectedLlmModelChange={handleSelectedLlmModelChange}
                thinkingEnabled={thinkingSupported && thinkingEnabled}
                thinkingSupported={thinkingSupported}
                onThinkingEnabledChange={handleThinkingEnabledChange}
                onCancel={handleCancelRun}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                mentions={mentions}
                onMentionsChange={setMentions}
                agentCandidates={agentCandidates}
                corpusCandidates={corpusCandidates}
                agentsLoading={subagentsLoading}
                agentsError={subagentsError}
                corporaLoading={corporaLoading}
                corporaError={corporaError}
              />
            </div>
          </div>
        </main>

        {/* Right Sidebar: Timeline & Logs */}
        <div
          className={`shrink-0 h-full border-l border-zinc-200 bg-white transition-all duration-300 ease-in-out overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 ${
            showRightPanel
              ? "w-80 translate-x-0 opacity-100"
              : "w-0 translate-x-10 opacity-0"
          }`}
        >
          <div className="w-80 h-full overflow-y-auto p-6">
            {/* View mode indicator + minimal interaction hint */}
            {selectedNodeId ? (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:border-amber-800 dark:bg-amber-950/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    历史视图
                  </span>
                  <button
                    onClick={() => {
                      setSelectedNodeId(null);
                    }}
                    className="text-xs text-amber-600 hover:text-amber-800 underline dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    返回实时
                  </button>
                </div>
                <p className="text-[10px] text-amber-700 mt-1 dark:text-amber-300">
                  显示选定消息的观察数据
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    实时视图
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 dark:text-zinc-400">
                  点击任意消息进入历史视图，再次点击或点“返回实时”回到实时
                </p>
              </div>
            )}

            <StateSnapshot
              snapshot={snapshotForDisplay}
              connection={selectedNodeId ? "idle" : effectiveConnection}
            />
            <EventTimeline events={timelineItems} />
            <LogBufferPanel
              entries={filteredLogEntries}
              onExport={() => {
                const payload = JSON.stringify(filteredLogEntries, null, 2);
                void navigator.clipboard?.writeText(payload);
              }}
            />
          </div>
        </div>
      </div>

      {/* G3 审批门：pending_approvals → modal → approval_responses 闭环 */}
      <ApprovalDialog
        pending={pendingApprovals as Record<string, import("@/components/ui/ApprovalDialog").ApprovalRequestPayload> | null | undefined}
        onRespond={handleApprovalRespond}
      />
    </div>
  );
}
