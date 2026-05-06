import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useConfirmDialog } from "@/components/ui/useConfirmDialog";

function ConfirmHarness({ onResult }: { onResult: (value: boolean) => void }) {
  const { confirm, confirmDialog } = useConfirmDialog();

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          onResult(
            await confirm({
              title: "Delete item",
              message: "This action cannot be undone.",
              confirmLabel: "Delete",
              destructive: true,
            }),
          );
        }}
      >
        Open confirm
      </button>
      {confirmDialog}
    </>
  );
}

describe("useConfirmDialog", () => {
  it("resolves true after custom dialog confirmation", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<ConfirmHarness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Open confirm" }));

    expect(screen.getByRole("dialog", { name: "Delete item" })).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog", { name: "Delete item" })).not.toBeInTheDocument();
  });

  it("resolves false after cancellation", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<ConfirmHarness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Open confirm" }));
    await user.click(screen.getByTestId("confirm-dialog-cancel"));

    expect(onResult).toHaveBeenCalledWith(false);
  });
});
