import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
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

  it("Escape 仅触发顶层 layer 的 onClose（嵌套场景不会牵连外层）", async () => {
    const user = userEvent.setup();
    const onCloseOuter = vi.fn();
    const onCloseInner = vi.fn();

    function Stacked() {
      const [innerOpen, setInnerOpen] = useState(false);
      return (
        <OverlayDismissLayer open onClose={onCloseOuter} contentTestId="outer">
          <button type="button" onClick={() => setInnerOpen(true)}>
            Open Inner
          </button>
          {innerOpen && (
            <OverlayDismissLayer
              open
              onClose={() => {
                onCloseInner();
                setInnerOpen(false);
              }}
              contentTestId="inner"
            >
              <div>Inner</div>
            </OverlayDismissLayer>
          )}
        </OverlayDismissLayer>
      );
    }

    render(<Stacked />);
    await user.click(screen.getByRole("button", { name: "Open Inner" }));
    await user.keyboard("{Escape}");
    expect(onCloseInner).toHaveBeenCalledTimes(1);
    expect(onCloseOuter).not.toHaveBeenCalled();

    // Inner closed; subsequent Escape should now hit the outer.
    await user.keyboard("{Escape}");
    expect(onCloseOuter).toHaveBeenCalledTimes(1);
  });

  it("Escape 阻止同窗口上后续注册的外部 keydown 监听器（避免重复 onClose）", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const externalSpy = vi.fn();

    function Harness() {
      useEffect(() => {
        const handler = (event: KeyboardEvent) => {
          if (event.key === "Escape") externalSpy();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
      }, []);
      return (
        <OverlayDismissLayer open onClose={onClose} contentTestId="overlay-content">
          <div>Inner</div>
        </OverlayDismissLayer>
      );
    }

    render(<Harness />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(externalSpy).not.toHaveBeenCalled();
  });

  it("closeOnEscape=false 时 Escape 不触发关闭", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OverlayDismissLayer open onClose={onClose} closeOnEscape={false} contentTestId="overlay-content">
        <div>Inner</div>
      </OverlayDismissLayer>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("busy 状态下 Escape 不触发关闭", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <OverlayDismissLayer open onClose={onClose} busy contentTestId="overlay-content">
        <div>Inner</div>
      </OverlayDismissLayer>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});
