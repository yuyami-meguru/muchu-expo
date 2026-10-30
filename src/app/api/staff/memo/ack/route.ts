import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, guarded, ok, readBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { writeHash } from "@/lib/store";

/** お店の人が、実行委員からの連絡を「見ました」にする */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const s = await getSession();
    if (s?.role !== "shop") return fail(403, "お店の QR で入ったスマホから押してください");
    const b = await readBody(req, z.object({ id: z.string().max(40) }));
    if ("error" in b) return b.error;
    await writeHash("memo-ack", { [s.shop]: b.data.id });
    return ok();
  });
}
