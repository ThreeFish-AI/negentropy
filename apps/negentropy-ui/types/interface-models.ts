export type ModelKind = "llm" | "embedding" | "rerank";

export interface ModelConfigRecord {
  id: string;
  model_type: ModelKind;
  display_name: string;
  vendor: string;
  model_name: string;
  is_default: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export const MODEL_KINDS: { value: ModelKind; label: string }[] = [
  { value: "llm", label: "LLM" },
  { value: "embedding", label: "Embedding" },
  { value: "rerank", label: "Rerank" },
];
