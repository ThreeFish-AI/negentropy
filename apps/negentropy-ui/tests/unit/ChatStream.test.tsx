import { render, screen } from "@testing-library/react";
import { ChatStream } from "../../components/ui/ChatStream";

describe("ChatStream", () => {
  it("renders placeholder when empty", () => {
    render(<ChatStream messages={[]} />);
    expect(screen.getByText("发送指令开始对话。事件流将实时展示在右侧。"))
      .toBeInTheDocument();
  });

  it("renders messages", () => {
    render(
      <ChatStream
        messages={[
          { id: "1", role: "user", content: "hi" },
          { id: "2", role: "assistant", content: "hello" },
        ]}
      />
    );
    expect(screen.getByText("hi")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
