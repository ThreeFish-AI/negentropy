import { NextRequest, NextResponse } from "next/server";

/**
 * Knowledge API 统计端点
 *
 * 代理到后端 /knowledge/stats API 获取真实统计数据
 * 支持按单个 endpoint 过滤统计
 */

interface ApiStatsResponse {
  total_calls: number;
  success_count: number;
  failed_count: number;
  avg_latency_ms: number;
}

function getBaseUrl() {
  return (
    process.env.KNOWLEDGE_BASE_URL ||
    process.env.AGUI_BASE_URL ||
    process.env.NEXT_PUBLIC_AGUI_BASE_URL
  );
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();

  // 从查询参数获取 endpoint
  const { searchParams } = request.nextUrl;
  const endpoint = searchParams.get("endpoint");

  // 如果没有配置后端 URL，返回默认值
  if (!baseUrl) {
    const defaultStats: ApiStatsResponse = {
      total_calls: 0,
      success_count: 0,
      failed_count: 0,
      avg_latency_ms: 0,
    };
    return NextResponse.json(defaultStats);
  }

  try {
    // 构建后端 URL，传递 endpoint 参数
    const backendUrl = new URL(`${baseUrl}/knowledge/stats`);
    if (endpoint) {
      backendUrl.searchParams.set("endpoint", endpoint);
    }

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // 后端返回错误时，降级返回默认值
      console.error(`Failed to fetch API stats: ${response.status}`);
      const fallbackStats: ApiStatsResponse = {
        total_calls: 0,
        success_count: 0,
        failed_count: 0,
        avg_latency_ms: 0,
      };
      return NextResponse.json(fallbackStats);
    }

    const stats: ApiStatsResponse = await response.json();
    return NextResponse.json(stats);
  } catch (error) {
    // 网络错误等异常情况，返回默认值
    console.error("Error fetching API stats:", error);
    const fallbackStats: ApiStatsResponse = {
      total_calls: 0,
      success_count: 0,
      failed_count: 0,
      avg_latency_ms: 0,
    };
    return NextResponse.json(fallbackStats);
  }
}
