import { NextRequest } from "next/server";

import { GET } from "@/app/api/knowledge/stats/route";

describe("GET /api/knowledge/stats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.KNOWLEDGE_BASE_URL;
    delete process.env.AGUI_BASE_URL;
    delete process.env.NEXT_PUBLIC_AGUI_BASE_URL;
  });

  it("未配置后端地址时返回全零统计", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/knowledge/stats"));

    expect(await response.json()).toEqual({
      total_calls: 0,
      success_count: 0,
      failed_count: 0,
      avg_latency_ms: 0,
    });
  });

  it("会透传 endpoint 参数到后端", async () => {
    process.env.KNOWLEDGE_BASE_URL = "http://backend.local";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ total_calls: 3, success_count: 2, failed_count: 1, avg_latency_ms: 42 }),
    } as Response);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/knowledge/stats?endpoint=search"),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://backend.local/knowledge/stats?endpoint=search",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(await response.json()).toEqual({
      total_calls: 3,
      success_count: 2,
      failed_count: 1,
      avg_latency_ms: 42,
    });
  });

  it("后端失败时降级返回全零统计", async () => {
    process.env.KNOWLEDGE_BASE_URL = "http://backend.local";
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new NextRequest("http://localhost:3000/api/knowledge/stats"));

    expect(await response.json()).toEqual({
      total_calls: 0,
      success_count: 0,
      failed_count: 0,
      avg_latency_ms: 0,
    });
    errorSpy.mockRestore();
  });
});
