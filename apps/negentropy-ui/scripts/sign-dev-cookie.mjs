#!/usr/bin/env node
/**
 * 自签 ne_sso dev session cookie 工具，用于本地浏览器实机验证。
 *
 * 与 apps/negentropy/src/negentropy/auth/tokens.py 字节级对齐。
 *
 * 用法：
 *   node scripts/sign-dev-cookie.mjs                              # stdout 打印 token
 *   node scripts/sign-dev-cookie.mjs --storage-state .auth/x.json # 写 Playwright storageState
 *   node scripts/sign-dev-cookie.mjs --email a@b.com --ttl 3600
 *
 * 环境变量：
 *   NE_AUTH_TOKEN_SECRET  必填；可由 .env.local 自动加载
 *   PLAYWRIGHT_DEV_HOST   可选；默认 127.0.0.1
 */

import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UI_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(UI_ROOT, "..", "..");

function parseDotenv(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadSecret() {
  if (process.env.NE_AUTH_TOKEN_SECRET) {
    return process.env.NE_AUTH_TOKEN_SECRET;
  }
  const candidates = [
    path.join(UI_ROOT, ".env.local"),
    path.join(REPO_ROOT, "apps", "negentropy", ".env.local"),
  ];
  for (const file of candidates) {
    const env = parseDotenv(file);
    if (env.NE_AUTH_TOKEN_SECRET) {
      return env.NE_AUTH_TOKEN_SECRET;
    }
  }
  return undefined;
}

function parseArgs(argv) {
  const out = { storageState: null, ttl: 60 * 60 * 24, roles: ["admin"] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--storage-state":
        out.storageState = next ?? path.join(UI_ROOT, ".auth", "dev-admin.json");
        if (next) i++;
        break;
      case "--ttl":
        out.ttl = Number(next);
        i++;
        break;
      case "--email":
        out.email = next;
        i++;
        break;
      case "--sub":
        out.sub = next;
        i++;
        break;
      case "--name":
        out.name = next;
        i++;
        break;
      case "--roles":
        out.roles = next.split(",").map((s) => s.trim()).filter(Boolean);
        i++;
        break;
      case "--host":
        out.host = next;
        i++;
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`未知参数：${arg}`);
          process.exit(2);
        }
    }
  }
  return out;
}

function base64UrlEncode(buf) {
  return buf.toString("base64url").replace(/=+$/u, "");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object" && value.constructor === Object) {
    const sortedKeys = Object.keys(value).sort();
    const out = {};
    for (const key of sortedKeys) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function canonicalJSON(payload) {
  return JSON.stringify(canonicalize(payload));
}

function signSessionCookie(payload, secret) {
  if (!secret) throw new Error("token secret is required");
  const json = canonicalJSON(payload);
  const encoded = base64UrlEncode(Buffer.from(json, "utf-8"));
  const signature = base64UrlEncode(
    createHmac("sha256", Buffer.from(secret, "utf-8")).update(encoded, "utf-8").digest(),
  );
  return `${encoded}.${signature}`;
}

function buildAdminPayload(opts) {
  const iat = Math.floor(Date.now() / 1000);
  const sub = opts.sub ?? "google:dev-admin";
  return {
    typ: "session",
    iat,
    exp: iat + (opts.ttl ?? 86400),
    sub,
    email: opts.email ?? "dev-admin@negentropy.local",
    name: opts.name ?? "Dev Admin",
    picture: null,
    roles: opts.roles ?? ["admin"],
    provider: "dev",
    subject: opts.sub ?? sub,
    domain: null,
  };
}

function printHelp() {
  console.log(`Usage: node scripts/sign-dev-cookie.mjs [options]

签名一个 ne_sso dev session cookie，用于本地浏览器实机验证。

Options:
  --storage-state [path]  写 Playwright storageState（默认 .auth/dev-admin.json）
  --ttl <seconds>         过期时间（秒，默认 86400 = 24h）
  --email <email>         覆盖 email（默认 dev-admin@negentropy.local）
  --sub <id>              覆盖 sub（默认 google:dev-admin）
  --name <name>           覆盖 name（默认 Dev Admin）
  --roles <r1,r2>         覆盖 roles（默认 admin）
  --host <host>           storageState 中 cookie 的 domain（默认 127.0.0.1）
  -h, --help              本帮助
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const secret = loadSecret();
if (!secret) {
  console.error(
    "✗ 未找到 NE_AUTH_TOKEN_SECRET。\n" +
      "  请在 apps/negentropy-ui/.env.local 或 apps/negentropy/.env.local 写入，或设环境变量。",
  );
  process.exit(2);
}

const payload = buildAdminPayload(args);
const token = signSessionCookie(payload, secret);

if (args.storageState) {
  const file = path.isAbsolute(args.storageState)
    ? args.storageState
    : path.resolve(process.cwd(), args.storageState);
  mkdirSync(path.dirname(file), { recursive: true });
  const host = args.host ?? "127.0.0.1";
  const storageState = {
    cookies: [
      {
        name: "ne_sso",
        value: token,
        domain: host,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: payload.exp,
      },
    ],
    origins: [],
  };
  writeFileSync(file, JSON.stringify(storageState, null, 2), "utf-8");
  console.error(`✓ storageState 写入：${file}`);
  console.error(`  email=${payload.email}  sub=${payload.sub}  exp=${new Date(payload.exp * 1000).toISOString()}`);
}

process.stdout.write(token);
process.stdout.write("\n");
