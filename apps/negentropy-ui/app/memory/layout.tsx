"use client";

import { AuthGuard } from "@/components/providers/AuthGuard";

export default function MemoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
