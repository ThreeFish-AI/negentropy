import { Page } from "@playwright/test";
import papersData from "../fixtures/papers.json";

export async function setupMockApi(page: Page) {
  // Helper to get fresh copy of data for each test
  // Helper to get fresh copy of data for each test
  let dbPapers = JSON.parse(JSON.stringify(papersData));

  // Handle all API requests
  // Use Regex to match any URL containing /api/papers
  await page.route(/\/api\/papers.*/, async (route) => {
    console.log("Mock API hit:", route.request().url());
    const request = route.request();
    const url = new URL(request.url());

    // Skip specific sub-paths if handled elsewhere (e.g. batch-process)
    // But since order matters in Playwright (last registered matching route handles it?? No, inverse order usually, or first matching? "Routes are matched in the order they are registered.")
    // Playwright docs: "When multiple routes match the URL, the handler of the matching route that was registered LAST is used."
    // So general route should be registered first.

    const method = request.method();

    // GET /api/papers (List)
    if (method === "GET" && url.pathname === "/api/papers") {
      console.log("Mocking GET papers list");
      const search =
        url.searchParams.get("search") || url.searchParams.get("q");
      const status = url.searchParams.get("status");
      const category = url.searchParams.get("category");
      const pageNum = Number(url.searchParams.get("page")) || 1;
      const limit = Number(url.searchParams.get("limit")) || 20;

      let filtered = [...dbPapers];

      // Apply Search
      if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.title.toLowerCase().includes(lowerSearch) ||
            p.abstract.toLowerCase().includes(lowerSearch) ||
            (p.translation?.title &&
              p.translation.title.toLowerCase().includes(lowerSearch))
        );
      }

      // Apply Filters
      if (category && category !== "all") {
        filtered = filtered.filter((p) => p.category === category);
      }
      if (status && status !== "all") {
        filtered = filtered.filter((p) => p.status === status);
      }

      // Pagination
      const total = filtered.length;
      const start = (pageNum - 1) * limit;
      const paginated = filtered.slice(start, start + limit);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          items: paginated,
          total,
          page: pageNum,
          limit,
          totalPages: Math.ceil(total / limit),
        }),
      });
      return;
    }

    // Single item operations (Detail, Process, Delete)
    const detailMatch = url.pathname.match(/\/api\/papers\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      const id = detailMatch[1];
      console.log("Mocking GET paper detail for ID:", id);
      const p = dbPapers.find((x: any) => x.id === id);
      if (p) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: p }),
        });
      } else {
        await route.fulfill({ status: 404 });
      }
      return;
    }

    if (detailMatch && method === "DELETE") {
      const id = detailMatch[1];
      console.log("Mocking DELETE paper for ID:", id);
      dbPapers = dbPapers.filter((p) => p.id !== id);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    const processMatch = url.pathname.match(/\/api\/papers\/([^/]+)\/process$/);
    if (processMatch && method === "POST") {
      const id = processMatch[1];
      console.log("Mocking POST process paper for ID:", id);
      const p = dbPapers.find((x) => x.id === id);
      if (p) p.status = "processing";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, task_id: "task-" + Date.now() }),
      });
      return;
    }

    // Upload paper
    if (method === "POST" && url.pathname === "/api/papers") {
      console.log("Mocking POST upload paper");
      // ... same logic as before
      const newPaper = {
        ...papersData[0],
        id: String(Date.now()),
        title: "New Uploaded Paper",
        translation: null,
        status: "uploaded",
        uploadedAt: new Date().toISOString(),
      };
      dbPapers.unshift(newPaper);
      console.log(
        "Mocking POST upload paper. new dbPapers count:",
        dbPapers.length
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: newPaper,
          task_id: "task-" + Date.now(),
        }),
      });
      return;
    }

    // Batch process
    if (method === "POST" && url.pathname === "/api/papers/batch-process") {
      console.log("Mocking POST batch process");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          task_id: "batch-task-" + Date.now(),
        }),
      });
      return;
    }

    console.log("Mock API Fallback - 404 for:", method, url.pathname);
    await route.fulfill({
      status: 404,
      body: JSON.stringify({ message: "Mock API Fallback 404" }),
    });
  });
}
