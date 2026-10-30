import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { LiveNotice, LiveShopBadges } from "@/components/live/live-parts";
import { parsePhaseMode, phaseOf } from "@/lib/ops";
import { getSetting, loadAll } from "@/lib/store";
import { KIND_LABEL, NO_DEPT, type Kind, type Shop, placeLabeler } from "@/lib/types";
import { ShopCardLink } from "./shop-card";
import "./shops.css";

export const metadata: Metadata = { title: "お店・出し物" };

/** 「何したい？」の選び方。open＝いま開いている（営業中・休憩中） */
type Filter = Kind | "all" | "open";
const FILTERS: Filter[] = ["all", "open", "eat", "play", "see"];
const FILTER_LABEL: Record<Filter, string> = { all: "ぜんぶ", open: "いま開いている", ...KIND_LABEL };

/** いまの表示の時期（サーバーの時刻と、実行委員の切り替え） */
async function phaseNow() {
  return phaseOf(Date.now(), parsePhaseMode(await getSetting("phase")));
}

/** お店・出し物の一覧（AVERIX の「サービスと料金」のカードの形）。「何したい？」で絞り込める */
export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const filter = (FILTERS as string[]).includes(k ?? "") ? (k as Filter) : "all";
  const [{ shops, places, areas, depts }, phase] = await Promise.all([loadAll(), phaseNow()]);
  const where = placeLabeler(areas);
  const placeName = Object.fromEntries(places.map((p) => [p.id, where(p)]));
  // 「いま開いている」は、当日（朝・開催中）だけ。開催前の試しの「営業中」は数えない
  const isOpen = (s: Shop) => (phase === "morning" || phase === "during") && (s.state === "open" || s.state === "break");
  const list = shops.filter((s) => !s.hidden && (filter === "all" || (filter === "open" ? isOpen(s) : s.kind === filter)));
  const empty =
    filter !== "open"
      ? "この条件のお店・出し物はまだありません。"
      : phase === "before"
        ? "当日（11/28）10:00 から、開いているお店・出し物がここに出ます。"
        : phase === "after"
          ? "本日は終了しました。ご来場ありがとうございました。"
          : "いま開いているお店・出し物はありません。";

  return (
    <div className="sp-wrap">
      <header className="sp-head">
        <p className="sp-eyebrow">SHOPS</p>
        <h1 className="sp-h1">お店・出し物</h1>
        <p className="sp-lead">値段はすべて予定です。売り切れは 15 秒ごとに自動で更新されます。</p>
      </header>

      <nav className="sp-filter" aria-label="何をしたいかで絞り込む">
        <span className="sp-filter-q">何したい？</span>
        {FILTERS.map((x) => (
          <Link key={x} href={x === "all" ? "/shops" : `/shops?kind=${x}`} aria-current={x === filter ? "page" : undefined} scroll={false}>
            {FILTER_LABEL[x]}
          </Link>
        ))}
      </nav>

      {[...depts, { ...NO_DEPT, id: "__none" }].map((d) => {
        // 部門が消えたお店は、最後に「未分類」としてまとめる
        const inDept = list.filter((s) => (d.id === "__none" ? !depts.some((x) => x.id === s.dept) : s.dept === d.id));
        if (!inDept.length) return null;
        return (
          <section key={d.id} className={`sp-dept tone-${d.color}`} aria-labelledby={`dept-${d.id}`}>
            <h2 id={`dept-${d.id}`} className="sp-dept-h">
              <span className="sp-dept-dot" aria-hidden="true" />
              {d.name}
              {d.tagline && <small>{d.tagline}</small>}
            </h2>
            <ul className="sp-cards">
              {inDept.map((s) => {
                const prices = s.menu.filter((m) => m.price).map((m) => `${m.name} ${m.price}`);
                return (
                  <li key={s.id}>
                    <ShopCardLink shopId={s.id} className="sp-card">
                      <span className="sp-card-top">
                        <span className="sp-card-kicker">{d.short}</span>
                        <LiveShopBadges shopId={s.id} />
                      </span>
                      <span className="sp-card-name">{s.name}</span>
                      {s.catch && <span className="sp-card-catch">{s.catch}</span>}
                      {prices.length > 0 && <span className="sp-card-price">{prices.slice(0, 2).join(" ／ ")}</span>}
                      <span className="sp-card-place">
                        <Icon name="場所" size={16} />
                        {placeName[s.placeId] || s.placeNote || "場所は決まりしだいお知らせします"}
                      </span>
                      <LiveNotice shopId={s.id} />
                      <span className="sp-card-more">
                        くわしく見る
                        <Icon name="右へ" size={16} />
                      </span>
                    </ShopCardLink>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!list.length && <p className="sp-empty">{empty}</p>}
    </div>
  );
}
