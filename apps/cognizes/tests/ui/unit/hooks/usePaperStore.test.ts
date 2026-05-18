import { usePaperStore } from "@/store";
import type { Paper } from "@/types";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createPaper, createPapers } from "../../helpers/factory";

describe("usePaperStore", () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      usePaperStore.setState({
        papers: [],
        loading: false,
        error: null,
        filters: {
          search: "",
          category: "all",
          status: "all",
          sortBy: "uploadedAt",
          sortOrder: "desc",
        },
        selectedPapers: [],
        currentPaper: null,
      });
    });
  });

  describe("Initial State", () => {
    it("has correct initial state", () => {
      const { result } = renderHook(() => usePaperStore());

      expect(result.current.papers).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.filters.search).toBe("");
    });
  });

  describe("State Management", () => {
    it("can add papers to store", () => {
      const { result } = renderHook(() => usePaperStore());
      const testPaper = createPaper();

      act(() => {
        result.current.setPapers([testPaper]);
      });

      expect(result.current.papers).toHaveLength(1);
      expect(result.current.papers[0]).toEqual(testPaper);
    });

    it("can update loading state", () => {
      // modifying state directly for testing internal state changes not exposed by actions sometimes,
      // but here we can just verify the initial state or simulate a fetch (which we can't easily without mocking api).
      // We can use setState to simulate the loading state change if needed, or check if actions trigger it.
      // The store handles loading internally in fetchPapers.
      // Let's us setState to verify selector or state update logic.
      const { result } = renderHook(() => usePaperStore());

      act(() => {
        usePaperStore.setState({ loading: true });
      });

      expect(result.current.loading).toBe(true);
    });

    it("can set error state", () => {
      const { result } = renderHook(() => usePaperStore());
      const errorMessage = "Test error";

      act(() => {
        usePaperStore.setState({ error: errorMessage });
      });

      expect(result.current.error).toBe(errorMessage);
    });

    it("can handle multiple papers", () => {
      const { result } = renderHook(() => usePaperStore());
      const papers = createPapers(5);

      act(() => {
        result.current.setPapers(papers);
      });

      expect(result.current.papers).toHaveLength(5);
    });
  });

  describe("Search and Filter", () => {
    it("can set search term", () => {
      const { result } = renderHook(() => usePaperStore());

      act(() => {
        result.current.setFilters({ search: "Attention" });
      });

      expect(result.current.filters.search).toBe("Attention");
    });

    it("can set status filter", () => {
      const { result } = renderHook(() => usePaperStore());

      act(() => {
        result.current.setFilters({ status: "analyzed" });
      });

      expect(result.current.filters.status).toBe("analyzed");
    });
  });

  describe("Paper Selection", () => {
    it("can select papers", () => {
      const { result } = renderHook(() => usePaperStore());
      const papers = createPapers(3);

      act(() => {
        result.current.setPapers(papers);
      });

      act(() => {
        result.current.togglePaperSelection(papers[0].id);
        result.current.togglePaperSelection(papers[1].id);
      });

      expect(result.current.selectedPapers.includes(papers[0].id)).toBe(true);
      expect(result.current.selectedPapers.includes(papers[1].id)).toBe(true);
      expect(result.current.selectedPapers.includes(papers[2].id)).toBe(false);
    });

    it("can clear selection", () => {
      const { result } = renderHook(() => usePaperStore());
      const papers = createPapers(2);

      act(() => {
        result.current.setPapers(papers);
        // Manually set selection to simulate state
        usePaperStore.setState({
          selectedPapers: [papers[0].id, papers[1].id],
        });
      });

      act(() => {
        result.current.clearPaperSelection();
      });

      expect(result.current.selectedPapers.length).toBe(0);
    });

    it("can select all papers", () => {
      const { result } = renderHook(() => usePaperStore());
      const papers = createPapers(3);

      act(() => {
        result.current.setPapers(papers);
      });

      act(() => {
        result.current.selectAllPapers();
      });

      expect(result.current.selectedPapers.length).toBe(3);
      expect(result.current.selectedPapers.includes(papers[0].id)).toBe(true);
      expect(result.current.selectedPapers.includes(papers[1].id)).toBe(true);
      expect(result.current.selectedPapers.includes(papers[2].id)).toBe(true);
    });
  });

  describe("CRUD Operations", () => {
    it("can add a paper directly to store", () => {
      const { result } = renderHook(() => usePaperStore());
      const newPaper = createPaper();

      act(() => {
        result.current.addPaper(newPaper);
      });

      expect(result.current.papers).toContainEqual(newPaper);
    });

    it("can update a paper in store", () => {
      const { result } = renderHook(() => usePaperStore());
      const paper = createPaper({ id: "update-test", status: "uploaded" });

      act(() => {
        result.current.setPapers([paper]);
      });

      act(() => {
        result.current.updatePaper("update-test", { status: "analyzed" });
      });

      const updatedPaper = result.current.papers.find(
        (p: Paper) => p.id === "update-test"
      );
      expect(updatedPaper?.status).toBe("analyzed");
    });

    it("can delete a paper from store", () => {
      const { result } = renderHook(() => usePaperStore());
      const paper = createPaper({ id: "delete-test" });

      act(() => {
        result.current.setPapers([paper]);
      });

      act(() => {
        result.current.removePaper("delete-test");
      });

      expect(result.current.papers).not.toContainEqual(
        expect.objectContaining({ id: "delete-test" })
      );
    });
  });
});
