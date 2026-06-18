/**
 * Knowledge / Documents 页 Translate 交互单测。
 *
 * 覆盖：
 * 1. 勾选资格：markdown 未就绪 / 自身是译文 → checkbox disabled；
 * 2. 勾选后 Translate (N) 按钮 → POST payload 契约 → 行内置 Translating…；
 * 3. Translation 列：译文行显示「译文」badge；processing 行显示 spinner。
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/knowledge/documents",
}));

// KnowledgeNav 依赖 NavigationProvider 上下文，与本测试无关 → 桩化
vi.mock("@/components/ui/KnowledgeNav", () => ({
  KnowledgeNav: ({ title }: { title: string }) => <div>{title}</div>,
}));

import DocumentsPage from "@/app/knowledge/documents/page";

const TRANSLATABLE_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_ID = "22222222-2222-4222-8222-222222222222";
const TRANSLATED_ID = "33333333-3333-4333-8333-333333333333";
const CORPUS_ID = "99999999-9999-4999-8999-999999999999";

function makeDoc(overrides: Record<string, unknown>) {
  return {
    id: TRANSLATABLE_ID,
    corpus_id: CORPUS_ID,
    app_name: "negentropy",
    file_hash: "abcdef1234567890",
    original_filename: "guide.md",
    gcs_uri: "gs://bucket/guide.md",
    content_type: "text/markdown",
    file_size: 1024,
    status: "active",
    created_at: new Date().toISOString(),
    created_by: "tester@example.com",
    markdown_extract_status: "completed",
    metadata: {},
    ...overrides,
  };
}

const DOCUMENTS = [
  makeDoc({ id: TRANSLATABLE_ID, original_filename: "guide.md" }),
  makeDoc({
    id: PENDING_ID,
    original_filename: "pending.pdf",
    markdown_extract_status: "pending",
  }),
  makeDoc({
    id: TRANSLATED_ID,
    original_filename: "guide.zh.md",
    metadata: {
      translated_from_document_id: TRANSLATABLE_ID,
      translated_from_filename: "guide.md",
    },
  }),
];

let translateCalls: unknown[];

beforeEach(() => {
  translateCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.startsWith("/api/knowledge/documents/translate")) {
        translateCalls.push(JSON.parse(String(init?.body)));
        return {
          ok: true,
          status: 200,
          json: async () => ({ accepted: [TRANSLATABLE_ID], skipped: [], status: "running" }),
        } as Response;
      }
      if (href.startsWith("/api/knowledge/documents")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ count: DOCUMENTS.length, items: DOCUMENTS }),
        } as Response;
      }
      if (href.startsWith("/api/knowledge/base")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: CORPUS_ID, name: "Demo Corpus" }],
        } as Response;
      }
      throw new Error(`unexpected fetch: ${href}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DocumentsPage Translate", () => {
  it("勾选资格：未就绪 / 译文行 checkbox disabled，译文行显示「译文」badge", async () => {
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByText("guide.md")).toBeInTheDocument());

    const checkboxes = screen.getAllByRole("checkbox");
    // [0] 表头全选 + 3 行
    expect(checkboxes).toHaveLength(4);
    expect(checkboxes[1]).not.toBeDisabled(); // guide.md 可译
    expect(checkboxes[2]).toBeDisabled(); // pending.pdf markdown 未就绪
    expect(checkboxes[3]).toBeDisabled(); // guide.zh.md 自身是译文

    expect(screen.getByText("译文")).toBeInTheDocument();
  });

  it("勾选 → Translate (1) → POST payload 契约 → 行内 Translating…", async () => {
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByText("guide.md")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    const button = screen.getByRole("button", { name: /Translate \(1\)/ });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    await waitFor(() => expect(translateCalls).toHaveLength(1));
    expect(translateCalls[0]).toMatchObject({
      document_ids: [TRANSLATABLE_ID],
      app_name: "negentropy",
      target_language: "zh",
    });

    // accepted 行本地置 processing → Translating…
    await waitFor(() => expect(screen.getByText("Translating…")).toBeInTheDocument());
  });

  it("无勾选时 Translate 按钮 disabled", async () => {
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByText("guide.md")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /^Translate$/ })).toBeDisabled();
  });
});
