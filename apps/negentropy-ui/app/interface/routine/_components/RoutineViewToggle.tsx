"use client";

import { navPillClassName, navRailContainerClassName } from "@/components/ui/nav-styles";

export type RoutineView = "table" | "fleet";

/** Table ⇄ Live 分段切换（复用统一胶囊样式；状态经 URL ``?view=`` 派生）。 */
export function RoutineViewToggle({
  view,
  onChange,
}: {
  view: RoutineView;
  onChange: (v: RoutineView) => void;
}) {
  const items: { value: RoutineView; label: string }[] = [
    { value: "table", label: "Table" },
    { value: "fleet", label: "Live" },
  ];
  return (
    <div className={navRailContainerClassName} role="tablist" aria-label="Routine view">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={view === it.value}
          onClick={() => onChange(it.value)}
          className={navPillClassName(view === it.value, "cursor-pointer")}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
