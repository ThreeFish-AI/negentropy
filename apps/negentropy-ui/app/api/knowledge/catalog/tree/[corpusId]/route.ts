import { NextResponse } from "next/server";

// 旧路由已废弃，迁移至 /api/knowledge/catalogs/{catalogId}/tree
export async function GET() {
  return NextResponse.json(
    { error: { code: "GONE", message: "此端点已迁移，请使用 /api/knowledge/catalogs/{catalogId}/tree" } },
    {
      status: 410,
      headers: {
        "X-Deprecation-Notice": "Migrated to /api/knowledge/catalogs/{catalogId}/tree",
      },
    },
  );
}
