import { render, screen } from "@testing-library/react";
import { ChatStream } from "../../components/ui/ChatStream";
import { AuthProvider } from "@/components/providers/AuthProvider";

// Mock AuthProvider for tests
vi.mock("@/components/providers/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
  useAuth: () => ({ user: null }),
}));

describe("ChatStream", () => {
  it("renders placeholder when empty", () => {
    render(
      <AuthProvider>
        <ChatStream messages={[]} />
      </AuthProvider>
    );
    expect(screen.getByText("发送指令开始对话。事件流将实时展示在右侧。"))
      .toBeInTheDocument();
  });

  it("renders messages", () => {
    render(
      <AuthProvider>
        <ChatStream
          messages={[
            { id: "1", role: "user", content: "hi" },
            { id: "2", role: "assistant", content: "hello" },
          ]}
        />
      </AuthProvider>
    );
    // MessageBubble uses ReactMarkdown which may render text in nested elements
    expect(screen.getByText((content) => content.includes("hi"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("hello"))).toBeInTheDocument();
  });
});
