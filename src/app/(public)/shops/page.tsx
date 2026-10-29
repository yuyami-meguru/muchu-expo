import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { LiveNotice, LiveShopBadges } from "@/components/live/live-parts";
import { loadAll } from "@/lib/store";
import { DEPT_ORDER, DEPTS, KIND_LABEL, type Kind } from "@/lib/types";
import "./shops.css";

export const metadata: Metadata = { title: "お店・出し物" };

const KINDS: (Kind | "all")[] = ["all", "eat", "play", "see"];

/** お店・出し物の一覧（AVERIX の「サービスと料金」のカードの形）。「何したい？」で絞り込める */
export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const kind = (KINDS as string[]).includes(k ?? "") ? (k as Kind | "all") : "all";
  const { shops, places } = await loadAll();
  const placeName = Object.fromEntries(places.map((p) => [p.id, p.name]));
  const list = shops.filter((s) => !s.hidden && (kind === "all" || s.kind === kind));

  return (
    <div className="sp-wrap">
      <header className="sp-head">
        <p className="sp-eyebrow">SHOPS</p>
        <h1 className="sp-h1">お店・出し物</h1>
        <p className="sp-lead">値段はすべて予定です。売り切れは 15 秒ごとに自動で更新されます。</p>
      </header>

      <nav className="sp-filter" aria-label="何をしたいかで絞り込む">
        <span className="sp-filter-q">何したい？</span>
        {KINDS.map((x) => (
          <Link key={x} href={x === "all" ? "/shops" : `/shops?kind=${x}`} aria-current={x === kind ? "page" : undefined} scroll={false}>
            {x === "all" ? "ぜんぶ" : KIND_LABEL[x]}
          </Link>
        ))}
      </nav>

      {DEPT_ORDER.map((d) => {
        const inDept = list.filter((s) => s.dept === d);
        if (!inDept.length) return null;
        return (
          <section key={d} className={`sp-dept d-${d}`} aria-labelledby={`dept-${d}`}>
            <h2 id={`dept-${d}`} className="sp-dept-h">
              <span className="sp-dept-dot" aria-hidden="true" />
              {DEPTS[d].name}
              <small>{DEPTS[d].tagline}</small>
            </h2>
            <ul className="sp-cards">
              {inDept.map((s) => {
                const prices = s.menu.filter((m) => m.price).map((m) => `${m.name} ${m.price}`);
                return (
                  <li key={s.id}>
                    <Link href={`/shops/${s.id}`} className="sp-card">
                      <span className="sp-card-top">
                        <span className="sp-card-kicker">{DEPTS[s.dept].short}</span>
                        <LiveShopBadges shopId={s.id} />
                      </span>
                      <span className="sp-card-name">{s.name}</span>
                      {s.catch && <span className="sp-card-catch">{s.catch}</span>}
                      {prices.length > 0 && <span className="sp-card-price">{prices.slice(0, 2).join(" ／ ")}</span>}
                      <span className="sp-card-place">
                        <Icon name="場所" size={16} />
                        {s.placeNote || placeName[s.placeId] || <span className="tbd">場所は準備中</span>}
                      </span>
                      <LiveNotice shopId={s.id} />
                      <span className="sp-card-more">
                        くわしく見る
                        <Icon name="右へ" size={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!list.length && <p className="sp-empty">この条件のお店はまだありません。</p>}
    </div>
  );
}
