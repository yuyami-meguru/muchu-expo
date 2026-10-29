import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth";
import { fail, ok, sameOrigin } from "@/lib/api";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "このサイトの画面から操作してください");
  (await cookies()).delete(COOKIE);
  return ok();
}
