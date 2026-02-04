"use client";

import { useEffect, useMemo, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import {
  CorpusRecord,
  KnowledgeMatch,
  createCorpus,
  fetchCorpora,
  fetchCorpus,
  ingestText,
  replaceSource,
  searchKnowledge,
} from "@/lib/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function KnowledgeBasePage() {
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CorpusRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCorpusName, setNewCorpusName] = useState("");
  const [newCorpusDesc, setNewCorpusDesc] = useState("");
  const [sourceUri, setSourceUri] = useState("");
  const [ingestTextValue, setIngestTextValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [matches, setMatches] = useState<KnowledgeMatch[]>([]);

  useEffect(() => {
    let active = true;
    fetchCorpora(APP_NAME)
      .then((items) => {
        if (active) {
          setCorpora(items);
          if (!selectedId && items.length) {
            setSelectedId(items[0].id);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(String(err));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let active = true;
    fetchCorpus(selectedId, APP_NAME)
      .then((item) => {
        if (active) {
          setSelected(item);
        }
      })
      .catch((err) => {
        if (active) {
          setError(String(err));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectedConfig = useMemo(() => selected?.config ?? {}, [selected]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="Knowledge Base" description="数据源管理、索引构建与检索配置" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_2.2fr_1.2fr]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Sources</h2>
          </div>
          <div className="mt-3 space-y-2">
            {corpora.length ? (
              corpora.map((corpus) => (
                <button
                  key={corpus.id}
                  onClick={() => setSelectedId(corpus.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                    selectedId === corpus.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <p className="text-xs font-semibold">{corpus.name}</p>
                  <p className="mt-1 text-[11px] opacity-70">{corpus.description || corpus.app_name}</p>
                </button>
              ))
            ) : (
              <p className="text-xs text-zinc-500">暂无数据源</p>
            )}
          </div>
          <div className="mt-4 border-t border-zinc-200 pt-4">
            <p className="text-xs font-semibold text-zinc-900">新建数据源</p>
            <input
              className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
              placeholder="Corpus name"
              value={newCorpusName}
              onChange={(event) => setNewCorpusName(event.target.value)}
            />
            <textarea
              className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
              rows={2}
              placeholder="Description"
              value={newCorpusDesc}
              onChange={(event) => setNewCorpusDesc(event.target.value)}
            />
            <button
              className="mt-2 w-full rounded bg-black px-3 py-2 text-xs font-semibold text-white"
              onClick={async () => {
                if (!newCorpusName.trim()) return;
                const created = await createCorpus({
                  app_name: APP_NAME,
                  name: newCorpusName.trim(),
                  description: newCorpusDesc.trim() || undefined,
                });
                setCorpora((prev) => [created, ...prev]);
                setSelectedId(created.id);
                setNewCorpusName("");
                setNewCorpusDesc("");
              }}
            >
              Create Corpus
            </button>
          </div>
        </aside>

        <main className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Source Detail</h2>
            {selected ? (
              <div className="mt-3 text-xs text-zinc-600">
                <p>Corpus: {selected.name}</p>
                <p>Description: {selected.description || "-"}</p>
                <p>Knowledge Count: {selected.knowledge_count}</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">请选择数据源</p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">检索结果</h2>
            {matches.length ? (
              <div className="mt-3 space-y-3">
                {matches.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-200 p-3 text-xs">
                    <p className="text-zinc-900">{item.content}</p>
                    <p className="mt-2 text-[11px] text-zinc-500">{item.source_uri || "-"}</p>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      score: {item.combined_score.toFixed(4)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">暂无结果</p>
            )}
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Retrieval Config</h2>
            <div className="mt-3 text-xs text-zinc-600">
              <p>Chunk Size: {selectedConfig.chunk_size || 800}</p>
              <p>Overlap: {selectedConfig.overlap || 100}</p>
              <p>Embedding: {selectedConfig.embedding_model || "default"}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Ingest</h2>
            <input
              className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
              placeholder="source_uri"
              value={sourceUri}
              onChange={(event) => setSourceUri(event.target.value)}
            />
            <textarea
              className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
              rows={5}
              placeholder="Paste knowledge text"
              value={ingestTextValue}
              onChange={(event) => setIngestTextValue(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                onClick={async () => {
                  if (!selectedId) return;
                  await ingestText(selectedId, {
                    app_name: APP_NAME,
                    text: ingestTextValue,
                    source_uri: sourceUri || undefined,
                  });
                }}
              >
                Ingest
              </button>
              <button
                className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white"
                onClick={async () => {
                  if (!selectedId || !sourceUri) return;
                  await replaceSource(selectedId, {
                    app_name: APP_NAME,
                    text: ingestTextValue,
                    source_uri: sourceUri,
                  });
                }}
              >
                Replace Source
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Search</h2>
            <input
              className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
              placeholder="Search query"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {["semantic", "keyword", "hybrid"].map((option) => (
                <button
                  key={option}
                  className={`rounded-full border px-3 py-1 ${
                    mode === option
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-600"
                  }`}
                  onClick={() => setMode(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              className="mt-3 w-full rounded bg-black px-3 py-2 text-xs font-semibold text-white"
              onClick={async () => {
                if (!selectedId || !searchQuery.trim()) return;
                const result = await searchKnowledge(selectedId, {
                  app_name: APP_NAME,
                  query: searchQuery,
                  mode,
                });
                setMatches(result.items);
              }}
            >
              Search Knowledge
            </button>
          </div>
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
