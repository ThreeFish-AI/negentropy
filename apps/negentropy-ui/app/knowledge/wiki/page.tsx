"use client";

import { useCallback, useEffect, useState } from "react";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { CatalogSelector } from "../catalog/_components/CatalogSelector";
import {
  fetchWikiPublications,
  WikiPublication,
} from "@/features/knowledge";
import { toast } from "@/lib/activity-toast";
import { WikiPublicationList } from "./_components/WikiPublicationList";
import { WikiPublicationDetail } from "./_components/WikiPublicationDetail";
import { CreateWikiPublicationDialog } from "./_components/CreateWikiPublicationDialog";

export default function WikiPage() {
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [publications, setPublications] = useState<WikiPublication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const loadPublications = useCallback(async () => {
    if (!catalogId) {
      setPublications([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetchWikiPublications({ catalogId });
      setPublications(resp.items);
      setSelectedId((prev) =>
        prev && resp.items.some((p) => p.id === prev) ? prev : null,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载发布列表失败");
    } finally {
      setLoading(false);
    }
  }, [catalogId]);

  useEffect(() => {
    loadPublications();
  }, [loadPublications]);

  const selectedPub =
    publications.find((p) => p.id === selectedId) ?? null;

  const handleCreated = useCallback(
    (pub: WikiPublication) => {
      setSelectedId(pub.id);
      loadPublications();
    },
    [loadPublications],
  );

  const handleDeleted = useCallback(() => {
    setSelectedId(null);
    loadPublications();
  }, [loadPublications]);

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav title="Wiki" description="Wiki 发布管理" />

      <div className="flex min-h-0 flex-1 px-6 py-4 gap-4">
        <aside className="w-[320px] shrink-0 flex flex-col gap-3 overflow-hidden">
          <CatalogSelector value={catalogId} onChange={setCatalogId} />

          <button
            onClick={() => setCreateOpen(true)}
            disabled={!catalogId}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            + 新建发布
          </button>

          <WikiPublicationList
            publications={publications}
            selectedId={selectedId}
            onSelect={(pub) => setSelectedId(pub.id)}
            loading={loading}
          />
        </aside>

        <main className="flex-1 min-w-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <WikiPublicationDetail
            publication={selectedPub}
            onChanged={loadPublications}
            onDeleted={handleDeleted}
          />
        </main>
      </div>

      <CreateWikiPublicationDialog
        open={createOpen}
        catalogId={catalogId ?? ""}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
