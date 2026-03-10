import { describe, expect, it } from "vitest";
import { parseSseStream } from "@/lib/agui/stream";

describe("parseSseStream", () => {
  it("兼容 CRLF 与多行 data", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              "event: message",
              'data: {"hello":',
              'data: "world"}',
              "",
            ].join("\r\n"),
          ),
        );
        controller.close();
      },
    });

    const frames = [];
    for await (const frame of parseSseStream(stream)) {
      frames.push(frame);
    }

    expect(frames).toEqual([
      {
        event: "message",
        data: '{"hello":\n"world"}',
      },
    ]);
  });
});

