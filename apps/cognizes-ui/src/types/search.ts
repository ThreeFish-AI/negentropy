import type { PaperCategory, PaperStatus, Paper } from "./paper";

export interface SearchQuery {
  q: string;
  category?: PaperCategory;
  status?: PaperStatus;
  dateFrom?: string;
  dateTo?: string;
  author?: string;
  sortBy?: "relevance" | "date" | "title";
  sortOrder?: "asc" | "desc";
}

export interface SearchResult {
  paper: Paper;
  highlights: {
    title?: string[];
    abstract?: string[];
    content?: string[];
  };
  score: number;
}

export interface SearchFilters {
  categories: PaperCategory[];
  statuses: PaperStatus[];
  dateRange: {
    start: string;
    end: string;
  };
  authors: string[];
}
