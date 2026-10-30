import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, getSession } from "@/lib/auth";

/**
 * 入口のアドレス。ログインが切れて来た人（Cookie はあるのに使えない）は from=expired（入口に「ログインが切れました」と出す。
 * はじめて来た人には出さない）。next（この画面の URL）を渡すと、合言葉で入り直したあと、この画面に戻る
 */
export async function loginHref(next?: string) {
  const q = new URLSearchParams();
  if ((await cookies()).has(COOKIE)) q.set("from", "expired");
  if (next) q.set("next", next);
  const qs = q.toString();
  return qs ? `/staff/login?${qs}` : "/staff/login";
}

/**
 * 実行委員だけの画面。ログインしていなければ入口へ（next つき）、お店の人は自分のお店の画面へ戻す。
 * 枠（layout.tsx）はログインが無くても入口へ回さない（枠が先に回すと next が消えるため）。どの画面も、ここか loginHref で回す
 */
export async function adminOnly(next?: string) {
  const s = await getSession();
  if (!s) redirect(await loginHref(next));
  if (s.role !== "admin") redirect("/staff");
  return s;
}
