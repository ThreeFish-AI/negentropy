// CopilotKit /info 端点 - 返回 Agent 注册信息

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
