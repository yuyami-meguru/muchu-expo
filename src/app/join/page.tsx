import type { Metadata } from "next";
import { getSession, keyPrint } from "@/lib/auth";
import { loadAll, readHash } from "@/lib/store";
import { JoinClient, type JoinShop } from "./join-client";
import "../staff/staff.css";
import "../staff/login/login.css";

export const metadata: Metadata = { title: "お店の QR", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * お店の QR の行き先（/join#s=お店&k=かぎ）。かぎは # のうしろなのでサーバーの記録に残らない（読むのは画面の中だけ）。
 * 実行委員でログイン中なら、お店の名前とかぎの指紋を渡す（黙ってお店の人に切りかえず、どのお店の QR か・使えるかを見せるため）。
 */
export default async function JoinPage() {
  const s = await getSession();
  let admin: JoinShop[] | null = null;
  if (s?.role === "admin") {
    const [{ shops }, keys] = await Promise.all([loadAll({ fresh: true }), readHash("key")]);
    admin = shops.map((x) => ({ id: x.id, name: x.name, kfp: keys[x.id] ? keyPrint(keys[x.id]) : "" }));
  }
  return <JoinClient admin={admin} />;
}
