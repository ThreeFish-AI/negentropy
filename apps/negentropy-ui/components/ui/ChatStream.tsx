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
          <div key={message.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-400">
              {message.role}
            </div>
            <p className="text-sm leading-relaxed text-zinc-800">{message.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
