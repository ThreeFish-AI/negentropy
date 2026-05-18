// 连接到我们的 Python AG-UI 后端
const AGUI_BACKEND_URL =
  process.env.AGUI_BACKEND_URL || "http://localhost:8000";

export const GET = async () => {
  // 转发 /info 请求到 Python AG-UI 服务端
  const response = await fetch(`${AGUI_BACKEND_URL}/api/copilotkit/info`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST = async (req: Request) => {
  // 转发请求到 Python AG-UI 服务端
  const body = await req.json();

  const response = await fetch(`${AGUI_BACKEND_URL}/api/copilotkit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // 检查响应类型，Single Endpoint Transport 的 info 请求返回 JSON
  const contentType = response.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    // info 请求返回 JSON
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    // agent/run 请求返回 SSE 流
    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }
};
