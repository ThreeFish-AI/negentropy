import {
  buildCorpusConfig,
  buildExtractorRoutesFromDraft,
  createDefaultChunkingConfig,
  createEmptyExtractorDraftTarget,
  normalizeChunkingConfig,
  normalizeCorpusExtractorRoutes,
  normalizeExtractorDraftRoutes,
} from "@/features/knowledge/utils/knowledge-api";

export function createKnowledgeConfigTestExports() {
  return {
    createDefaultChunkingConfig,
    normalizeChunkingConfig,
    normalizeCorpusExtractorRoutes,
    createEmptyExtractorDraftTarget,
    normalizeExtractorDraftRoutes,
    buildExtractorRoutesFromDraft,
    buildCorpusConfig,
  };
}
