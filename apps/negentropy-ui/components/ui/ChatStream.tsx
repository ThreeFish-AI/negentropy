import { MessageBubble } from "./MessageBubble";
import type { Message } from "@ag-ui/core";

type ChatMessage = Pick<Message, "id" | "role"> & {
  content: string;
};

type ChatStreamProps = {
  messages: ChatMessage[];
};

export function ChatStream({ messages }: ChatStreamProps) {
  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          发送指令开始对话。事件流将实时展示在右侧。
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
      )}
    </div>
  );
}
