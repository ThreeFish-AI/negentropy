/**
 * Wiki SSG ISR 主动 revalidate 端点
 *
 * 由后端 `negentropy.knowledge.revalidate.trigger_wiki_revalidate` 在
 * publish/unpublish 完成后 POST 推送，触发 SSG 立即重渲染相关路径，
 * 让用户访问到的内容尽量新鲜（不必等 5 分钟 ISR 窗口）。
 *
 * 校验：可选 HMAC-SHA256（共享密钥来自环境变量 `WIKI_REVALIDATE_SECRET`）。
 * - 后端配置 `wiki_revalidate.secret` 后会附带 `X-Negentropy-Signature: sha256=<hex>`；
 * - 本端配置同名 secret 才校验签名；任一端缺配置则跳过校验（开发期容错）。
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.WIKI_REVALIDATE_SECRET || "";

interface RevalidatePayload {
  event: "publish" | "unpublish";
  publication_id: string;
  pub_slug: string;
  app_name?: string;
}

function verifySignature(rawBody: string, header: string | null): boolean {
  if (!SECRET) return true; // 未配置 secret：跳过校验（dev/local 容错）
  if (!header) return false;
  const expected = "sha256=" + createHmac("sha256", SECRET).update(rawBody).digest("hex");
  // timingSafeEqual 要求长度一致；不等长直接判否避免 RangeError
  if (header.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-negentropy-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json(
      { error: { code: "WIKI_REVALIDATE_SIGNATURE_INVALID", message: "signature mismatch" } },
      { status: 401 },
    );
  }

  let payload: RevalidatePayload;
  try {
    payload = JSON.parse(rawBody) as RevalidatePayload;
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "WIKI_REVALIDATE_BAD_BODY",
          message: `Invalid JSON body: ${String(err)}`,
        },
      },
      { status: 400 },
    );
  }

  if (!payload.pub_slug || !payload.event) {
    return NextResponse.json(
      {
        error: {
          code: "WIKI_REVALIDATE_BAD_BODY",
          message: "missing pub_slug or event",
        },
      },
      { status: 400 },
    );
  }

  // 幂等：相同输入多次调用结果一致；revalidate* 内部去重。
  // 站点根路径 + 该发布的所有详情页（catch-all 子路径会因 revalidatePath
  // 加 layout 旗标而连带刷新）。
  revalidatePath("/");
  revalidatePath(`/${payload.pub_slug}`);
  revalidatePath(`/${payload.pub_slug}/[...entrySlug]`, "page");
  revalidateTag(`wiki:${payload.pub_slug}`);

  return NextResponse.json({
    revalidated: true,
    event: payload.event,
    pub_slug: payload.pub_slug,
    publication_id: payload.publication_id,
  });
}
