"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /interface/task-models — 保留路由兼容性，重定向到 /interface/models（Model Link 区块）。
 */
export default function TaskModelsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/interface/models");
  }, [router]);

  return null;
}
