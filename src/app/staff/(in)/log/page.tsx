import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { listLog, loadAll } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { LogFilter } from "./log-filter";

export const metadata: Metadata = { title: "変更の記録" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** だれが・いつ・どのお店の・何を変えたか（新しい順に 500 件まで）。売り切れ・状態の切り替えは入れていない */
export default async function StaffLogPage({ searchParams }: { searchParams: Promise<{ shop?: string }> }) {
  await adminOnly();
  const { shop } = await searchParams;
  const [log, { shops }] = await Promise.all([listLog(), loadAll({ fresh: true })]);
  const name = new Map(shops.map((s) => [s.id, s.name]));
  const list = shop ? log.filter((e) => e.shop === shop) : log;
  return (
    <div className="st-page st-stack">
      <PageHeader title="変更の記録" sub="お店の紹介・メニュー・お知らせや、実行委員が変えた店名などを残しています（売り切れ・営業中などの切り替えは入れていません）" />
      <LogFilter shops={shops.map((s) => ({ id: s.id, name: s.name }))} value={shop ?? ""} />
      {list.length === 0 ? (
        <p className="st-muted">まだ記録はありません。</p>
      ) : (
        <ol className="st-log">
          {list.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <div className="st-log-head">
                <time className="st-log-time" dateTime={new Date(e.at).toISOString()}>
                  {fmt.format(e.at)}
                </time>
                <span className="st-log-shop">{name.get(e.shop) ?? e.shopName}</span>
                <span className="st-log-by">{e.by === "admin" ? "実行委員" : "お店の人"}が変更</span>
              </div>
              <p className="st-log-field">{e.field}</p>
              <div className="st-log-diff">
                <span>
                  <b>前</b>
                  {e.before || "（空）"}
                </span>
                <span>
                  <b>後</b>
                  {e.after || "（空）"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
