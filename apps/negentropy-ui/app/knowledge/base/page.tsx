"use client";

import { useCallback, useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { useKnowledgeBase } from "@/features/knowledge";

import { CorpusList } from "./_components/CorpusList";
import { CorpusDetail } from "./_components/CorpusDetail";
import { CreateCorpusForm } from "./_components/CreateCorpusForm";
import { IngestPanel } from "./_components/IngestPanel";
import { SearchWorkspace } from "./_components/SearchWorkspace";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function KnowledgeBasePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kb = useKnowledgeBase({
    appName: APP_NAME,
    corpusId: selectedId ?? undefined,
  });

  useEffect(() => {
    kb.loadCorpora();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在挂载时加载一次
  }, []);

  useEffect(() => {
    if (!selectedId && kb.corpora.length) {
      setSelectedId(kb.corpora[0].id);
    }
  }, [kb.corpora, selectedId]);

  const handleCreate = useCallback(
    async (params: { name: string; description?: string }) => {
      const created = await kb.createCorpus(params);
      setSelectedId(created.id);
      return created;
    },
    [kb.createCorpus],
  );

  const handleIngest = useCallback(
    (params: { text: string; source_uri?: string }) => kb.ingestText(params),
    [kb.ingestText],
  );

  const handleReplace = useCallback(
    (params: { text: string; source_uri: string }) =>
      kb.replaceSource(params),
    [kb.replaceSource],
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="Knowledge Base" description="数据源管理、索引构建与检索配置" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
        {/* Left sidebar: Sources + Detail */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Sources</h2>
            <div className="mt-3">
              <CorpusList
                corpora={kb.corpora}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isLoading={kb.isLoading}
              />
            </div>
          </div>
          <CreateCorpusForm
            onCreate={handleCreate}
            isLoading={kb.isLoading}
          />
          <CorpusDetail corpus={kb.corpus} />
        </aside>

        {/* Right workspace: Search + Ingest */}
        <main className="space-y-4">
          {selectedId ? (
            <SearchWorkspace
              key={selectedId}
              corpusId={selectedId}
              appName={APP_NAME}
            />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-zinc-500">请先选择数据源以开始搜索</p>
            </div>
          )}
          <IngestPanel
            corpusId={selectedId}
            onIngest={handleIngest}
            onReplace={handleReplace}
          />
        </main>
      </div>
    </div>
  );
}
