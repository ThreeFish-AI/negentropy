/**
 * 结构化日志系统
 *
 * 提供统一的日志记录接口，支持：
 * - 多级别日志（debug, info, warn, error）
 * - 日志缓冲（最多保留 500 条）
 * - 上下文信息记录
 * - 开发环境控制台输出
 *
 * 生产环境可扩展集成远程日志服务
 */

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
};

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    if (process.env.NODE_ENV === "development") {
      console[level](`[${level.toUpperCase()}]`, message, context);
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log("error", message, context);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();

/**
 * 上报指标/事件
 *
 * 当前实现：记录到本地日志
 * 生产环境：可扩展发送到分析服务（如 Google Analytics、DataDog 等）
 */
export function reportMetric(name: string, payload: Record<string, unknown>) {
  logger.info(name, payload);
  // TODO: 生产环境可集成分析服务
  // if (process.env.NODE_ENV === "production") {
  //   await fetch("/api/metrics", {
  //     method: "POST",
  //     body: JSON.stringify({ name, payload, timestamp: Date.now() }),
  //   });
  // }
}
