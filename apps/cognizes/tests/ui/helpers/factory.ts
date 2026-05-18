import { Paper, SearchResult, Task } from "@/types";
import { faker } from "@faker-js/faker";

// Paper factory
export const createPaper = (overrides: Partial<Paper> = {}): Paper => ({
  id: faker.string.uuid(),
  title: faker.lorem.words(5),
  authors: [faker.person.fullName(), faker.person.fullName()],
  abstract: faker.lorem.paragraphs(3),
  keywords: [faker.lorem.word(), faker.lorem.word()],
  category: faker.helpers.arrayElement([
    "llm-agents",
    "context-engineering",
    "reasoning",
    "tool-use",
    "planning",
    "memory",
    "multi-agent",
  ]),
  status: faker.helpers.arrayElement([
    "uploaded",
    "processing",
    "translated",
    "analyzed",
    "failed",
  ]),
  uploadedAt: faker.date.past().toISOString(),
  updatedAt: faker.date.recent().toISOString(),
  fileSize: faker.number.int({ min: 1024, max: 10485760 }),
  fileName: `${faker.lorem.slug()}.pdf`,
  filePath: `/papers/${faker.string.uuid()}.pdf`,
  ...overrides,
});

// Create multiple papers
export const createPapers = (
  count: number,
  overrides: Partial<Paper> = {}
): Paper[] => Array.from({ length: count }, () => createPaper(overrides));

// Task factory
export const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: faker.string.uuid(),
  type: faker.helpers.arrayElement(["translate", "analyze", "extract"]),
  status: faker.helpers.arrayElement([
    "pending",
    "running",
    "completed",
    "failed",
  ]),
  progress: faker.number.int({ min: 0, max: 100 }),
  title: faker.lorem.sentence(),
  workflow: "default",
  logs: [],
  createdAt: faker.date.recent().toISOString(),
  updatedAt: faker.date.recent().toISOString(),
  result: null,
  error: undefined,
  ...overrides,
});

// Search result factory
export const createSearchResult = (
  overrides: Partial<SearchResult> = {}
): SearchResult => ({
  paper: createPaper(),
  highlights: {
    title: [faker.lorem.words(3)],
    abstract: [faker.lorem.sentence()],
  },
  score: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
  ...overrides,
});

// API response factory
export const createApiResponse = <T>(data: T, overrides: any = {}) => ({
  success: true,
  data,
  message: "",
  ...overrides,
});

// Paginated response factory
export const createPaginatedResponse = <T>(
  items: T[],
  page = 1,
  limit = 10,
  overrides: any = {}
) => ({
  success: true,
  data: items,
  pagination: {
    page,
    limit,
    total: items.length,
    totalPages: Math.ceil(items.length / limit),
  },
  ...overrides,
});

// Error response factory
export const createErrorResponse = (message: string, status = 400) => ({
  success: false,
  message,
  error: {
    status,
    code: faker.lorem.slug(),
    details: faker.lorem.sentence(),
  },
});

// File factory for upload tests
export const createFile = (
  name = "test.pdf",
  type = "application/pdf",
  size = 1024 * 1024
): File => {
  const file = new File(["test content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

import { vi } from "vitest";

// ... (existing imports)

// Mock event factory
export const createMockEvent = (overrides: any = {}) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: {
    value: "",
    files: [],
    ...overrides.target,
  },
  ...overrides,
});

// Mock router factory
export const createMockRouter = (overrides: any = {}) => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: "/",
  query: {},
  ...overrides,
});

// ...

// Helper to reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
};

// Constants for test data
export const TEST_PAPERS = {
  ATTENTION_PAPER: createPaper({
    id: "attention-paper-id",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer"],
    category: "llm-agents" as const,
    status: "analyzed" as const,
    uploadedAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T12:00:00Z",
  }),
  BERT_PAPER: createPaper({
    id: "bert-paper-id",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: ["Jacob Devlin", "Ming-Wei Chang"],
    category: "context-engineering" as const,
    status: "processing" as const,
    uploadedAt: "2024-01-14T10:00:00Z",
    updatedAt: "2024-01-14T12:00:00Z",
  }),
  GPT3_PAPER: createPaper({
    id: "gpt3-paper-id",
    title: "GPT-3: Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann"],
    category: "reasoning" as const,
    status: "uploaded" as const,
    uploadedAt: "2024-01-13T10:00:00Z",
    updatedAt: "2024-01-13T12:00:00Z",
  }),
};

// End of factory.ts
