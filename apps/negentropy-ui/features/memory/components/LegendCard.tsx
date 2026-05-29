"use client";

import { SidebarCard } from "./SidebarCard";

export function LegendCard() {
  return (
    <SidebarCard title="Legend">
      {/* Retention scores */}
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Retention
      </p>
      <div className="mt-1.5 space-y-1.5 text-[11px] text-muted">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          High retention (&ge; 50%)
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Medium retention (10-50%)
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Low retention (&lt; 10%)
        </div>
      </div>

      {/* Importance scores */}
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Importance
      </p>
      <div className="mt-1.5 space-y-1.5 text-[11px] text-muted">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          High importance (&ge; 70%)
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-500" />
          Medium importance (40-70%)
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          Low importance (&lt; 40%)
        </div>
      </div>

      {/* Memory types */}
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Memory Types
      </p>
      <div className="mt-1.5 space-y-1 text-[11px] text-muted">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> Core
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Semantic
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Episodic
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Procedural
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-pink-500" /> Preference
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-500" /> Fact
        </div>
      </div>
    </SidebarCard>
  );
}
