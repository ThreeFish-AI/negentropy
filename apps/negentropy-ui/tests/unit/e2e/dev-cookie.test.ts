import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  buildAdminPayload,
  canonicalJSON,
  DEV_COOKIE_NAME,
  signDevSessionCookie,
} from "../../e2e/utils/dev-cookie";

describe("dev-cookie utils", () => {
  it("DEV_COOKIE_NAME aligns with backend cookie name", () => {
    expect(DEV_COOKIE_NAME).toBe("ne_sso");
  });

  it("canonicalJSON sorts keys recursively to match Python sort_keys=True", () => {
    const out = canonicalJSON({ b: { z: 1, a: 2 }, a: 1 });
    expect(out).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it("canonicalJSON keeps array order intact", () => {
    const out = canonicalJSON({ arr: [3, 1, 2], a: 1 });
    expect(out).toBe('{"a":1,"arr":[3,1,2]}');
  });

  it("buildAdminPayload defaults to admin role + 24h ttl", () => {
    const payload = buildAdminPayload();
    expect(payload.typ).toBe("session");
    expect(payload.roles).toEqual(["admin"]);
    expect(payload.exp - payload.iat).toBe(60 * 60 * 24);
    expect(payload.email).toBe("dev-admin@negentropy.local");
    expect(payload.sub).toBe("google:dev-admin");
    expect(payload.subject).toBe(payload.sub);
  });

  it("signDevSessionCookie produces a `<encoded>.<signature>` shape", () => {
    const payload = buildAdminPayload({ ttlSeconds: 60 });
    const token = signDevSessionCookie(payload, "test-secret");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it("signDevSessionCookie is deterministic for fixed payload + secret", () => {
    const payload = { ...buildAdminPayload(), iat: 1700000000, exp: 1700086400 };
    const a = signDevSessionCookie(payload, "fixed-secret");
    const b = signDevSessionCookie(payload, "fixed-secret");
    expect(a).toBe(b);
  });

  it("signDevSessionCookie payload roundtrips via base64url decode", () => {
    const payload = buildAdminPayload();
    const token = signDevSessionCookie(payload, "secret-x");
    const [encoded] = token.split(".");
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    const decoded = JSON.parse(json);
    expect(decoded.typ).toBe("session");
    expect(decoded.roles).toEqual(["admin"]);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.sub).toBe(payload.sub);
  });

  // Python 端到端解码（仅本地，门控环境变量 NE_AUTH_TEST_REAL_DECODE=1）。
  // 防止 CI 缺 uv/python 依赖时 fail。
  it.runIf(process.env.NE_AUTH_TEST_REAL_DECODE === "1")(
    "backend Python decode_token accepts JS-signed token",
    () => {
      const secret = process.env.NE_AUTH_TOKEN_SECRET;
      if (!secret) throw new Error("set NE_AUTH_TOKEN_SECRET to run");
      const payload = buildAdminPayload();
      const token = signDevSessionCookie(payload, secret);
      const script = `
import os, sys
sys.path.insert(0, "src")
from negentropy.auth.tokens import decode_token
out = decode_token(${JSON.stringify(token)}, ${JSON.stringify(secret)})
assert out["roles"] == ["admin"], out
print("OK")
`;
      const result = execFileSync("uv", ["run", "python", "-c", script], {
        cwd: "../negentropy",
        encoding: "utf-8",
      });
      expect(result.trim()).toBe("OK");
    },
  );
});
