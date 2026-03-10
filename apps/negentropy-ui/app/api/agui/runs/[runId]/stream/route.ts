import { EventType, type BaseEvent } from "@ag-ui/core";
import { safeParseSessionDetailResponse } from "@/lib/agui/session-schema";
import {
  AGUI_NDJSON_CONTENT_TYPE,
  createAguiEventFrame,
  createTransportErrorFrame,
  encodeNdjsonFrame,
  getCursorSequence,
} from "@/lib/agui/stream";
import { collectAdkEventPayloads } from "@/lib/adk";
import {
  buildSessionDetailUpstreamUrl,
  buildSessionUpstreamHeaders,
  getSessionAguiBaseUrl,
  parseSessionQueryScope,
} from "@/app/api/agui/sessions/_request";
import { parseSessionUpstreamJson } from "@/app/api/agui/sessions/_response";
import { hydrateSessionDetail } from "@/utils/session-hydration";
import { getEventRunId, getEventThreadId } from "@/types/agui";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 20;

function isTerminalEvent(event: BaseEvent): boolean {
  return event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function loadRunEvents(request: Request, runId: string, sessionId: string) {
  const baseUrl = getSessionAguiBaseUrl();
  if (baseUrl instanceof Response) {
    return baseUrl;
  }

  const scope = parseSessionQueryScope(request);
  if (scope instanceof Response) {
    return scope;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(
      buildSessionDetailUpstreamUrl(baseUrl, {
        appName: scope.appName,
        userId: scope.userId,
        sessionId,
      }),
      {
        method: "GET",
        headers: buildSessionUpstreamHeaders(request, "json-read"),
        cache: "no-store",
      },
    );
  } catch (error) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      `Upstream connection failed: ${String(error)}`,
    );
  }

  const parsed = await parseSessionUpstreamJson({
    upstreamResponse,
    parse: safeParseSessionDetailResponse,
    invalidPayloadMessage: "Invalid upstream session detail payload",
    invalidJsonMessage: "Invalid upstream session detail JSON",
  });
  if (parsed instanceof Response) {
    return parsed;
  }

  const { payloads } = collectAdkEventPayloads(parsed.data.events);
  const hydrated = hydrateSessionDetail(payloads, sessionId);
  return hydrated.events.filter(
    (event) =>
      getEventRunId(event) === runId &&
      (!("threadId" in event) || getEventThreadId(event) === sessionId),
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const cursor = url.searchParams.get("cursor");
  const resumeToken = url.searchParams.get("resume_token");
  if (!sessionId || !cursor || !resumeToken) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "session_id, cursor and resume_token are required",
    );
  }
  if (resumeToken !== cursor) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.BAD_REQUEST,
      "resume_token must match cursor",
    );
  }

  const { runId } = await params;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const textEncoder = new TextEncoder();
      const baseSequence = getCursorSequence(cursor);
      let emitted = 0;
      let closed = false;

      const emitFrame = (value: string) => {
        controller.enqueue(textEncoder.encode(value));
      };

      const emitEvents = (events: BaseEvent[]) => {
        events.forEach((event) => {
          emitted += 1;
          emitFrame(
            encodeNdjsonFrame(
              createAguiEventFrame({
                sessionId,
                threadId: getEventThreadId(event) || sessionId,
                runId,
                seq: baseSequence + emitted,
                event,
              }),
            ),
          );
        });
      };

      try {
        let lastSeenCount = baseSequence;
        for (let poll = 0; poll <= MAX_POLLS; poll += 1) {
          const runEvents = await loadRunEvents(request, runId, sessionId);
          if (runEvents instanceof Response) {
            emitted += 1;
            emitFrame(
              encodeNdjsonFrame(
                createTransportErrorFrame({
                  sessionId,
                  threadId: sessionId,
                  runId,
                  seq: baseSequence + emitted,
                  code: "SESSION_RESUME_ERROR",
                  message: await runEvents.text(),
                  terminal: true,
                }),
              ),
            );
            closed = true;
            controller.close();
            return;
          }

          const nextEvents = runEvents.slice(lastSeenCount);
          if (nextEvents.length > 0) {
            emitEvents(nextEvents);
            lastSeenCount += nextEvents.length;
            if (nextEvents.some(isTerminalEvent)) {
              closed = true;
              controller.close();
              return;
            }
          } else if (runEvents.some(isTerminalEvent)) {
            closed = true;
            controller.close();
            return;
          }

          if (poll < MAX_POLLS) {
            await sleep(POLL_INTERVAL_MS);
          }
        }
      } catch (error) {
        emitted += 1;
        emitFrame(
          encodeNdjsonFrame(
            createTransportErrorFrame({
              sessionId,
              threadId: sessionId,
              runId,
              seq: baseSequence + emitted,
              code: "SESSION_RESUME_STREAM_ERROR",
              message: String(error),
              terminal: false,
            }),
          ),
        );
      } finally {
        if (!closed) {
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": AGUI_NDJSON_CONTENT_TYPE,
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
