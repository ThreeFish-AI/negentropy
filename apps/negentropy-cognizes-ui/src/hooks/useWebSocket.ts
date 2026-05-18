import { useTaskStore, useUIStore } from "@/store";
import type {
  TaskLogMessage,
  TaskProgressMessage,
  TaskUpdateMessage,
  WebSocketMessage,
} from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export const useWebSocket = (
  url: string,
  options: UseWebSocketOptions = {},
) => {
  const {
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [urlState, setUrlState] = useState(url);

  const { handleTaskUpdate } = useTaskStore();
  const { addNotification } = useUIStore();

  // 清理定时器
  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // 开始心跳
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }),
        );
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  // 停止心跳
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // 处理 WebSocket 消息
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log("[WebSocket] Received:", message);

        // 处理心跳响应
        if (message.type === "pong") {
          return;
        }

        // 处理任务更新
        if (
          message.type === "task_update" ||
          message.type === "task_progress" ||
          message.type === "task_log"
        ) {
          handleTaskUpdate(
            message as TaskUpdateMessage | TaskProgressMessage | TaskLogMessage,
          );
        }

        // 处理系统通知
        if (message.type === "system_notification") {
          addNotification({
            type: "info",
            title: "系统通知",
            message: message.data?.message || "收到系统通知",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    },
    [handleTaskUpdate, addNotification],
  );

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      console.log("[WebSocket] Connecting to:", urlState);
      const ws = new WebSocket(urlState);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        setIsConnected(false);
        stopHeartbeat();
        clearTimers();

        // 如果不是主动关闭，尝试重连
        if (
          event.code !== 1000 &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          console.log(
            `[WebSocket] Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`,
          );

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError("达到最大重连次数，连接失败");
          addNotification({
            type: "error",
            title: "连接失败",
            message: "WebSocket 连接失败，请刷新页面重试",
            duration: 10000,
          });
        }
      };

      ws.onerror = (event) => {
        console.error("[WebSocket] Error:", event);
        setConnectionError("连接错误");
      };
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
      setConnectionError("无法创建连接");
    }
  }, [
    urlState,
    handleMessage,
    startHeartbeat,
    stopHeartbeat,
    clearTimers,
    maxReconnectAttempts,
    reconnectInterval,
    addNotification,
  ]);

  // 断开连接
  const disconnect = useCallback(() => {
    clearTimers();
    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [clearTimers, stopHeartbeat]);

  // 发送消息
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const messageToSend = {
        ...message,
        timestamp: new Date().toISOString(),
      };
      wsRef.current.send(JSON.stringify(messageToSend));
      return true;
    } else {
      console.warn("[WebSocket] Cannot send message, connection not open");
      return false;
    }
  }, []);

  // 订阅任务更新
  const subscribeToTask = useCallback(
    (taskId: string) => {
      return sendMessage({
        type: "subscribe",
        taskId,
      });
    },
    [sendMessage],
  );

  // 取消订阅任务更新
  const unsubscribeFromTask = useCallback(
    (taskId: string) => {
      return sendMessage({
        type: "unsubscribe",
        taskId,
      });
    },
    [sendMessage],
  );

  // 重连
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // 初始化连接
  useEffect(() => {
    if (autoConnect && urlState) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, urlState, connect, disconnect]);

  // URL 变更时重连
  useEffect(() => {
    if (url !== urlState) {
      setUrlState(url);
      if (isConnected) {
        disconnect();
      }
    }
  }, [url, urlState, isConnected, disconnect]);

  return {
    isConnected,
    connectionError,
    reconnectAttempts: reconnectAttemptsRef.current,
    connect,
    disconnect,
    reconnect,
    sendMessage,
    subscribeToTask,
    unsubscribeFromTask,
  };
};

// 管理任务订阅的 hook
export const useTaskSubscription = (taskIds: string[] | null) => {
  const { subscribeToTask, unsubscribeFromTask, isConnected } = useWebSocket(
    process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws",
    { autoConnect: true },
  );

  const subscribedTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isConnected || !taskIds) {
      return;
    }

    // 订阅新任务
    taskIds.forEach((taskId) => {
      if (!subscribedTasksRef.current.has(taskId)) {
        subscribeToTask(taskId);
        subscribedTasksRef.current.add(taskId);
      }
    });

    // 取消订阅不再需要的任务
    subscribedTasksRef.current.forEach((taskId) => {
      if (!taskIds.includes(taskId)) {
        unsubscribeFromTask(taskId);
        subscribedTasksRef.current.delete(taskId);
      }
    });
  }, [taskIds, isConnected, subscribeToTask, unsubscribeFromTask]);

  useEffect(() => {
    const currentSubscribedTasks = subscribedTasksRef.current;

    // 清理所有订阅
    return () => {
      currentSubscribedTasks.forEach((taskId) => {
        unsubscribeFromTask(taskId);
      });
      currentSubscribedTasks.clear();
    };
  }, [unsubscribeFromTask]);
};

// 监听活动任务的 hook
export const useActiveTasksMonitor = () => {
  const { activeTasks } = useTaskStore();
  const activeTaskIds = activeTasks.map((task) => task.id);

  useTaskSubscription(activeTaskIds.length > 0 ? activeTaskIds : null);
};

export default useWebSocket;
