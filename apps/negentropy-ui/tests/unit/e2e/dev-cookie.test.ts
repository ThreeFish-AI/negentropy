import { describe, expect, it } from "vitest";
import {
  buildAdminPayload,
  buildPlaywrightStorageState,
  canonicalJSONStringify,
  signDevSessionCookie,
  signatureSelfCheck,
} from "../../e2e/utils/dev-cookie";

const SECRET = "test-secret-32bytes-fixed-for-determinism-0123456789";
const FIXED_NOW = 1_700_000_000;

describe("canonicalJSONStringify", () => {
  it("应递归对 object key 排序，输出与 Python json.dumps(sort_keys=True,separators=(',',':')) 等价", () => {
    const got = canonicalJSONStringify({ b: 2, a: { y: [1, 2], x: null }, c: [{ z: 1, a: 0 }] });
    // 预期：a 内部 x 在 y 前；外层 a < b < c
    expect(got).toBe('{"a":{"x":null,"y":[1,2]},"b":2,"c":[{"a":0,"z":1}]}');
  });

  it("应保留数组顺序，仅对对象 key 排序", () => {
    const got = canonicalJSONStringify([3, 1, 2]);
    expect(got).toBe("[3,1,2]");
  });

  it("应正确序列化 null / boolean / number", () => {
    expect(canonicalJSONStringify(null)).toBe("null");
    expect(canonicalJSONStringify(true)).toBe("true");
    expect(canonicalJSONStringify(1.5)).toBe("1.5");
  });
});

describe("signDevSessionCookie", () => {
  it("应在 secret 为空时抛错", () => {
    const payload = buildAdminPayload({ now: FIXED_NOW });
    expect(() => signDevSessionCookie(payload, "")).toThrow(/不可为空/);
  });

  it("相同 payload + secret 应输出确定性 token（自反一致）", () => {
    const payload = buildAdminPayload({ now: FIXED_NOW });
    const a = signDevSessionCookie(payload, SECRET);
    const b = signDevSessionCookie(payload, SECRET);
    expect(a).toBe(b);
    expect(signatureSelfCheck(payload, SECRET)).toBe(true);
  });

  it("token 形如 base64url(payload).base64url(signature)，无 padding", () => {
    const payload = buildAdminPayload({ now: FIXED_NOW });
    const token = signDevSessionCookie(payload, SECRET);
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    for (const p of parts) {
      expect(p).not.toContain("=");
      expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    // payload 部分反解后应为 canonical JSON
    const decoded = Buffer.from(parts[0], "base64url").toString("utf-8");
    const canonical = canonicalJSONStringify(payload);
    expect(decoded).toBe(canonical);
  });

  it("不同 secret 应得到不同签名", () => {
    const payload = buildAdminPayload({ now: FIXED_NOW });
    const a = signDevSessionCookie(payload, SECRET);
    const b = signDevSessionCookie(payload, SECRET + "x");
    expect(a).not.toBe(b);
  });

  it("payload 任一字段变化都应改变签名", () => {
    const base = buildAdminPayload({ now: FIXED_NOW });
    const tokenBase = signDevSessionCookie(base, SECRET);
    const tokenAlt = signDevSessionCookie({ ...base, email: "other@example.com" }, SECRET);
    expect(tokenBase).not.toBe(tokenAlt);
  });
});

describe("buildAdminPayload", () => {
  it("默认应为 admin role + google provider，TTL 24h", () => {
    const p = buildAdminPayload({ now: FIXED_NOW });
    expect(p.typ).toBe("session");
    expect(p.iat).toBe(FIXED_NOW);
    expect(p.exp).toBe(FIXED_NOW + 86400);
    expect(p.sub).toBe("google:dev-admin");
    expect(p.subject).toBe("dev-admin");
    expect(p.roles).toEqual(["admin"]);
    expect(p.provider).toBe("google");
  });

  it("应允许覆盖 sub / roles / TTL", () => {
    const p = buildAdminPayload({ now: FIXED_NOW, sub: "google:viewer-1", roles: [], ttlSeconds: 60 });
    expect(p.sub).toBe("google:viewer-1");
    expect(p.subject).toBe("viewer-1");
    expect(p.roles).toEqual([]);
    expect(p.exp).toBe(FIXED_NOW + 60);
  });
});

describe("buildPlaywrightStorageState", () => {
  it("应输出 ne_sso cookie + 空 origins，sameSite=Lax/secure=false", () => {
    const { storageState, cookieValue } = buildPlaywrightStorageState({ secret: SECRET, now: FIXED_NOW });
    expect(storageState.origins).toEqual([]);
    expect(storageState.cookies).toHaveLength(1);
    const cookie = storageState.cookies[0];
    expect(cookie.name).toBe("ne_sso");
    expect(cookie.value).toBe(cookieValue);
    expect(cookie.domain).toBe("127.0.0.1");
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.secure).toBe(false);
    expect(cookie.httpOnly).toBe(true);
  });
});
