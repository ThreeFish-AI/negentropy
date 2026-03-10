import { AbstractAgent, type AgentSubscriber, type RunAgentParameters } from "@ag-ui/client";
import type { BaseEvent, Message, RunAgentInput, State } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import { Observable } from "rxjs";
import { safeParseBaseEvent } from "@/lib/agui/schema";
import {
  AGUI_NDJSON_CONTENT_TYPE,
  AGUI_NDJSON_PROTOCOL,
  type AguiStreamFrame,
  parseNdjsonStream,
} from "@/lib/agui/stream";

type NdjsonHttpAgentConfig = {
  url: string;
  headers?: Record<string, string>;
  agentId?: string;
  description?: string;
  threadId?: string;
  initialMessages?: Message[];
  initialState?: State;
  debug?: boolean;
};

type RunNdjsonHttpAgentConfig = RunAgentParameters & {
  abortController?: AbortController;
};

const RESUME_DELAYS_MS = [500, 1500, 3500];

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isTerminalEvent(event: BaseEvent): boolean {
  return event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR;
}

export class NdjsonHttpAgent extends AbstractAgent {
  url: string;
  headers: Record<string, string>;
  abortController: AbortController;

  constructor(config: NdjsonHttpAgentConfig) {
    super(config);
    this.url = config.url;
    this.headers = { ...(config.headers ?? {}) };
    this.abortController = new AbortController();
  }

  protected requestInit(input: RunAgentInput): RequestInit {
    return {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
        Accept: AGUI_NDJSON_CONTENT_TYPE,
      },
      body: JSON.stringify(input),
      signal: this.abortController.signal,
    };
  }

  runAgent(parameters?: RunNdjsonHttpAgentConfig, subscriber?: AgentSubscriber) {
    this.abortController = parameters?.abortController ?? new AbortController();
    return super.runAgent(parameters, subscriber);
  }

  abortRun() {
    this.abortController.abort();
    super.abortRun();
  }

  private buildResumeUrl(runId: string, cursor: string, resumeToken: string): string {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const current = new URL(this.url, base);
    const path = `/api/agui/runs/${encodeURIComponent(runId)}/stream`;
    const resumeUrl = new URL(path, current.origin);
    current.searchParams.forEach((value, key) => {
      resumeUrl.searchParams.set(key, value);
    });
    const sessionId =
      current.searchParams.get("session_id") || this.threadId || "pending";
    resumeUrl.searchParams.set("session_id", sessionId);
    resumeUrl.searchParams.set("cursor", cursor);
    resumeUrl.searchParams.set("resume_token", resumeToken);
    return resumeUrl.toString();
  }

  private async consumeResponse(
    response: Response,
    next: (event: BaseEvent) => void,
    signal: AbortSignal,
    state: {
      cursor: string | null;
      resumeToken: string | null;
      terminalSeen: boolean;
    },
  ) {
    if (!response.ok || !response.body) {
      throw new Error((await response.text()) || "Upstream returned non-OK status");
    }

    for await (const entry of parseNdjsonStream(response.body)) {
      if (signal.aborted) {
        throw signal.reason ?? new Error("Aborted");
      }
      const frame = entry as Partial<AguiStreamFrame>;
      if (frame.protocol !== AGUI_NDJSON_PROTOCOL || typeof frame.kind !== "string") {
        continue;
      }

      if (typeof frame.cursor === "string") {
        state.cursor = frame.cursor;
      }
      if (typeof frame.resumeToken === "string") {
        state.resumeToken = frame.resumeToken;
      }

      if (frame.kind === "transport_error") {
        if (frame.terminal === true) {
          const errorEvent: BaseEvent = {
            type: EventType.RUN_ERROR,
            threadId: typeof frame.threadId === "string" ? frame.threadId : this.threadId,
            runId: typeof frame.runId === "string" ? frame.runId : "",
            timestamp: Date.now() / 1000,
            message: typeof frame.message === "string" ? frame.message : "Transport error",
            code: typeof frame.code === "string" ? frame.code : "NDJSON_TRANSPORT_ERROR",
          } as BaseEvent;
          state.terminalSeen = true;
          next(errorEvent);
          return;
        }
        return;
      }

      if (frame.kind !== "agui_event") {
        continue;
      }
      const parsedEvent = safeParseBaseEvent(frame.event);
      if (!parsedEvent.success) {
        continue;
      }

      next(parsedEvent.data);
      if (isTerminalEvent(parsedEvent.data)) {
        state.terminalSeen = true;
      }
    }
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const signal = this.abortController.signal;
      const state = {
        cursor: null as string | null,
        resumeToken: null as string | null,
        terminalSeen: false,
      };

      const execute = async () => {
        await this.consumeResponse(
          await fetch(this.url, this.requestInit(input)),
          (event) => subscriber.next(event),
          signal,
          state,
        );

        if (state.terminalSeen || !state.cursor || !state.resumeToken) {
          subscriber.complete();
          return;
        }

        for (const delay of RESUME_DELAYS_MS) {
          await sleep(delay, signal);
          const resumeResponse = await fetch(
            this.buildResumeUrl(input.runId, state.cursor, state.resumeToken),
            {
              method: "GET",
              headers: {
                ...this.headers,
                Accept: AGUI_NDJSON_CONTENT_TYPE,
              },
              signal,
              cache: "no-store",
            },
          );
          await this.consumeResponse(
            resumeResponse,
            (event) => subscriber.next(event),
            signal,
            state,
          );
          if (state.terminalSeen) {
            subscriber.complete();
            return;
          }
        }

        subscriber.next({
          type: EventType.RUN_ERROR,
          threadId: input.threadId,
          runId: input.runId,
          timestamp: Date.now() / 1000,
          message: "NDJSON stream ended before terminal event and resume attempts were exhausted",
          code: "NDJSON_STREAM_INCOMPLETE",
        } as BaseEvent);
        subscriber.complete();
      };

      void execute().catch((error) => {
        subscriber.error(error);
      });

      return () => {
        this.abortController.abort();
      };
    });
  }

  clone(): NdjsonHttpAgent {
    const clone = new NdjsonHttpAgent({
      url: this.url,
      headers: { ...this.headers },
      agentId: this.agentId,
      description: this.description,
      threadId: this.threadId,
      debug: this.debug,
    });
    if (this.abortController.signal.aborted) {
      clone.abortController.abort(this.abortController.signal.reason);
    }
    return clone;
  }
}
