import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Fixtures Verification", () => {
  it("papers.json should match Paper interface", () => {
    // __dirname is the directory of the test file: tests/ui/unit
    const papersPath = path.resolve(__dirname, "../fixtures/papers.json");

    if (!fs.existsSync(papersPath)) {
      // Fallback or debug info
      console.error(`File not found at: ${papersPath}`);
      // Try absolute path if needed, but relative should work
      throw new Error(`File not found: ${papersPath}`);
    }

    const papers = JSON.parse(fs.readFileSync(papersPath, "utf-8"));

    papers.forEach((paper: any) => {
      // Check required fields based on Paper interface
      expect(paper.id).toBeDefined();
      expect(paper.title).toBeDefined();
      expect(paper.authors).toBeInstanceOf(Array);
      expect(paper.category).toBeDefined();
      expect(paper.status).toBeDefined();

      // Critical fields for the bug fix
      expect(paper.uploadedAt).toBeDefined();
      expect(paper.updatedAt).toBeDefined();
      expect(paper.fileName).toBeDefined();
      expect(paper.fileSize).toBeDefined();

      // Verify date validity to prevent RangeError
      const uploadDate = new Date(paper.uploadedAt);
      expect(uploadDate.toString()).not.toBe("Invalid Date");
      expect(!isNaN(uploadDate.getTime())).toBe(true);

      const updateDate = new Date(paper.updatedAt);
      expect(updateDate.toString()).not.toBe("Invalid Date");
    });
  });
});
