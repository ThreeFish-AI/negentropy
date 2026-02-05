"use client";

import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 结构化日志 - 可扩展集成监控服务
    console.error("[ErrorBoundary]", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error!}
          retry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 border border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">遇到错误</h2>
        </div>
        <p className="text-sm text-zinc-600 mb-4">
          应用程序遇到了意外错误。您可以尝试刷新页面或联系支持。
        </p>
        {process.env.NODE_ENV === "development" && (
          <details className="mb-4">
            <summary className="text-xs font-medium text-zinc-700 cursor-pointer mb-2">
              错误详情（开发模式）
            </summary>
            <pre className="text-[10px] bg-zinc-100 p-2 rounded overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <button onClick={retry} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            重试
          </button>
          <button onClick={() => window.location.reload()} className="flex-1 px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-300 transition-colors">
            刷新页面
          </button>
        </div>
      </div>
    </div>
  );
}
