import { createHmac } from "node:crypto";

/**
 * Self-signed dev session cookie for local browser validation.
 *
 * Mirrors `apps/negentropy/src/negentropy/auth/tokens.py:_b64encode/_sign/encode_token`
 * byte-for-byte:
 * - JSON: `json.dumps(payload, separators=(",", ":"), sort_keys=True)` — recursive key sort, no whitespace
 * - base64url, padding stripped
 * - HMAC-SHA256(secret_utf8, encoded_payload_utf8)
 * - Final token: `<encoded_payload>.<signature>`
 *
 * Backend decode path: `auth/service.py:_build_session_token` → `decode_token`.
 */

export const DEV_COOKIE_NAME = "ne_sso";

export interface SessionPayload {
  typ: "session";
  iat: number;
  exp: number;
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  roles: string[];
  provider: string;
  subject: string;
  domain: string | null;
}

export interface AdminPayloadOptions {
  email?: string;
  sub?: string;
  name?: string;
  picture?: string | null;
  roles?: string[];
  provider?: string;
  domain?: string | null;
  ttlSeconds?: number;
  iat?: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url").replace(/=+$/u, "");
}

/**
 * Recursively sort object keys so the JSON output matches Python's
 * `json.dumps(sort_keys=True)` byte-for-byte at every nesting level.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

export function canonicalJSON(payload: unknown): string {
  return JSON.stringify(canonicalize(payload));
}

export function signDevSessionCookie(payload: SessionPayload, secret: string): string {
  if (!secret) {
    throw new Error("token secret is required");
  }
  const json = canonicalJSON(payload);
  const encoded = base64UrlEncode(Buffer.from(json, "utf-8"));
  const signature = base64UrlEncode(
    createHmac("sha256", Buffer.from(secret, "utf-8")).update(encoded, "utf-8").digest(),
  );
  return `${encoded}.${signature}`;
}

export function buildAdminPayload(opts: AdminPayloadOptions = {}): SessionPayload {
  const iat = opts.iat ?? Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const sub = opts.sub ?? "google:dev-admin";
  const email = opts.email ?? "dev-admin@negentropy.local";
  return {
    typ: "session",
    iat,
    exp: iat + ttl,
    sub,
    email,
    name: opts.name ?? "Dev Admin",
    picture: opts.picture ?? null,
    roles: opts.roles ?? ["admin"],
    provider: opts.provider ?? "dev",
    subject: opts.sub ?? sub,
    domain: opts.domain ?? null,
  };
}
