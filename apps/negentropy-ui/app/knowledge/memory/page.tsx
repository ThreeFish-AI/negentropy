import { redirect } from "next/navigation";

/**
 * @deprecated Memory has been moved to /memory/timeline
 * This redirect ensures old bookmarks continue to work.
 */
export default function KnowledgeMemoryRedirect() {
  redirect("/memory/timeline");
}
