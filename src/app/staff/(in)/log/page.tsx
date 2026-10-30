import type { Metadata } from "next";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { DAY_START } from "@/lib/ops";
import { listLiveLog, listLog, loadAll } from "@/lib/store";
import { adminOnly } from "../_components/admin-only";
import { byLabel, dayKey, dayLabel, KIND_LABEL, namesOf, summarize, timeOf, whatOf } from "./live-log";
import { LogFilter } from "./log-filter";
import { logHref } from "./log-href";
import "../ops.css";

export const metadata: Metadata = { title: "変更の記録" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
/** 画面に出す当日の動きの数（それより古いものは表（CSV）で） */
const SHOW_MAX = 500;
/** 開催日になったか（サーバーの時計）。はじめに開く見方を決める */
const dayStarted = () => Date.now() >= DAY_START;

/**
 * 変更の記録（実行委員だけ）。2 つの見方：
 *  - 当日の動き：営業の状態・売り切れ・お店からのお知らせの切り替え（お店ごとのまとめと、新しい順の一覧。表（CSV）で保存できる）
 *  - 紹介などの変更：だれが・いつ・どのお店の・何を変えたか（新しい順に 500 件まで）
 */
export default async function StaffLogPage({ searchParams }: { searchParams: Promise<{ shop?: string; view?: string; day?: string }> }) {
  await adminOnly();
  const sp = await searchParams;
  const view = sp.view === "live" || sp.view === "edit" ? sp.view : dayStarted() ? "live" : "edit";
  const shop = sp.shop ?? "";
  const [{ shops }, log, moves] = await Promise.all([loadAll({ fresh: true }), view === "edit" ? listLog() : Promise.resolve([]), view === "live" ? listLiveLog() : Promise.resolve([])]);
  const names = namesOf(shops);
  const shopList = shops.map((s) => ({ id: s.id, name: s.name }));
  const tabs = [
    { key: "live", label: "当日の動き", href: logHref({ view: "live", shop }) },
    { key: "edit", label: "紹介などの変更", href: logHref({ view: "edit", shop }) },
  ];

  return (
    <div className="st-page st-stack">
      <PageHeader title="変更の記録" sub="当日の営業・売り切れの動きと、お店の紹介・メニューなどの変更を残しています" />
      <Tabs items={tabs} active={view} label="記録の見方" />
      {view === "live" ? <LiveView moves={moves} shops={shopList} shop={shop} day={sp.day} names={names} order={shops.map((s) => s.id)} /> : <EditView log={log} shops={shopList} shop={shop} names={names} />}
    </div>
  );
}

function LiveView({
  moves,
  shops,
  shop,
  day: askedDay,
  names,
  order,
}: {
  moves: Awaited<ReturnType<typeof listLiveLog>>;
  shops: { id: string; name: string }[];
  shop: string;
  day?: string;
  names: ReturnType<typeof namesOf>;
  order: string[];
}) {
  // 記録のある日（新しい順）。はじめは、いちばん新しい日
  const days = [...new Map(moves.map((e) => [dayKey(e.at), e.at])).entries()].map(([value, at]) => ({ value, label: dayLabel(at) }));
  const day = askedDay === "all" || days.some((d) => d.value === askedDay) ? (askedDay as string) : (days[0]?.value ?? "");
  const list = moves.filter((e) => (day === "all" || dayKey(e.at) === day) && (!shop || e.shop === shop));
  const sums = summarize(list, names, order);
  const csv = `/staff/log/csv?${new URLSearchParams({ day: day || "all", ...(shop ? { shop } : {}) }).toString()}`;
  const dayName = day === "all" ? "すべての日" : (days.find((d) => d.value === day)?.label ?? "");

  return (
    <>
      <p className="st-muted">お店の人や実行委員が押した、営業の状態・品物の売り切れ・お店からのお知らせの切り替えです。振り返りと、来年の仕込みの数の参考に。</p>
      <div className="ops-log-tools">
        <LogFilter view="live" shops={shops} value={shop} days={days} day={day} />
        {list.length > 0 && (
          <a className={buttonClass({ variant: "secondary" })} href={csv} download>
            表（CSV）で保存
          </a>
        )}
      </div>
      {list.length === 0 ? (
        <p className="st-muted">まだ記録はありません（当日、お店が営業中・売り切れなどを押すと、ここに残ります）。</p>
      ) : (
        <>
          <section aria-labelledby="ops-sum-h">
            <h2 id="ops-sum-h" className="ops-h">
              お店ごとのまとめ（{dayName}）
            </h2>
            <div className="ops-sums">
              {sums.map((s) => (
                <article key={s.shop} className="ops-sum">
                  <h3>{s.name}</h3>
                  <dl>
                    <dt>はじめて営業中</dt>
                    <dd>{s.firstOpen ? timeOf(s.firstOpen) : "—"}</dd>
                    <dt>売り切れ</dt>
                    <dd>
                      {s.soldOut.length
                        ? s.soldOut.map((x) => (
                            <span key={x.item} className="ops-sum-item">
                              {x.name} {x.at.map(timeOf).join("・")}
                              {x.at.length > 1 && `（${x.at.length} 回）`}
                            </span>
                          ))
                        : "なし"}
                    </dd>
                    <dt>終了</dt>
                    <dd>{s.closed ? timeOf(s.closed) : "—"}</dd>
                    <dt>休憩</dt>
                    <dd>{s.breaks} 回</dd>
                  </dl>
                </article>
              ))}
            </div>
          </section>
          <section aria-labelledby="ops-moves-h">
            <h2 id="ops-moves-h" className="ops-h">
              動いた順（新しい順・{list.length} 件）
            </h2>
            <ol className="ops-moves">
              {list.slice(0, SHOW_MAX).map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <time dateTime={new Date(e.at).toISOString()}>{day === "all" ? fmt.format(e.at) : timeOf(e.at)}</time>
                  <span className="ops-moves-body">
                    <b>{names.shop(e.shop)}</b> {KIND_LABEL[e.kind]}：{whatOf(e, names)}
                    <span className="st-muted">（{byLabel(e.by)}）</span>
                  </span>
                </li>
              ))}
            </ol>
            {list.length > SHOW_MAX && <p className="st-muted">古い {list.length - SHOW_MAX} 件は、表（CSV）に入っています。</p>}
          </section>
        </>
      )}
    </>
  );
}

function EditView({ log, shops, shop, names }: { log: Awaited<ReturnType<typeof listLog>>; shops: { id: string; name: string }[]; shop: string; names: ReturnType<typeof namesOf> }) {
  const list = shop ? log.filter((e) => e.shop === shop) : log;
  return (
    <>
      <p className="st-muted">お店の紹介・メニュー・お知らせや、実行委員が変えた店名などです（新しい順に 500 件まで。営業中・売り切れの切り替えは「当日の動き」に）。</p>
      <LogFilter view="edit" shops={shops} value={shop} />
      {list.length === 0 ? (
        <p className="st-muted">まだ記録はありません。</p>
      ) : (
        <div>
          <ol className="st-log">
            {list.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <div className="st-log-head">
                  <time className="st-log-time" dateTime={new Date(e.at).toISOString()}>
                    {fmt.format(e.at)}
                  </time>
                  <span className="st-log-shop">{shops.some((s) => s.id === e.shop) ? names.shop(e.shop) : e.shopName}</span>
                  <span className="st-log-by">{byLabel(e.by)}が変更</span>
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
        </div>
      )}
    </>
  );
}
