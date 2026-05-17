"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LibraryShell } from "./_components/LibraryShell";
import type { ViewMode } from "./_components/ModeToggle";

function WikiPageInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const initialMode: ViewMode = mode === "publish" ? "publish" : "edit";

  return <LibraryShell initialMode={initialMode} />;
}

export default function WikiPage() {
  return (
    <Suspense>
      <WikiPageInner />
    </Suspense>
  );
}
