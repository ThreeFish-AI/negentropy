import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  runMemoryAutomationJob,
  triggerMemoryAutomationJobAction,
} from "@/features/memory";

describe("memory automation api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("任务动作请求会发送空 JSON body 以兼容代理层", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ jobs: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await triggerMemoryAutomationJobAction("cleanup_memories", "reconcile", "negentropy");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/memory/automation/jobs/cleanup_memories/reconcile?app_name=negentropy",
      expect.objectContaining({
        method: "POST",
        body: "{}",
      }),
    );
  });

  it("手动触发任务请求会发送空 JSON body", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ job_key: "cleanup_memories", snapshot: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await runMemoryAutomationJob("cleanup_memories", "negentropy");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/memory/automation/jobs/cleanup_memories/run?app_name=negentropy",
      expect.objectContaining({
        method: "POST",
        body: "{}",
      }),
    );
  });
});
