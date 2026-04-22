import { NextRequest } from "next/server";

import { POST } from "@/app/api/knowledge/catalog/route";

describe("POST /api/knowledge/catalog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.KNOWLEDGE_BASE_URL;
    delete process.env.AGUI_BASE_URL;
    delete process.env.NEXT_PUBLIC_AGUI_BASE_URL;
  });

  it("应转发至后端含 /knowledge 前缀的上游路径，并保留 corpus_id query", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "11111111-1111-1111-1111-111111111111",
          corpus_id: "22222222-2222-2222-2222-222222222222",
          name: "Root",
          parent_id: null,
        }),
    } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/knowledge/catalog?corpus_id=22222222-2222-2222-2222-222222222222",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Root" }),
      },
    );

    const response = await POST(request);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = (fetchSpy.mock.calls[0]?.[0] as URL).toString();
    expect(calledUrl).toBe(
      "http://localhost:3292/knowledge/catalog/nodes?corpus_id=22222222-2222-2222-2222-222222222222",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      cache: "no-store",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Root",
    });
  });

  it("上游 404 时应透传错误 body 与状态码（即：回归 /catalog/nodes 漏前缀的历史错配）", async () => {
    process.env.KNOWLEDGE_BASE_URL = "http://backend.local";
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ detail: "Not Found" }),
    } as Response);

    const request = new NextRequest(
      "http://localhost:3000/api/knowledge/catalog?corpus_id=33333333-3333-3333-3333-333333333333",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: "Not Found" });
  });
});
