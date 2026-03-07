import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

describe("OverlayDismissLayer", () => {
  it("点击 backdrop 会触发关闭，点击内容区不会", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OverlayDismissLayer
        open
        onClose={onClose}
        backdropTestId="overlay-backdrop"
        contentTestId="overlay-content"
      >
        <button type="button">Inner Action</button>
      </OverlayDismissLayer>,
    );

    await user.click(screen.getByTestId("overlay-content"));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("overlay-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("busy 状态下点击 backdrop 不会触发关闭", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OverlayDismissLayer
        open
        onClose={onClose}
        busy
        backdropTestId="overlay-backdrop"
      >
        <div>Busy Content</div>
      </OverlayDismissLayer>,
    );

    await user.click(screen.getByTestId("overlay-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
