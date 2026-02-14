/**
 * Knowledge APIs 规范定义
 *
 * 用于生成 API 文档、参数校验和代码示例
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiParameter {
  name: string;
  in: "path" | "query" | "body";
  required: boolean;
  type: "string" | "integer" | "boolean" | "object" | "array";
  default?: string | number | boolean;
  description: string;
  enum?: string[];
  min?: number;
  max?: number;
}

export interface ApiRequestBody {
  contentType: string;
  schema: Record<string, unknown>;
  example: Record<string, unknown>;
}

export interface ApiResponse {
  status: number;
  description: string;
  schema?: Record<string, unknown>;
}

export interface CodeExamples {
  curl: string;
  python: string;
  javascript: string;
}

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  examples: CodeExamples;
}

const BASE_URL = "http://localhost:8000";

export const KNOWLEDGE_API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "search",
    method: "POST",
    path: "/knowledge/base/{corpus_id}/search",
    summary: "搜索知识库",
    description:
      "在指定语料库中执行知识检索。支持三种搜索模式：语义检索 (semantic)、关键词检索 (keyword)、混合检索 (hybrid)。语义检索基于向量相似度，适合概念性查询；关键词检索基于 BM25 算法，适合精确匹配；混合检索结合两者优势，提供更全面的检索结果。",
    parameters: [
      {
        name: "corpus_id",
        in: "path",
        required: true,
        type: "string",
        description: "语料库 ID (UUID 格式)",
      },
      {
        name: "app_name",
        in: "query",
        required: false,
        type: "string",
        default: "agents",
        description: "应用名称，用于多租户隔离",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索查询文本" },
          mode: {
            type: "string",
            enum: ["semantic", "keyword", "hybrid"],
            default: "semantic",
          },
          limit: { type: "integer", default: 10, min: 1, max: 1000 },
          semantic_weight: { type: "number", min: 0, max: 1 },
          keyword_weight: { type: "number", min: 0, max: 1 },
          metadata_filter: { type: "object" },
        },
      },
      example: {
        query: "如何配置知识库",
        mode: "semantic",
        limit: 10,
      },
    },
    responses: [
      {
        status: 200,
        description: "搜索成功",
        schema: {
          type: "object",
          properties: {
            count: { type: "integer" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  content: { type: "string" },
                  source_uri: { type: "string" },
                  semantic_score: { type: "number" },
                  combined_score: { type: "number" },
                },
              },
            },
          },
        },
      },
      { status: 400, description: "参数验证失败" },
      { status: 404, description: "语料库不存在" },
    ],
    examples: {
      curl: `curl -X POST "${BASE_URL}/knowledge/base/{corpus_id}/search" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "如何配置知识库",
    "mode": "semantic",
    "limit": 10
  }'`,
      python: `import requests

response = requests.post(
    "${BASE_URL}/knowledge/base/{corpus_id}/search",
    json={
        "query": "如何配置知识库",
        "mode": "semantic",
        "limit": 10
    }
)
results = response.json()
print(f"Found {results['count']} matches")
for item in results['items']:
    print(f"- {item['content'][:100]}...")`,
      javascript: `const response = await fetch('${BASE_URL}/knowledge/base/{corpus_id}/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: '如何配置知识库',
    mode: 'semantic',
    limit: 10
  })
});

const results = await response.json();
console.log(\`Found \${results.count} matches\`);
results.items.forEach(item => {
  console.log(\`- \${item.content.slice(0, 100)}...\`);
});`,
    },
  },
  {
    id: "ingest",
    method: "POST",
    path: "/knowledge/base/{corpus_id}/ingest",
    summary: "摄入文本内容",
    description:
      "将文本内容摄入到指定语料库中。系统会自动进行文本分块、向量化处理，并存储到知识库。支持自定义分块参数以优化检索效果。",
    parameters: [
      {
        name: "corpus_id",
        in: "path",
        required: true,
        type: "string",
        description: "语料库 ID",
      },
      {
        name: "app_name",
        in: "query",
        required: false,
        type: "string",
        default: "agents",
        description: "应用名称",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string", description: "要摄入的文本内容" },
          source_uri: { type: "string", description: "来源 URI，用于追溯" },
          metadata: { type: "object", description: "自定义元数据" },
          chunk_size: { type: "integer", default: 800, min: 1, max: 100000 },
          overlap: { type: "integer", default: 100 },
          preserve_newlines: { type: "boolean", default: false },
        },
      },
      example: {
        text: "这是一段需要摄入到知识库的文本内容。系统会自动进行分块和向量化处理。",
        source_uri: "docs://example/doc1",
        metadata: { category: "tutorial", version: "1.0" },
        chunk_size: 800,
        overlap: 100,
      },
    },
    responses: [
      {
        status: 200,
        description: "摄入成功",
        schema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "生成的知识块数量" },
            items: { type: "array", items: { type: "string" } },
          },
        },
      },
      { status: 400, description: "参数验证失败" },
      { status: 404, description: "语料库不存在" },
    ],
    examples: {
      curl: `curl -X POST "${BASE_URL}/knowledge/base/{corpus_id}/ingest" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "这是一段需要摄入到知识库的文本内容。",
    "source_uri": "docs://example/doc1",
    "chunk_size": 800
  }'`,
      python: `import requests

response = requests.post(
    "${BASE_URL}/knowledge/base/{corpus_id}/ingest",
    json={
        "text": "这是一段需要摄入到知识库的文本内容。",
        "source_uri": "docs://example/doc1",
        "chunk_size": 800
    }
)
result = response.json()
print(f"Ingested {result['count']} chunks")`,
      javascript: `const response = await fetch('${BASE_URL}/knowledge/base/{corpus_id}/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '这是一段需要摄入到知识库的文本内容。',
    source_uri: 'docs://example/doc1',
    chunk_size: 800
  })
});

const result = await response.json();
console.log(\`Ingested \${result.count} chunks\`);`,
    },
  },
  {
    id: "ingest_url",
    method: "POST",
    path: "/knowledge/base/{corpus_id}/ingest_url",
    summary: "从 URL 摄入内容",
    description:
      "从指定 URL 抓取内容并摄入到语料库。系统会自动获取网页内容、提取正文、进行分块和向量化处理。",
    parameters: [
      {
        name: "corpus_id",
        in: "path",
        required: true,
        type: "string",
        description: "语料库 ID",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["url"],
        properties: {
          url: { type: "string", description: "要抓取的 URL" },
          metadata: { type: "object" },
          chunk_size: { type: "integer", default: 800 },
          overlap: { type: "integer", default: 100 },
        },
      },
      example: {
        url: "https://docs.example.com/guide",
        metadata: { type: "documentation" },
      },
    },
    responses: [
      { status: 200, description: "摄入成功" },
      { status: 400, description: "URL 无效或无法访问" },
      { status: 404, description: "语料库不存在" },
    ],
    examples: {
      curl: `curl -X POST "${BASE_URL}/knowledge/base/{corpus_id}/ingest_url" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://docs.example.com/guide",
    "metadata": { "type": "documentation" }
  }'`,
      python: `import requests

response = requests.post(
    "${BASE_URL}/knowledge/base/{corpus_id}/ingest_url",
    json={
        "url": "https://docs.example.com/guide",
        "metadata": {"type": "documentation"}
    }
)
result = response.json()
print(f"Ingested from URL: {result['count']} chunks")`,
      javascript: `const response = await fetch('${BASE_URL}/knowledge/base/{corpus_id}/ingest_url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://docs.example.com/guide',
    metadata: { type: 'documentation' }
  })
});

const result = await response.json();
console.log(\`Ingested from URL: \${result.count} chunks\`);`,
    },
  },
  {
    id: "replace_source",
    method: "POST",
    path: "/knowledge/base/{corpus_id}/replace_source",
    summary: "替换来源内容",
    description:
      "替换指定 source_uri 的所有知识块。先删除该来源的现有内容，再摄入新内容。适用于文档更新场景。",
    parameters: [
      {
        name: "corpus_id",
        in: "path",
        required: true,
        type: "string",
        description: "语料库 ID",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["text", "source_uri"],
        properties: {
          text: { type: "string", description: "新的文本内容" },
          source_uri: { type: "string", description: "要替换的来源 URI" },
          metadata: { type: "object" },
          chunk_size: { type: "integer", default: 800 },
          overlap: { type: "integer", default: 100 },
        },
      },
      example: {
        text: "这是更新后的文档内容。",
        source_uri: "docs://example/doc1",
      },
    },
    responses: [
      { status: 200, description: "替换成功" },
      { status: 404, description: "语料库不存在" },
    ],
    examples: {
      curl: `curl -X POST "${BASE_URL}/knowledge/base/{corpus_id}/replace_source" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "这是更新后的文档内容。",
    "source_uri": "docs://example/doc1"
  }'`,
      python: `import requests

response = requests.post(
    "${BASE_URL}/knowledge/base/{corpus_id}/replace_source",
    json={
        "text": "这是更新后的文档内容。",
        "source_uri": "docs://example/doc1"
    }
)
result = response.json()
print(f"Replaced source: {result['count']} chunks")`,
      javascript: `const response = await fetch('${BASE_URL}/knowledge/base/{corpus_id}/replace_source', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: '这是更新后的文档内容。',
    source_uri: 'docs://example/doc1'
  })
});

const result = await response.json();
console.log(\`Replaced source: \${result.count} chunks\`);`,
    },
  },
  {
    id: "list_knowledge",
    method: "GET",
    path: "/knowledge/base/{corpus_id}/knowledge",
    summary: "获取知识项列表",
    description:
      "分页获取指定语料库中的知识项列表。可用于查看摄入的内容和调试。",
    parameters: [
      {
        name: "corpus_id",
        in: "path",
        required: true,
        type: "string",
        description: "语料库 ID",
      },
      {
        name: "app_name",
        in: "query",
        required: false,
        type: "string",
        default: "agents",
        description: "应用名称",
      },
      {
        name: "limit",
        in: "query",
        required: false,
        type: "integer",
        default: 20,
        min: 1,
        max: 100,
        description: "返回数量限制",
      },
      {
        name: "offset",
        in: "query",
        required: false,
        type: "integer",
        default: 0,
        min: 0,
        description: "偏移量，用于分页",
      },
    ],
    responses: [
      {
        status: 200,
        description: "获取成功",
        schema: {
          type: "object",
          properties: {
            count: { type: "integer" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  content: { type: "string" },
                  source_uri: { type: "string" },
                  chunk_index: { type: "integer" },
                  created_at: { type: "string" },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
      },
      { status: 404, description: "语料库不存在" },
    ],
    examples: {
      curl: `curl "${BASE_URL}/knowledge/base/{corpus_id}/knowledge?limit=20&offset=0"`,
      python: `import requests

response = requests.get(
    "${BASE_URL}/knowledge/base/{corpus_id}/knowledge",
    params={"limit": 20, "offset": 0}
)
result = response.json()
print(f"Total: {result['count']} items")
for item in result['items']:
    print(f"- [{item['chunk_index']}] {item['content'][:50]}...")`,
      javascript: `const response = await fetch(
  '${BASE_URL}/knowledge/base/{corpus_id}/knowledge?limit=20&offset=0'
);

const result = await response.json();
console.log(\`Total: \${result.count} items\`);
result.items.forEach(item => {
  console.log(\`- [\${item.chunk_index}] \${item.content.slice(0, 50)}...\`);
});`,
    },
  },
  {
    id: "create_corpus",
    method: "POST",
    path: "/knowledge/base",
    summary: "创建语料库",
    description: "创建一个新的知识语料库。语料库是知识项的容器，支持独立的配置和隔离。",
    parameters: [
      {
        name: "app_name",
        in: "query",
        required: false,
        type: "string",
        default: "agents",
        description: "应用名称",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "语料库名称" },
          description: { type: "string", description: "语料库描述" },
          config: {
            type: "object",
            properties: {
              chunk_size: { type: "integer", default: 800 },
              overlap: { type: "integer", default: 100 },
              embedding_model: { type: "string", default: "text-embedding-3-small" },
            },
          },
        },
      },
      example: {
        name: "产品文档",
        description: "产品相关文档和知识",
        config: {
          chunk_size: 800,
          overlap: 100,
        },
      },
    },
    responses: [
      {
        status: 200,
        description: "创建成功",
        schema: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            knowledge_count: { type: "integer" },
            config: { type: "object" },
          },
        },
      },
      { status: 400, description: "参数验证失败" },
    ],
    examples: {
      curl: `curl -X POST "${BASE_URL}/knowledge/base" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "产品文档",
    "description": "产品相关文档和知识",
    "config": { "chunk_size": 800 }
  }'`,
      python: `import requests

response = requests.post(
    "${BASE_URL}/knowledge/base",
    json={
        "name": "产品文档",
        "description": "产品相关文档和知识",
        "config": {"chunk_size": 800}
    }
)
corpus = response.json()
print(f"Created corpus: {corpus['id']}")`,
      javascript: `const response = await fetch('${BASE_URL}/knowledge/base', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '产品文档',
    description: '产品相关文档和知识',
    config: { chunk_size: 800 }
  })
});

const corpus = await response.json();
console.log(\`Created corpus: \${corpus.id}\`);`,
    },
  },
  {
    id: "delete_corpus",
    method: "DELETE",
    path: "/knowledge/base/{corpus_id}",
    summary: "删除语料库",
    description: "删除指定的语料库及其所有知识项。此操作不可逆。",
    parameters: [
      {
        name: "corpus_id",
        in: "path",
        required: true,
        type: "string",
        description: "要删除的语料库 ID",
      },
    ],
    responses: [
      { status: 200, description: "删除成功" },
      { status: 404, description: "语料库不存在" },
    ],
    examples: {
      curl: `curl -X DELETE "${BASE_URL}/knowledge/base/{corpus_id}"`,
      python: `import requests

response = requests.delete("${BASE_URL}/knowledge/base/{corpus_id}")
if response.status_code == 200:
    print("Corpus deleted successfully")`,
      javascript: `const response = await fetch('${BASE_URL}/knowledge/base/{corpus_id}', {
  method: 'DELETE'
});

if (response.ok) {
  console.log('Corpus deleted successfully');
}`,
    },
  },
];

export function getEndpointById(id: string): ApiEndpoint | undefined {
  return KNOWLEDGE_API_ENDPOINTS.find((e) => e.id === id);
}

export function getMethodColor(method: HttpMethod): string {
  switch (method) {
    case "GET":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "POST":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "PATCH":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "DELETE":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
  }
}
