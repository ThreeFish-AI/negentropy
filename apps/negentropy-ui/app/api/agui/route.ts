import { EventEncoder } from "@ag-ui/encoder";
import { BaseEvent, EventType } from "@ag-ui/core";
import { NextResponse } from "next/server";
import { AdkEventPayload, adkEventToAguiEvents } from "@/lib/adk";
import { buildAuthHeaders } from "@/lib/sso";

function getBaseUrl() {
  return process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
}

function extractForwardHeaders(request: Request) {
  const headers = buildAuthHeaders(request);

  const auth = request.headers.get("authorization");
  if (auth) {
    headers.set("authorization", auth);
  }

  const sessionId = request.headers.get("x-session-id");
  if (sessionId) {
    headers.set("x-session-id", sessionId);
  }

  const userId = request.headers.get("x-user-id");
  if (userId) {
    headers.set("x-user-id", userId);
  }

  return headers;
}

function errorResponse(code: string, message: string, status = 500) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

function buildRunPayload(input: Record<string, unknown>) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const lastUser = [...messages]
    .reverse()
    .find((message) => (message as { role?: string }).role === "user") as
    | { content?: string }
    | undefined;
  const content =
    typeof lastUser?.content === "string" ? lastUser?.content.trim() : "";

  return content;
}

export async function POST(request: Request) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("AGUI_INTERNAL_ERROR", "AGUI_BASE_URL is not configured", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return errorResponse("AGUI_BAD_REQUEST", `Invalid JSON body: ${String(error)}`, 400);
  }

  const url = new URL(request.url);
  const appName = url.searchParams.get("app_name") || (body.app_name as string) || "agents";
  const userId = url.searchParams.get("user_id") || (body.user_id as string) || "ui";
  const sessionId = url.searchParams.get("session_id") || (body.session_id as string);
  if (!sessionId) {
    return errorResponse("AGUI_BAD_REQUEST", "session_id is required", 400);
  }
  const resolvedThreadId =
    (typeof body.threadId === "string" && body.threadId.trim()) ||
    sessionId;
  const resolvedRunId =
    (typeof body.runId === "string" && body.runId.trim()) ||
    crypto.randomUUID();

  const latestUserText = buildRunPayload(body);
  if (!latestUserText) {
    return errorResponse("AGUI_BAD_REQUEST", "RunAgentInput requires a user message", 400);
  }

  const headers = extractForwardHeaders(request);
  headers.set("content-type", "application/json");
  headers.set("accept", "text/event-stream");

  let upstreamResponse: Response;
  try {
    const upstreamUrl = new URL("/run_sse", baseUrl);
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        app_name: appName,
        user_id: userId,
        session_id: sessionId,
        new_message: {
          role: "user",
          parts: [{ text: latestUserText }],
        },
        streaming: true,
        metadata: {
          client_run_id: body.runId,
          client_thread_id: body.threadId,
        },
      }),
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse("AGUI_UPSTREAM_ERROR", `Upstream connection failed: ${String(error)}`, 502);
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return errorResponse("AGUI_UPSTREAM_ERROR", "Upstream returned non-OK status", upstreamResponse.status);
  }

  const accept = request.headers.get("accept") ?? "text/event-stream";
  const eventEncoder = new EventEncoder({ accept });
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  const upstreamReader = upstreamResponse.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const runStart: BaseEvent = {
        type: EventType.RUN_STARTED,
        threadId: resolvedThreadId,
        runId: resolvedRunId,
        timestamp: Date.now() / 1000,
      };
      controller.enqueue(textEncoder.encode(eventEncoder.encodeSSE(runStart)));

      let buffer = "";
      try {
        while (true) {
          const { value, done } = await upstreamReader.read();
          if (done) {
            break;
          }
          buffer += textDecoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            const lines = chunk.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) {
                continue;
              }
              const jsonText = trimmed.replace(/^data:\s*/, "");
              if (!jsonText) {
                continue;
              }
              try {
                const parsed = JSON.parse(jsonText) as AdkEventPayload;
                const events = adkEventToAguiEvents(parsed).map((event) => ({
                  ...event,
                  threadId: "threadId" in event ? event.threadId : resolvedThreadId,
                  runId: "runId" in event ? event.runId : resolvedRunId,
                }));
                for (const event of events) {
                  controller.enqueue(textEncoder.encode(eventEncoder.encodeSSE(event)));
                }
              } catch (error) {
                const errEvent: BaseEvent = {
                  type: EventType.RUN_ERROR,
                  threadId: resolvedThreadId,
                  runId: resolvedRunId,
                  message: `Failed to parse ADK event: ${String(error)}`,
                  code: "ADK_EVENT_PARSE_ERROR",
                  timestamp: Date.now() / 1000,
                };
                controller.enqueue(textEncoder.encode(eventEncoder.encodeSSE(errEvent)));
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (error) {
        const errEvent: BaseEvent = {
          type: EventType.RUN_ERROR,
          threadId: resolvedThreadId,
          runId: resolvedRunId,
          message: `Upstream stream error: ${String(error)}`,
          code: "ADK_STREAM_ERROR",
          timestamp: Date.now() / 1000,
        };
        controller.enqueue(textEncoder.encode(eventEncoder.encodeSSE(errEvent)));
      } finally {
        const runFinish: BaseEvent = {
          type: EventType.RUN_FINISHED,
          threadId: resolvedThreadId,
          runId: resolvedRunId,
          timestamp: Date.now() / 1000,
          result: "ok",
        };
        controller.enqueue(textEncoder.encode(eventEncoder.encodeSSE(runFinish)));
        controller.close();
      }
    },
  });

  const responseHeaders = new Headers({
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": eventEncoder.getContentType(),
  });

  return new Response(stream, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
