import { NextResponse } from "next/server";

import { buildAuthHeaders } from "@/lib/sso";
import { getAguiBaseUrl } from "@/lib/server/backend-url";

function parseUpstreamError(text: string): string {
  try {
    const data = JSON.parse(text);
    return data.detail || data.error || text;
  } catch {
    return text || "Upstream returned non-OK status";
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ task_key: string }> },
) {
  const { task_key } = await params;
  const baseUrl = getAguiBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "AGUI_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const body = await request.text();
  const upstreamUrl = new URL(
    `/interface/task-models/settings/${encodeURIComponent(task_key)}`,
    baseUrl,
  );
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "PUT",
      headers: {
        ...Object.fromEntries(buildAuthHeaders(request).entries()),
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Upstream connection failed: ${String(error)}` },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: parseUpstreamError(text) },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(text ? JSON.parse(text) : {}, {
    status: upstreamResponse.status,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ task_key: string }> },
) {
  const { task_key } = await params;
  const baseUrl = getAguiBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "AGUI_BASE_URL is not configured" },
      { status: 500 },
    );
  }

  const upstreamUrl = new URL(
    `/interface/task-models/settings/${encodeURIComponent(task_key)}`,
    baseUrl,
  );
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "DELETE",
      headers: buildAuthHeaders(request),
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Upstream connection failed: ${String(error)}` },
      { status: 502 },
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: parseUpstreamError(text) },
      { status: upstreamResponse.status },
    );
  }

  return NextResponse.json(text ? JSON.parse(text) : {}, {
    status: upstreamResponse.status,
  });
}
