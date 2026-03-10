import type { BaseEvent } from "@ag-ui/core";

export const AGUI_NDJSON_CONTENT_TYPE = "application/x-ndjson";
export const AGUI_NDJSON_PROTOCOL = "negentropy.ndjson.v1";

export type AguiEventStreamFrame = {
  protocol: typeof AGUI_NDJSON_PROTOCOL;
  kind: "agui_event";
  sessionId: string;
  threadId: string;
  runId: string;
  cursor: string;
  resumeToken: string;
  event: BaseEvent;
};

export type AguiTransportErrorFrame = {
  protocol: typeof AGUI_NDJSON_PROTOCOL;
  kind: "transport_error";
  sessionId: string;
  threadId: string;
  runId: string;
  cursor: string;
  resumeToken: string;
  code: string;
  message: string;
  terminal: boolean;
};

export type AguiStreamFrame = AguiEventStreamFrame | AguiTransportErrorFrame;

export type SseEventFrame = {
  event?: string;
  data: string;
};

export function createCursor(runId: string, seq: number): string {
  return `${runId}:${seq}`;
}

export function getCursorSequence(cursor?: string | null): number {
  if (!cursor) {
    return 0;
  }
  const parts = cursor.split(":");
  const seq = Number(parts.at(-1));
  return Number.isFinite(seq) && seq > 0 ? seq : 0;
}

export function createAguiEventFrame(input: {
  sessionId: string;
  threadId: string;
  runId: string;
  seq: number;
  event: BaseEvent;
}): AguiEventStreamFrame {
  const cursor = createCursor(input.runId, input.seq);
  return {
    protocol: AGUI_NDJSON_PROTOCOL,
    kind: "agui_event",
    sessionId: input.sessionId,
    threadId: input.threadId,
    runId: input.runId,
    cursor,
    resumeToken: cursor,
    event: input.event,
  };
}

export function createTransportErrorFrame(input: {
  sessionId: string;
  threadId: string;
  runId: string;
  seq: number;
  code: string;
  message: string;
  terminal?: boolean;
}): AguiTransportErrorFrame {
  const cursor = createCursor(input.runId, input.seq);
  return {
    protocol: AGUI_NDJSON_PROTOCOL,
    kind: "transport_error",
    sessionId: input.sessionId,
    threadId: input.threadId,
    runId: input.runId,
    cursor,
    resumeToken: cursor,
    code: input.code,
    message: input.message,
    terminal: input.terminal === true,
  };
}

export function encodeNdjsonFrame(frame: AguiStreamFrame): string {
  return `${JSON.stringify(frame)}\n`;
}

function stripTrailingCarriageReturn(value: string): string {
  return value.endsWith("\r") ? value.slice(0, -1) : value;
}

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEventFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName: string | undefined;
  let dataLines: string[] = [];

  const flush = async function* () {
    if (dataLines.length === 0) {
      eventName = undefined;
      return;
    }
    const data = dataLines.join("\n");
    dataLines = [];
    const nextEvent: SseEventFrame = {
      data,
      ...(eventName ? { event: eventName } : {}),
    };
    eventName = undefined;
    yield nextEvent;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const line = stripTrailingCarriageReturn(rawLine);

        if (line === "") {
          yield* flush();
        } else if (!line.startsWith(":")) {
          const colonIndex = line.indexOf(":");
          const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
          let valuePart =
            colonIndex === -1 ? "" : line.slice(colonIndex + 1);
          if (valuePart.startsWith(" ")) {
            valuePart = valuePart.slice(1);
          }
          if (field === "event") {
            eventName = valuePart;
          } else if (field === "data") {
            dataLines.push(valuePart);
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      const line = stripTrailingCarriageReturn(buffer);
      if (line.startsWith("data:")) {
        let value = line.slice(5);
        if (value.startsWith(" ")) {
          value = value.slice(1);
        }
        dataLines.push(value);
      }
    }
    yield* flush();
  } finally {
    reader.releaseLock();
  }
}

export async function* parseNdjsonStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          yield JSON.parse(line) as unknown;
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const finalLine = buffer.trim();
    if (finalLine.length > 0) {
      yield JSON.parse(finalLine) as unknown;
    }
  } finally {
    reader.releaseLock();
  }
}

