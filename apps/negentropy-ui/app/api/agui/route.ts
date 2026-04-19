import { EventEncoder } from "@ag-ui/encoder";
import { BaseEvent, EventType } from "@ag-ui/core";
import {
  AdkMessageStreamNormalizer,
  collectAdkEventPayloads,
} from "@/lib/adk";
import {
  AGUI_NDJSON_CONTENT_TYPE,
  createAguiEventFrame,
  createTransportErrorFrame,
  encodeNdjsonFrame,
  parseSseStream,
} from "@/lib/agui/stream";
import { buildAuthHeaders } from "@/lib/sso";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";
import { normalizeAguiEvent, resolveEventRunAndThread } from "@/utils/agui-normalization";
import { getAguiBaseUrl } from "@/lib/server/backend-url";

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

function requestAcceptsNdjson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes(AGUI_NDJSON_CONTENT_TYPE);
}

function normalizeEvent(
  event: BaseEvent,
  threadId: string,
  runId: string,
): BaseEvent {
  return normalizeAguiEvent(
    resolveEventRunAndThread(event, {
      threadId,
      runId,
    }),
  );
}

export async function POST(request: Request) {
  const baseUrl = getAguiBaseUrl();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      `Invalid JSON body: ${String(error)}`,
    );
  }

  const url = new URL(request.url);
  const appName =
    url.searchParams.get("app_name") || (body.app_name as string) || "negentropy";
  const userId =
    url.searchParams.get("user_id") || (body.user_id as string) || "ui";
  const sessionId =
    url.searchParams.get("session_id") || (body.session_id as string);
  if (!sessionId) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "session_id is required",
    );
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(sessionId)) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "session_id must be a valid UUID",
    );
  }
  const resolvedThreadId =
    (typeof body.threadId === "string" && body.threadId.trim()) || sessionId;
  const resolvedRunId =
    (typeof body.runId === "string" && body.runId.trim()) ||
    crypto.randomUUID();

  const latestUserText = buildRunPayload(body);
  if (!latestUserText) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "RunAgentInput requires a user message",
    );
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
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream connection failed: ${String(error)}`,
    );
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    let detail = "Upstream returned non-OK status";
    try {
      detail = (await upstreamResponse.text()) || detail;
    } catch {
      // ignore
    }
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      detail,
    );
  }

  const acceptsNdjson = requestAcceptsNdjson(request);
  const eventEncoder = acceptsNdjson
    ? null
    : new EventEncoder({ accept: request.headers.get("accept") ?? "text/event-stream" });
  const textEncoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const normalizer = new AdkMessageStreamNormalizer();
      let sequence = 0;
      let terminalEventEmitted = false;

      const enqueueEvent = (event: BaseEvent) => {
        sequence += 1;
        if (acceptsNdjson) {
          const frame = createAguiEventFrame({
            sessionId,
            threadId: resolvedThreadId,
            runId: resolvedRunId,
            seq: sequence,
            event,
          });
          controller.enqueue(textEncoder.encode(encodeNdjsonFrame(frame)));
          return;
        }
        controller.enqueue(
          textEncoder.encode(eventEncoder!.encodeSSE(event)),
        );
      };

      const enqueueTransportError = (code: string, message: string, terminal = true) => {
        sequence += 1;
        if (acceptsNdjson) {
          terminalEventEmitted = terminal;
          controller.enqueue(
            textEncoder.encode(
              encodeNdjsonFrame(
                createTransportErrorFrame({
                  sessionId,
                  threadId: resolvedThreadId,
                  runId: resolvedRunId,
                  seq: sequence,
                  code,
                  message,
                  terminal,
                }),
              ),
            ),
          );
          return;
        }
        terminalEventEmitted = terminal;
        enqueueEvent({
          type: EventType.RUN_ERROR,
          threadId: resolvedThreadId,
          runId: resolvedRunId,
          timestamp: Date.now() / 1000,
          code,
          message,
        } as BaseEvent);
      };

      enqueueEvent({
        type: EventType.RUN_STARTED,
        threadId: resolvedThreadId,
        runId: resolvedRunId,
        timestamp: Date.now() / 1000,
      } as BaseEvent);

      try {
        for await (const sseEvent of parseSseStream(upstreamResponse.body!)) {
          const jsonText = sseEvent.data.trim();
          if (!jsonText) {
            continue;
          }

          try {
            const rawPayload = JSON.parse(jsonText) as unknown;
            const { payloads, invalidCount } = collectAdkEventPayloads(rawPayload);
            if (payloads.length === 0) {
              throw new Error("Invalid ADK event payload");
            }
            if (invalidCount > 0) {
              console.warn("Dropped invalid ADK payload fragments", {
                invalidCount,
              });
            }
            for (const payload of payloads) {
              const events = normalizer
                .consume(payload, {
                  threadId: resolvedThreadId,
                  runId: resolvedRunId,
                })
                .map((event) =>
                  normalizeEvent(event, resolvedThreadId, resolvedRunId),
                );
              for (const event of events) {
                enqueueEvent(event);
              }
            }
          } catch (error) {
            enqueueTransportError(
              "ADK_EVENT_PARSE_ERROR",
              `Failed to parse ADK event: ${String(error)}`,
              false,
            );
          }
        }
      } catch (error) {
        enqueueTransportError(
          "ADK_STREAM_ERROR",
          `Upstream stream error: ${String(error)}`,
        );
      } finally {
        const finalEvents = normalizer.flushRun(
          resolvedRunId,
          resolvedThreadId,
          Date.now() / 1000,
        );
        for (const event of finalEvents) {
          enqueueEvent(normalizeEvent(event, resolvedThreadId, resolvedRunId));
        }
        if (!terminalEventEmitted) {
          enqueueEvent({
            type: EventType.RUN_FINISHED,
            threadId: resolvedThreadId,
            runId: resolvedRunId,
            timestamp: Date.now() / 1000,
            result: "ok",
          } as BaseEvent);
        }
        controller.close();
      }
    },
  });

  const responseHeaders = new Headers({
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": acceptsNdjson
      ? AGUI_NDJSON_CONTENT_TYPE
      : eventEncoder!.getContentType(),
  });

  return new Response(stream, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
