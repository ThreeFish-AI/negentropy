import { NextRequest, NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";

/**
 * Plugins Stats API 代理端点
 *
 * 代理到后端 /plugins/stats API 获取插件统计数据
 */

interface PluginStatsResponse {
  mcp_servers: { total: number; enabled: number };
  skills: { total: number; enabled: number };
  subagents: { total: number; enabled: number };
}

function getBaseUrl() {
  return (
    process.env.AGUI_BASE_URL ||
    process.env.NEXT_PUBLIC_AGUI_BASE_URL
  );
}

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

const defaultStats: PluginStatsResponse = {
  mcp_servers: { total: 0, enabled: 0 },
  skills: { total: 0, enabled: 0 },
  subagents: { total: 0, enabled: 0 },
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
    const backendUrl = new URL(`${baseUrl}/plugins/stats`);

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: extractForwardHeaders(request),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Failed to fetch plugins stats from backend: ${response.status}`);
      const text = await response.text();
      console.error(`Backend error response: ${text}`);
      return NextResponse.json(defaultStats);
    }

    const stats: PluginStatsResponse = await response.json();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error connecting to backend for plugins stats:", error);
    return NextResponse.json(defaultStats);
  }
}
