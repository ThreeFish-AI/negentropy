"use client";

import { useState } from "react";
import type { SubAgentTransferDisplaySegment } from "@/types/a2ui";
import { cn } from "@/lib/utils";

// Map agent names to display names and emoji
const AGENT_DISPLAY: Record<string, { name: string; emoji: string }> = {
  NegentropyEngine: { name: "NE Engine", emoji: "\u{1F9E0}" },
  PerceptionFaculty: { name: "Perception", emoji: "\u{1F441}" },
  InternalizationFaculty: { name: "Internalization", emoji: "\u{1F48E}" },
  ContemplationFaculty: { name: "Contemplation", emoji: "\u{1F914}" },
  ActionFaculty: { name: "Action", emoji: "\u{270B}" },
  InfluenceFaculty: { name: "Influence", emoji: "\u{1F5E3}" },
  KnowledgeAcquisitionPipeline: { name: "Knowledge Pipeline", emoji: "\u{1F4DA}" },
  ProblemSolvingPipeline: { name: "Problem Solving", emoji: "\u{1F527}" },
  ValueDeliveryPipeline: { name: "Value Delivery", emoji: "\u{1F4E4}" },
};

function getAgentDisplay(agentName: string) {
  return AGENT_DISPLAY[agentName] || { name: agentName, emoji: "\u{1F916}" };
}

export function SubAgentTransferCard({
  segment,
  expanded: initialExpanded = false,
}: {
  segment: SubAgentTransferDisplaySegment;
  expanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const from = getAgentDisplay(segment.fromAgent);
  const to = getAgentDisplay(segment.toAgent);

  return (
    <div
      className={cn(
        "my-1.5 rounded-md border-l-2 border-indigo-400/60 bg-indigo-50/50 px-3 py-2 dark:bg-indigo-950/20",
        "transition-colors",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left text-sm"
      >
        <span className="text-base">{from.emoji}</span>
        <span className="text-muted-foreground">{from.name}</span>
        <span className="text-muted-foreground">&rarr;</span>
        <span className="text-base">{to.emoji}</span>
        <span className="font-medium">{to.name}</span>
        {segment.status === "running" && (
          <span className="ml-auto inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
        )}
        {segment.status === "completed" && (
          <span className="ml-auto inline-block h-2 w-2 rounded-full bg-green-500" />
        )}
        {segment.status === "error" && (
          <span className="ml-auto inline-block h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>
      {expanded && segment.childResponse && (
        <div className="mt-2 max-h-32 overflow-y-auto border-l border-border pl-4 text-xs text-muted-foreground">
          <p className="whitespace-pre-wrap">{segment.childResponse}</p>
        </div>
      )}
    </div>
  );
}
