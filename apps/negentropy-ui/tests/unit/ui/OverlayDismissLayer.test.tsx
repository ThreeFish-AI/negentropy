import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

describe("OverlayDismissLayer", () => {
  it("点击内容区外空白会触发关闭，点击内容区不会", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OverlayDismissLayer
        open
        onClose={onClose}
        containerClassName="flex min-h-screen items-center justify-center p-4"
        backdropTestId="overlay-backdrop"
        contentTestId="overlay-content"
      >
        <button type="button">Inner Action</button>
      </OverlayDismissLayer>,
    );

    await user.click(screen.getByTestId("overlay-content"));
    expect(onClose).not.toHaveBeenCalled();

    const container = screen.getByTestId("overlay-content").parentElement;
    expect(container).not.toBeNull();

    await user.click(container!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("busy 状态下点击内容区外空白不会触发关闭", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OverlayDismissLayer
        open
        onClose={onClose}
        busy
        containerClassName="flex min-h-screen items-center justify-center p-4"
        contentTestId="overlay-content"
      >
        <div>Busy Content</div>
      </OverlayDismissLayer>,
    );

    const container = screen.getByTestId("overlay-content").parentElement;
    expect(container).not.toBeNull();

    await user.click(container!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("点击 backdrop 仍会触发关闭", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OverlayDismissLayer open onClose={onClose} backdropTestId="overlay-backdrop">
        <div>Overlay Content</div>
      </OverlayDismissLayer>,
    );

    await user.click(screen.getByTestId("overlay-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
