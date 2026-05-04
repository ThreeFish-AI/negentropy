#!/usr/bin/env node
/**
 * sign-dev-cookie.mjs — 本地开发用：生成已签名的 ne_sso cookie 值，
 * 兼输出 Playwright storageState JSON，用于浏览器实机回归。
 *
 * 用法：
 *   NE_AUTH_TOKEN_SECRET=<hex> node apps/negentropy-ui/scripts/sign-dev-cookie.mjs
 *     → stdout 打印 token（无尾换行噪声，方便 $(...) 抓取）
 *
 *   NE_AUTH_TOKEN_SECRET=<hex> node apps/negentropy-ui/scripts/sign-dev-cookie.mjs \
 *     --storage-state apps/negentropy-ui/.auth/dev-admin.json
 *     → 同时把 cookie 写成 Playwright storageState 文件（gitignored）
 *
 * 选项：
 *   --storage-state <path>   写入 Playwright storageState JSON 到指定路径
 *   --ttl <seconds>          覆盖默认 86400 秒
 *   --email <email>          覆盖默认 dev-admin@example.com
 *   --sub <sub>              覆盖默认 google:dev-admin
 *   --name <name>            覆盖默认 Dev Admin
 *   --roles <r1,r2>          覆盖默认 admin（逗号分隔）
 *   --domain <domain>        cookie domain，默认 127.0.0.1
 *   --secure                 cookie secure 标志（默认关）
 *   --quiet                  不输出额外日志
 *   -h, --help               显示帮助
 *
 * 严禁在生产环境执行；本脚本依赖的 NE_AUTH_TOKEN_SECRET 仅在本地 .env.local 下持有。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");

function parseArgs(argv) {
  const out = {
    storageState: null,
    ttlSeconds: 60 * 60 * 24,
    email: undefined,
    sub: undefined,
    name: undefined,
    roles: undefined,
    domain: undefined,
    secure: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "-h":
      case "--help":
        process.stdout.write(`用法见脚本头部注释。\n`);
        process.exit(0);
        break;
      case "--storage-state":
        out.storageState = next();
        break;
      case "--ttl":
        out.ttlSeconds = Number(next());
        if (!Number.isFinite(out.ttlSeconds) || out.ttlSeconds <= 0) {
          process.stderr.write(`[sign-dev-cookie] --ttl 需为正整数秒\n`);
          process.exit(1);
        }
        break;
      case "--email":
        out.email = next();
        break;
      case "--sub":
        out.sub = next();
        break;
      case "--name":
        out.name = next();
        break;
      case "--roles":
        out.roles = next().split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--domain":
        out.domain = next();
        break;
      case "--secure":
        out.secure = true;
        break;
      case "--quiet":
        out.quiet = true;
        break;
      default:
        process.stderr.write(`[sign-dev-cookie] 未知参数：${a}\n`);
        process.exit(1);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const secret = process.env.NE_AUTH_TOKEN_SECRET ?? "";
  if (!secret) {
    process.stderr.write(
      `[sign-dev-cookie] 环境变量 NE_AUTH_TOKEN_SECRET 必须设置；可从 ${REPO_ROOT}/apps/negentropy/.env.local 读取。\n`,
    );
    process.exit(2);
  }

  // 注意：Node 22+ 不直接支持 require/import .ts；改用动态 require + tsx loader 不可控。
  // 此处复用 TS 文件 (../tests/e2e/utils/dev-cookie.ts) 的纯算法部分：
  // 直接内联实现签名（与 dev-cookie.ts 等价；保持单一事实源）。
  const { Buffer } = await import("node:buffer");
  const { createHmac } = await import("node:crypto");

  const b64url = (buf) => buf.toString("base64url");
  const canonical = (v) => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
    if (typeof v === "string") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (typeof v === "object") {
      const keys = Object.keys(v).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
    }
    throw new TypeError(`canonical: unsupported ${typeof v}`);
  };

  const now = Math.floor(Date.now() / 1000);
  const sub = opts.sub ?? "google:dev-admin";
  const payload = {
    typ: "session",
    iat: now,
    exp: now + opts.ttlSeconds,
    sub,
    email: opts.email ?? "dev-admin@example.com",
    name: opts.name ?? "Dev Admin",
    picture: null,
    roles: opts.roles ?? ["admin"],
    provider: "google",
    subject: sub.replace(/^google:/, ""),
    domain: null,
  };

  const encoded = b64url(Buffer.from(canonical(payload), "utf-8"));
  const signature = b64url(createHmac("sha256", secret).update(encoded).digest());
  const token = `${encoded}.${signature}`;

  if (opts.storageState) {
    const path = resolve(process.cwd(), opts.storageState);
    mkdirSync(dirname(path), { recursive: true });
    const storageState = {
      cookies: [
        {
          name: "ne_sso",
          value: token,
          domain: opts.domain ?? "127.0.0.1",
          path: "/",
          expires: payload.exp,
          httpOnly: true,
          secure: opts.secure,
          sameSite: "Lax",
        },
      ],
      origins: [],
    };
    writeFileSync(path, JSON.stringify(storageState, null, 2) + "\n", "utf-8");
    if (!opts.quiet) {
      process.stderr.write(`[sign-dev-cookie] storageState 已写入 ${path}\n`);
    }
  }

  // 默认 stdout 仅打印 token，方便 $(...) 抓取，不要追加额外内容
  process.stdout.write(token);
  if (!opts.quiet) process.stdout.write("\n");
}

main().catch((err) => {
  process.stderr.write(`[sign-dev-cookie] 失败：${err?.stack ?? err}\n`);
  process.exit(3);
});
