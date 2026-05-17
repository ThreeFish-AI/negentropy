import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHeartbeatPoll } from "@/hooks/useHeartbeatPoll";

describe("useHeartbeatPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom 默认 visibilityState=visible
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("默认 fireImmediately=true，挂载后立即跑一次再按节拍", () => {
    const cb = vi.fn();
    renderHook(() => useHeartbeatPoll(cb, { intervalMs: 5000 }));
    expect(cb).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("enabled=false 不挂任何 timer，不调用 callback", () => {
    const cb = vi.fn();
    renderHook(() => useHeartbeatPoll(cb, { enabled: false }));
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("fireImmediately=false 时不立即触发，仅按节拍", () => {
    const cb = vi.fn();
    renderHook(() => useHeartbeatPoll(cb, { intervalMs: 1000, fireImmediately: false }));
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("callback 抛出错误时节拍不会中断", () => {
    const cb = vi.fn(() => {
      throw new Error("boom");
    });
    renderHook(() => useHeartbeatPoll(cb, { intervalMs: 1000 }));
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(cb).toHaveBeenCalledTimes(4);
  });

  it("unmount 后停止触发", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useHeartbeatPoll(cb, { intervalMs: 1000 }));
    expect(cb).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
