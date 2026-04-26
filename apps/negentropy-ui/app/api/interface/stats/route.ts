import { NextRequest, NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getAguiBaseUrl } from "@/lib/server/backend-url";

/**
 * Interface Stats API 代理端点
 *
 * 代理到后端 /interface/stats API 获取 Interface 模块聚合统计数据（MCP/Skills/SubAgents/Models）。
 */

interface InterfaceStatsResponse {
  mcp_servers: { total: number; enabled: number };
  skills: { total: number; enabled: number };
  subagents: { total: number; enabled: number };
  models: { total: number; enabled: number; vendors: number };
}

const getBaseUrl = getAguiBaseUrl;

function extractForwardHeaders(request: Request) {
  const headers = buildAuthHeaders(request);

  const auth = request.headers.get("authorization");
  if (auth) {
    headers.set("authorization", auth);
  }

  const sessionId = request.headers.get("x-session-id");
  if (sessionId) {
    headers.set("x-session-id", sessionId);
  }

  const userId = request.headers.get("x-user-id");
  if (userId) {
    headers.set("x-user-id", userId);
  }

  return headers;
}

const defaultStats: InterfaceStatsResponse = {
  mcp_servers: { total: 0, enabled: 0 },
  skills: { total: 0, enabled: 0 },
  subagents: { total: 0, enabled: 0 },
  models: { total: 0, enabled: 0, vendors: 0 },
};

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();

  // 如果没有配置后端 URL，返回默认值
  if (!baseUrl) {
    console.error("AGUI_BASE_URL is not configured");
    return NextResponse.json(defaultStats);
  }

  try {
    // 构建后端 URL
    const backendUrl = new URL(`${baseUrl}/interface/stats`);

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: extractForwardHeaders(request),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Failed to fetch interface stats from backend: ${response.status}`);
      const text = await response.text();
      console.error(`Backend error response: ${text}`);
      return NextResponse.json(defaultStats);
    }

    const stats: InterfaceStatsResponse = await response.json();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error connecting to backend for interface stats:", error);
    return NextResponse.json(defaultStats);
  }
}
