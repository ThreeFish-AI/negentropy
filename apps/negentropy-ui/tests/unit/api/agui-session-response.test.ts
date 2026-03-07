import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";

const sessionAckSchema = z.object({
  status: z.literal("ok"),
  archived: z.boolean(),
});

describe("parseSessionUpstreamJson", () => {
  it("当上游非 ok 时应返回结构化错误响应", async () => {
    const result = await parseSessionUpstreamJson({
      upstreamResponse: new Response("boom", { status: 503 }),
      parse: (input) => sessionAckSchema.safeParse(input),
      invalidPayloadMessage: "Invalid payload",
      invalidJsonMessage: "Invalid JSON",
    });

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    const data = await response.json();
    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toBe("boom");
  });

  it("当上游 JSON 非法时应返回结构化错误响应", async () => {
    const result = await parseSessionUpstreamJson({
      upstreamResponse: new Response("not-json", { status: 200 }),
      parse: (input) => sessionAckSchema.safeParse(input),
      invalidPayloadMessage: "Invalid payload",
      invalidJsonMessage: "Invalid JSON",
    });

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    const data = await response.json();
    expect(response.status).toBe(502);
    expect(data.error.message).toBe("Invalid JSON");
  });

  it("当上游 payload 非法时应返回结构化错误响应", async () => {
    const result = await parseSessionUpstreamJson({
      upstreamResponse: new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      parse: (input) => sessionAckSchema.safeParse(input),
      invalidPayloadMessage: "Invalid payload",
      invalidJsonMessage: "Invalid JSON",
    });

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    const data = await response.json();
    expect(response.status).toBe(502);
    expect(data.error.message).toBe("Invalid payload");
  });

  it("当上游 payload 合法时应返回已验证数据和状态码", async () => {
    const result = await parseSessionUpstreamJson({
      upstreamResponse: new Response(
        JSON.stringify({ status: "ok", archived: true }),
        { status: 201 },
      ),
      parse: (input) => sessionAckSchema.safeParse(input),
      invalidPayloadMessage: "Invalid payload",
      invalidJsonMessage: "Invalid JSON",
    });

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({
      data: { status: "ok", archived: true },
      status: 201,
    });
  });
});
