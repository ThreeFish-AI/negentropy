import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

import KnowledgeEntryPage from "@/app/knowledge/page";

describe("KnowledgeEntryPage", () => {
  it("将 /knowledge 统一重定向到 /knowledge/base", () => {
    KnowledgeEntryPage();

    expect(redirectMock).toHaveBeenCalledWith("/knowledge/base");
  });
});
