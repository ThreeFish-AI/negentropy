"use client";

import { AuthGuard } from "@/components/providers/AuthGuard";

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
