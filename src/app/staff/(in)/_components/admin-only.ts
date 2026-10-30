import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, getSession } from "@/lib/auth";

/**
 * 実行委員だけの画面。お店の人は自分のお店の画面へ戻す。
 * ログインが切れて来た人（Cookie はあるのに使えない）は、入口に「ログインが切れました」と出す。
 * next（この画面の URL）を渡すと、合言葉で入り直したあと、この画面に戻る
 */
export async function adminOnly(next?: string) {
  const s = await getSession();
  if (!s) {
    const q = new URLSearchParams();
    if ((await cookies()).has(COOKIE)) q.set("from", "expired");
    if (next) q.set("next", next);
    const qs = q.toString();
    redirect(qs ? `/staff/login?${qs}` : "/staff/login");
  }
  if (s.role !== "admin") redirect("/staff");
  return s;
}
