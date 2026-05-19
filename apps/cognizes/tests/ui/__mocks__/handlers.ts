import { http, HttpResponse } from "msw";

// Mock papers data
const mockPapers = [
  {
    id: "1",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer"],
    abstract:
      "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
    keywords: ["transformer", "attention", "nlp"],
    category: "llm-agents" as const,
    status: "processed" as const,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fileSize: 1048576,
    fileName: "attention.pdf",
    filePath: "/papers/attention.pdf",
  },
  {
    id: "2",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: ["Jacob Devlin", "Ming-Wei Chang"],
    abstract: "We introduce a new language representation model called BERT...",
    keywords: ["bert", "pretrain", "nlp"],
    category: "context-engineering" as const,
    status: "processed" as const,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fileSize: 2097152,
    fileName: "bert.pdf",
    filePath: "/papers/bert.pdf",
  },
  {
    id: "3",
    title: "GPT-3: Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann"],
    abstract:
      "Recent work has demonstrated substantial gains on many NLP tasks and benchmarks...",
    keywords: ["gpt", "few-shot", "language-model"],
    category: "reasoning" as const,
    status: "uploaded" as const,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fileSize: 3145728,
    fileName: "gpt3.pdf",
    filePath: "/papers/gpt3.pdf",
  },
  {
    id: "4",
    title: "Chain-of-Thought Prompting Elicits Reasoning",
    authors: ["Jason Wei", "Xuezhi Wang"],
    abstract:
      "We explore how generating a chain of thought can improve reasoning...",
    keywords: ["chain-of-thought", "reasoning", "prompting"],
    category: "reasoning" as const,
    status: "processing" as const,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fileSize: 1572864,
    fileName: "cot.pdf",
    filePath: "/papers/cot.pdf",
  },
  {
    id: "5",
    title: "ReAct: Synergizing Reasoning and Acting",
    authors: ["Shunyu Yao", "Jeffrey Zhao"],
    abstract:
      "While large language models have demonstrated remarkable capabilities...",
    keywords: ["react", "agents", "reasoning"],
    category: "tool-use" as const,
    status: "failed" as const,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fileSize: 2621440,
    fileName: "react.pdf",
    filePath: "/papers/react.pdf",
  },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const handlers = [
  // GET /api/papers - List papers with pagination and filtering
  http.get(`${API_URL}/api/papers`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page")) || 1;
    const limit = Number(url.searchParams.get("limit")) || 10;
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");

    let filteredPapers = [...mockPapers];

    // Apply filters
    if (search) {
      filteredPapers = filteredPapers.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.authors.some((a) => a.toLowerCase().includes(search.toLowerCase()))
      );
    }

    if (status && status !== "all") {
      filteredPapers = filteredPapers.filter((p) => p.status === status);
    }

    // Pagination
    const start = (page - 1) * limit;
    const paginatedPapers = filteredPapers.slice(start, start + limit);

    return HttpResponse.json({
      success: true,
      items: paginatedPapers,
      pagination: {
        page,
        limit,
        total: filteredPapers.length,
        totalPages: Math.ceil(filteredPapers.length / limit),
      },
    });
  }),

  // GET /api/papers/:id - Get single paper
  http.get(`${API_URL}/api/papers/:id`, ({ params }) => {
    const { id } = params;
    const paper = mockPapers.find((p) => p.id === id);

    if (!paper) {
      return HttpResponse.json(
        { success: false, message: "Paper not found" },
        { status: 404 }
      );
    }

    return HttpResponse.json({ success: true, data: paper });
  }),

  // POST /api/papers - Create paper
  http.post(`${API_URL}/api/papers`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newPaper = {
      id: String(mockPapers.length + 1),
      ...body,
      status: "uploaded" as const,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json(
      { success: true, data: newPaper },
      { status: 201 }
    );
  }),

  // PUT /api/papers/:id - Update paper
  http.put(`${API_URL}/api/papers/:id`, async ({ params, request }) => {
    const { id } = params;
    const paper = mockPapers.find((p) => p.id === id);

    if (!paper) {
      return HttpResponse.json(
        { success: false, message: "Paper not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updatedPaper = {
      ...paper,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ success: true, data: updatedPaper });
  }),

  // DELETE /api/papers/:id - Delete paper
  http.delete(`${API_URL}/api/papers/:id`, ({ params }) => {
    const { id } = params;
    const paperIndex = mockPapers.findIndex((p) => p.id === id);

    if (paperIndex === -1) {
      return HttpResponse.json(
        { success: false, message: "Paper not found" },
        { status: 404 }
      );
    }

    return HttpResponse.json({ success: true, message: "Paper deleted" });
  }),

  // POST /api/papers/:id/translate - Translate paper
  http.post(`${API_URL}/api/papers/:id/translate`, ({ params }) => {
    const { id } = params;
    const paper = mockPapers.find((p) => p.id === id);

    if (!paper) {
      return HttpResponse.json(
        { success: false, message: "Paper not found" },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        taskId: `translate-${id}`,
        status: "pending",
        message: "Translation task queued",
      },
    });
  }),

  // POST /api/papers/:id/analyze - Analyze paper
  http.post(`${API_URL}/api/papers/:id/analyze`, ({ params }) => {
    const { id } = params;
    const paper = mockPapers.find((p) => p.id === id);

    if (!paper) {
      return HttpResponse.json(
        { success: false, message: "Paper not found" },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        taskId: `analyze-${id}`,
        status: "pending",
        message: "Analysis task queued",
      },
    });
  }),

  // GET /api/tasks - List tasks
  http.get(`${API_URL}/api/tasks`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: "task-1",
          type: "translate",
          status: "completed",
          progress: 100,
          createdAt: new Date().toISOString(),
        },
        {
          id: "task-2",
          type: "analyze",
          status: "processing",
          progress: 50,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }),

  // GET /api/tasks/:id - Get task status
  http.get(`${API_URL}/api/tasks/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      success: true,
      data: {
        id,
        type: "translate",
        status: "processing",
        progress: 75,
        createdAt: new Date().toISOString(),
      },
    });
  }),

  // POST /api/search - Search papers
  http.post(`${API_URL}/api/search`, async ({ request }) => {
    const body = (await request.json()) as { query?: string };
    const query = body.query || "";

    const results = mockPapers
      .filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.abstract.toLowerCase().includes(query.toLowerCase())
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        score: Math.random(),
        excerpt: p.abstract.substring(0, 200),
      }));

    return HttpResponse.json({ success: true, data: results });
  }),
];

// Export mock papers for use in tests
export { mockPapers };
