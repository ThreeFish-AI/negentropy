import { NextResponse } from "next/server";

/**
 * Knowledge API 统计端点
 *
 * 初期返回 Mock 数据，后续可扩展为从后端获取真实统计数据
 */

interface ApiStatsResponse {
  total_calls: number;
  success_count: number;
  failed_count: number;
  avg_latency_ms: number;
}

export async function GET() {
  // Mock 数据 - 后续可从后端获取真实统计
  const stats: ApiStatsResponse = {
    total_calls: 1234,
    success_count: 1198,
    failed_count: 36,
    avg_latency_ms: 156.5,
  };

  return NextResponse.json(stats);
}
