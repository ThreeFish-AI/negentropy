/* eslint-disable react-hooks/immutability --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, PanelRight } from "lucide-react";

import { randomUUID } from "@ag-ui/client";
import { EventType, Message, type BaseEvent } from "@ag-ui/core";

import { ChatStream } from "../components/ui/ChatStream";
import { Composer } from "../components/ui/Composer";
import type { ComposerAttachment } from "../components/ui/AttachmentChip";
import type { MentionCandidate, MentionToken } from "@negentropy/agents-chat-core/parse";
import { deriveForwardedPropsFromMentions } from "@negentropy/agents-chat-core/parse";
import { useAgentsList } from "@/hooks/useAgentsList";
import { useCorporaList } from "@/app/knowledge/apis/_components/hooks/useCorporaList";
import { SessionList } from "../components/ui/SessionList";
import { StateDrawer } from "../components/ui/StateDrawer";
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

// 默认主 Agent LLM — 与后端 model_resolver._DEFAULT_LLM_MODEL 对齐。
// 下拉移除「Default」占位项后，无明确选择时一律回退至此模型而非 null。
const DEFAULT_LLM_MODEL = "openai/gpt-5-nano";

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

/**
 * 右栏 State 抽屉开合状态的本地持久化键（按 sessionId 命名空间隔离）。
 *
 * 与 LLM/Thinking 不同，抽屉开合纯属浏览器侧布局偏好，不与后端 session.state 镜像，
 * 故仅需「切会话时读取 + 状态变化时写回」两个 Effect，无需 pending/per-thread/snapshot 链路。
 */
const LOCAL_RIGHT_PANEL_KEY_PREFIX = "negentropy:home:right-panel:";

function readPersistedRightPanel(sessionId: string | null): boolean | null {
  if (!sessionId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${LOCAL_RIGHT_PANEL_KEY_PREFIX}${sessionId}`,
    );
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writePersistedRightPanel(
  sessionId: string | null,
  value: boolean,
): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LOCAL_RIGHT_PANEL_KEY_PREFIX}${sessionId}`,
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
  // Home Composer 的 @ Mention（agent / corpus）。
  // 与 inputValue 平行存在，仅承担 ① UI 高亮 ② forwardedProps 派生。
  const [mentions, setMentions] = useState<MentionToken[]>([]);
  // @ 弹层候选项数据源
  const { agents, loading: agentsLoading, error: agentsError } =
    useAgentsList();
  const { corpora, loading: corporaLoading, error: corporaError } = useCorporaList();
  const agentCandidates = useMemo<MentionCandidate[]>(
    () => {
      const mapped = agents.map((a) => ({
        kind: "agent" as const,
        refId: a.name,
        label: a.display_name || a.name,
        description: a.description || undefined,
      }));
      const hasBuiltinClaudeCode = agents.some((a) => a.name === "claude_code");
      if (!hasBuiltinClaudeCode) {
        mapped.push({
          kind: "agent" as const,
          refId: "claude_code",
          label: "Claude Code",
          description:
            "提示 ADK Agent 使用 Claude Code 工具来完成代码分析、修改、测试等复杂任务",
        });
      }
      return mapped;
    },
    [agents],
  );
  const corpusCandidates = useMemo<MentionCandidate[]>(
    () =>
      corpora.map((c) => ({
        kind: "corpus" as const,
        refId: c.id,
        label: c.name,
        description: c.description || undefined,
      })),
    [corpora],
  );
  const validAgentRefIds = useMemo(
    () => new Set([...agents.map((a) => a.name), "claude_code"]),
    [agents],
  );
  const validCorpusRefIds = useMemo(
    () => new Set(corpora.map((c) => c.id)),
    [corpora],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0);
  const [llmModels, setLlmModels] = useState<ModelConfigItem[]>([]);
  const [selectedLlmModel, setSelectedLlmModel] = useState<string | null>(
    DEFAULT_LLM_MODEL,
  );
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
    deleteSession,
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

        // @ Corpus 仅作为 KB+KG retrieve 范围（HybridPlanner 自主决策图扩展），
        // 默认不主动沉淀；Ingest 走独立入口或后续 IntentClassifier，详见
        // docs/.agents/issue.md「Composer @ 唤出框单一对象化」。
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

  // Escape 分层：① 历史视图下先返回实时（抽屉不关）；② 否则关闭抽屉。
  // 对齐嵌套可关闭 UI 的逐层退出直觉（参考 OverlayDismissLayer 的 escape 栈语义）。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedNodeId) {
        setSelectedNodeId(null);
      } else if (showRightPanel) {
        setShowRightPanel(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, showRightPanel]);

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

  // 面板开合快捷键：⌘/Ctrl+B 左栏（会话）、⌘/Ctrl+J 右栏（State）。
  // 对齐 VS Code「侧栏开合」直觉；preventDefault 抑制浏览器默认行为（如 Cmd+J 下载）。
  // 快捷键如需调整，改此处 key 即可。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        setShowLeftPanel((v) => !v);
      } else if (key === "j") {
        e.preventDefault();
        setShowRightPanel((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 右栏抽屉开合按 session 记忆：切会话时按记录恢复（无记录默认收起）。
  // 与既有 thinking/llm seeding 效应同源——切换会话时按本地偏好同步一次 UI 状态，
  // 单次切换仅触发一次额外渲染，可接受；故就地豁免 set-state-in-effect。
  useEffect(() => {
    if (!sessionId) return;
    const persisted = readPersistedRightPanel(sessionId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowRightPanel(persisted ?? false);
  }, [sessionId]);

  // 状态变化时写回当前 session 的记录（toggle / X / ESC / 快捷键统一经此落盘）。
  useEffect(() => {
    if (!sessionId) return;
    writePersistedRightPanel(sessionId, showRightPanel);
  }, [sessionId, showRightPanel]);

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
      // 完整附件读取（read_attachment 工具）将在 V1 增强（参见 docs/architecture/framework.md §9 协议规范）。
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
      try {
        setConnectionWithMetrics("connecting");
        // AbstractAgent.prepareRunAgentInput 从 runAgent 的参数读 forwardedProps，
        // 实例属性 ``agent.forwardedProps = ...`` 不会被读取——必须把字段透传到
        // ``runAgent({forwardedProps, runId})``。下面合并实例属性兜底以兼容历史调用方。
        //
        // 关键修复：``preferred_agent`` / ``corpus_ids`` 必须始终显式写入，
        // 让本轮派生值（可能为 ``null`` / ``[]``）覆盖实例属性上残留的上一轮值。
        // BFF ``buildStateDeltaFromForwardedProps`` 据此把 ``null`` / ``[]`` 视作
        // 清空指令，避免 ADK ``session.state`` 中孤儿值被后端继续消费。
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
          // mention 字段无条件覆盖，确保跨 turn 不残留。
          preferred_agent: derivedMention.preferred_agent,
          corpus_ids: derivedMention.corpus_ids,
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
      // 离开 session：保留 pending 选择，避免「无 session 选模型」的瞬时回退；
      // 无 pending 时回退默认模型（移除 Default 占位后不再出现 null）。
      setSelectedLlmModel(pendingLlmRef.current ?? DEFAULT_LLM_MODEL);
      return;
    }
    if (sessionId in perThreadLlmRef.current) {
      setSelectedLlmModel(
        perThreadLlmRef.current[sessionId] ?? DEFAULT_LLM_MODEL,
      );
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
      // 归一化为非空值（移除 Default 占位后 selectedLlmModel 运行时不再出现 null）。
      const carried = pendingLlmRef.current ?? DEFAULT_LLM_MODEL;
      perThreadLlmRef.current[sessionId] = carried;
      setSelectedLlmModel(carried);
      writePersistedLlmModel(sessionId, carried);
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
      // 无 persisted：回退默认模型，让 Effect 2 的后端 snapshot 仍可覆盖。
      setSelectedLlmModel(DEFAULT_LLM_MODEL);
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
    // 后端 snapshot 未命中时回退默认模型（移除 Default 占位后不再出现 null）。
    const initial = typeof raw === "string" && raw ? raw : DEFAULT_LLM_MODEL;
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
    <div className="h-full flex flex-col bg-background text-text-primary overflow-hidden">
      {agent && (
        <ConfirmationToolRegistrar onFollowup={handleConfirmationFollowup} />
      )}
      <div className="flex h-full overflow-hidden relative">
        {/* Left Sidebar: Session List */}
        <div
          className={`shrink-0 h-full border-r border-border bg-card transition-all duration-300 ease-in-out overflow-hidden ${
            showLeftPanel
              ? "w-56 translate-x-0 opacity-100"
              : "w-0 -translate-x-10 opacity-0"
          }`}
        >
          <div className="w-56 h-full overflow-hidden flex flex-col">
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
              onDelete={deleteSession}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full min-w-0 bg-background relative overflow-hidden transition-all duration-300">
          {/* Internal Toolbar：三区布局（左 toggle / 中 标题·搜索 / 右 策略·toggle） */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-card/60 backdrop-blur-sm z-10 w-full">
            {/* 左区：会话栏开合 */}
            <button
              type="button"
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              className={`shrink-0 p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                showLeftPanel
                  ? "bg-border-muted/70 text-text-primary"
                  : "text-text-muted hover:bg-border-muted hover:text-text-primary"
              }`}
              aria-label={showLeftPanel ? "收起会话栏 (⌘/Ctrl+B)" : "展开会话栏 (⌘/Ctrl+B)"}
              aria-pressed={showLeftPanel}
              title={showLeftPanel ? "收起会话栏 (⌘/Ctrl+B)" : "展开会话栏 (⌘/Ctrl+B)"}
            >
              <PanelLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* 中区：标题 / 对话搜索（二选一，搜索打开时占据中区） */}
            <div className="flex min-w-0 flex-1 items-center justify-center px-2">
              {search.isOpen ? (
                <ConversationSearchBar
                  query={search.query}
                  onQueryChange={search.setQuery}
                  matchCount={search.matchCount}
                  currentIndex={search.currentIndex}
                  onNavigateNext={search.navigateNext}
                  onNavigatePrev={search.navigatePrev}
                  onClose={search.close}
                />
              ) : (
                <div className="max-w-md truncate text-center text-[13px] font-semibold text-text-primary">
                  {activeSession
                    ? `${activeSession.label}${latestRunState?.status === "blocked" ? " · 等待确认" : ""}`
                    : "Negentropy"}
                </div>
              )}
            </div>

            {/* 右区：审批策略 + State 栏开合 */}
            <div className="flex shrink-0 items-center gap-2">
              <ApprovalPolicySelector className="inline-flex items-center gap-1 text-caption text-text-muted" />
              <button
                type="button"
                onClick={() => setShowRightPanel(!showRightPanel)}
                className={`p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  showRightPanel
                    ? "bg-border-muted/70 text-text-primary"
                    : "text-text-muted hover:bg-border-muted hover:text-text-primary"
                }`}
                aria-label={showRightPanel ? "收起 State 栏 (⌘/Ctrl+J)" : "展开 State 栏 (⌘/Ctrl+J)"}
                aria-pressed={showRightPanel}
                title={showRightPanel ? "收起 State 栏 (⌘/Ctrl+J)" : "展开 State 栏 (⌘/Ctrl+J)"}
              >
                <PanelRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
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
                agentsLoading={agentsLoading}
                agentsError={agentsError}
                corporaLoading={corporaLoading}
                corporaError={corporaError}
              />
            </div>
          </div>
        </main>
      </div>

      {/* 右栏 State 观测：非模态浮层抽屉，悬浮于对话之上、不挤占中栏。
          中栏对话仍可点击 → 保留「点消息看历史」；开合由 showRightPanel 驱动。 */}
      <StateDrawer
        open={showRightPanel}
        onClose={() => setShowRightPanel(false)}
        selectedNodeId={selectedNodeId}
        onReturnToLive={() => setSelectedNodeId(null)}
        snapshot={snapshotForDisplay}
        connection={selectedNodeId ? "idle" : effectiveConnection}
        timelineItems={timelineItems}
        logEntries={filteredLogEntries}
        onExportLogs={() => {
          const payload = JSON.stringify(filteredLogEntries, null, 2);
          void navigator.clipboard?.writeText(payload);
        }}
      />

      {/* G3 审批门：pending_approvals → modal → approval_responses 闭环 */}
      <ApprovalDialog
        pending={pendingApprovals as Record<string, import("@/components/ui/ApprovalDialog").ApprovalRequestPayload> | null | undefined}
        onRespond={handleApprovalRespond}
      />
    </div>
  );
}
