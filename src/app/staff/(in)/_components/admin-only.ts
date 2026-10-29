import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** 実行委員だけの画面。お店の人は自分のお店の画面へ戻す */
export async function adminOnly() {
  const s = await getSession();
  if (!s) redirect("/staff/login");
  if (s.role !== "admin") redirect("/staff");
  return s;
}
