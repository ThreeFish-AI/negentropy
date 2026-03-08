import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import MemoryAutomationPage from "@/app/memory/automation/page";

const fetchMemoryAutomation = vi.fn();
const fetchMemoryAutomationLogs = vi.fn();

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { roles: ["admin"] },
    status: "authenticated",
  }),
}));

vi.mock("@/components/ui/MemoryNav", () => ({
  MemoryNav: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/features/memory", () => ({
  fetchMemoryAutomation: (...args: unknown[]) => fetchMemoryAutomation(...args),
  fetchMemoryAutomationLogs: (...args: unknown[]) => fetchMemoryAutomationLogs(...args),
  updateMemoryAutomationConfig: vi.fn(),
  triggerMemoryAutomationJobAction: vi.fn(),
  runMemoryAutomationJob: vi.fn(),
}));

describe("MemoryAutomationPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchMemoryAutomation.mockResolvedValue({
      capabilities: {
        pg_cron_installed: true,
        pg_cron_available: false,
        pg_cron_logs_accessible: false,
        management_mode: "backend-managed",
        degraded_reasons: ["pg_cron_unavailable"],
      },
      config: {
        retention: {
          decay_lambda: 0.1,
          low_retention_threshold: 0.1,
          min_age_days: 7,
          auto_cleanup_enabled: true,
          cleanup_schedule: "0 2 * * *",
        },
        consolidation: {
          enabled: true,
          schedule: "0 * * * *",
          lookback_interval: "1 hour",
        },
        context_assembler: {
          max_tokens: 4000,
          memory_ratio: 0.3,
          history_ratio: 0.5,
        },
      },
      processes: [],
      functions: [],
      jobs: [
        {
          job_key: "cleanup_memories",
          process_label: "Ebbinghaus Cleanup",
          function_name: "cleanup_low_value_memories",
          enabled: true,
          status: "degraded",
          job_id: null,
          schedule: "0 2 * * *",
          command: "SELECT 1",
          active: false,
        },
      ],
      health: {
        status: "degraded",
        recent_log_count: 0,
      },
    });
    fetchMemoryAutomationLogs.mockResolvedValue({ count: 0, items: [] });
  });

  it("pg_cron 不可用时将调度动作降级为只读", async () => {
    render(<MemoryAutomationPage />);

    await waitFor(() => {
      expect(screen.getByText(/pg_cron_unavailable/)).toBeInTheDocument();
    });

    expect(screen.getByText(/调度相关操作已降级为只读/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停用" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重建" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "手动触发" })).toBeDisabled();
  });
});
