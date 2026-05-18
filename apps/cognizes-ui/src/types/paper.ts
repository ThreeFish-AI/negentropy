export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract?: string;
  keywords?: string[];
  category: PaperCategory;
  status: PaperStatus;
  uploadedAt: string;
  updatedAt: string;
  fileSize: number;
  fileName: string;
  filePath?: string;
  translation?: {
    title: string;
    abstract: string;
    content: string;
    translatedAt: string;
  };
  analysis?: {
    summary: string;
    keyPoints: string[];
    insights: string[];
    analyzedAt: string;
  };
  metadata?: {
    journal?: string;
    year?: number;
    doi?: string;
    pages?: string;
  };
}

export type PaperCategory =
  | "llm-agents"
  | "context-engineering"
  | "reasoning"
  | "tool-use"
  | "planning"
  | "memory"
  | "multi-agent"
  | "evaluation"
  | "other";

export type PaperStatus =
  | "uploaded"
  | "processing"
  | "translated"
  | "analyzed"
  | "failed"
  | "deleted";

export interface PaperFilters {
  search?: string;
  category?: PaperCategory | "all";
  status?: PaperStatus | "all";
  dateRange?: {
    start: string;
    end: string;
  };
  author?: string;
  sortBy?: "uploadedAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export interface UploadPaperForm {
  file: File;
  category: PaperCategory;
  tags?: string[];
  metadata?: {
    journal?: string;
    year?: number;
    doi?: string;
  };
}

export type PaperFields = keyof Paper;
