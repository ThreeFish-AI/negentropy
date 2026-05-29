"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";

export default function InterfaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      router.replace("/");
    }
  }, [user, status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" label="Loading" className="text-text-muted" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
