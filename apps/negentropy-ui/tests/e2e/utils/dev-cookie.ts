/**
 * Dev cookie 签发工具：复刻后端 `apps/negentropy/src/negentropy/auth/tokens.py` 的 HMAC-SHA256
 * base64url 算法，用于在不经 Google OAuth 的情况下让 Playwright Chromium 直接以指定身份访问 UI。
 *
 * 仅用于本地开发与浏览器实机回归。生产环境严禁使用。
 */
import { Buffer } from "node:buffer";
import { createHmac, randomUUID } from "node:crypto";

export interface DevSessionPayload {
  typ: "session";
  iat: number;
  exp: number;
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  roles: string[];
  provider: string;
  subject: string;
  domain: string | null;
  [extra: string]: unknown;
}

export interface BuildPayloadInput {
  email?: string;
  sub?: string;
  name?: string;
  roles?: string[];
  provider?: string;
  subject?: string;
  domain?: string | null;
  picture?: string | null;
  ttlSeconds?: number;
  now?: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 1 天，浏览器调试足够

function b64urlNoPad(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * 与 Python `json.dumps(payload, sort_keys=True, separators=(",", ":"))` 等价。
 * 必须递归对所有对象 key 排序，数组保持原顺序。
 */
export function canonicalJSONStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJSONStringify(v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts = keys.map((k) => {
      const v = (value as Record<string, unknown>)[k];
      return `${JSON.stringify(k)}:${canonicalJSONStringify(v)}`;
    });
    return `{${parts.join(",")}}`;
  }
  throw new TypeError(`canonicalJSONStringify: unsupported value type ${typeof value}`);
}

export function signDevSessionCookie(payload: DevSessionPayload, secret: string): string {
  if (!secret) {
    throw new Error("NE_AUTH_TOKEN_SECRET 不可为空");
  }
  const canonical = canonicalJSONStringify(payload);
  const encoded = b64urlNoPad(Buffer.from(canonical, "utf-8"));
  const signature = b64urlNoPad(createHmac("sha256", secret).update(encoded).digest());
  return `${encoded}.${signature}`;
}

export function buildAdminPayload(input: BuildPayloadInput = {}): DevSessionPayload {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const sub = input.sub ?? "google:dev-admin";
  return {
    typ: "session",
    iat: now,
    exp: now + ttl,
    sub,
    email: input.email ?? "dev-admin@example.com",
    name: input.name ?? "Dev Admin",
    picture: input.picture ?? null,
    roles: input.roles ?? ["admin"],
    provider: input.provider ?? "google",
    subject: input.subject ?? sub.replace(/^google:/, ""),
    domain: input.domain ?? null,
  };
}

export interface PlaywrightStorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Lax" | "Strict" | "None";
  }>;
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
}

export interface BuildStorageStateInput extends BuildPayloadInput {
  secret: string;
  cookieName?: string;
  cookieDomain?: string;
  cookieSecure?: boolean;
  cookieSameSite?: "Lax" | "Strict" | "None";
  cookiePath?: string;
}

export function buildPlaywrightStorageState(input: BuildStorageStateInput): {
  payload: DevSessionPayload;
  cookieValue: string;
  storageState: PlaywrightStorageState;
} {
  const payload = buildAdminPayload(input);
  const cookieValue = signDevSessionCookie(payload, input.secret);
  const storageState: PlaywrightStorageState = {
    cookies: [
      {
        name: input.cookieName ?? "ne_sso",
        value: cookieValue,
        domain: input.cookieDomain ?? "127.0.0.1",
        path: input.cookiePath ?? "/",
        expires: payload.exp,
        httpOnly: true,
        secure: input.cookieSecure ?? false,
        sameSite: input.cookieSameSite ?? "Lax",
      },
    ],
    origins: [],
  };
  return { payload, cookieValue, storageState };
}

/**
 * 仅用于自反单测：相同 secret 二次签名应得到完全一致的 token。
 */
export function signatureSelfCheck(payload: DevSessionPayload, secret: string): boolean {
  const a = signDevSessionCookie(payload, secret);
  const b = signDevSessionCookie(payload, secret);
  return a === b;
}

export const __testing = {
  DEFAULT_TTL_SECONDS,
  b64urlNoPad,
  randomUUID, // 暴露给 spec 拼装 idempotency key
};
