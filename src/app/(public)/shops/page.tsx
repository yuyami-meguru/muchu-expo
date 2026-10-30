import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { LiveNotice, LiveShopBadges, PollSeconds } from "@/components/live/live-parts";
import { loadAll } from "@/lib/store";
import { KIND_LABEL, NO_DEPT, type Kind, placeLabeler } from "@/lib/types";
import { ByPhase } from "../_components/in-phase";
import { FilterCount, OpenOnly, ShopCardLink } from "./shop-card";
import "./shops.css";

export const metadata: Metadata = { title: "お店・出し物" };

/** 「何したい？」の選び方。open＝いま開いている（営業中） */
type Filter = Kind | "all" | "open";
const FILTERS: Filter[] = ["all", "open", "eat", "play", "see"];
const FILTER_LABEL: Record<Filter, string> = { all: "ぜんぶ", open: "いま開いている", ...KIND_LABEL };

/**
 * お店・出し物の一覧（AVERIX の「サービスと料金」のカードの形）。「何したい？」で絞り込める。
 * 「いま開いている」は、全部のカードをサーバーで作っておき、営業中かどうかを画面の側（いまの様子）で決める（読み直しのたびに入れかわる。設定を読み直さない）
 */
export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: k } = await searchParams;
  const filter = (FILTERS as string[]).includes(k ?? "") ? (k as Filter) : "all";
  const { shops, places, areas, depts } = await loadAll();
  const where = placeLabeler(areas);
  const placeName = Object.fromEntries(places.map((p) => [p.id, where(p)]));
  const list = shops.filter((s) => !s.hidden && (filter === "all" || filter === "open" || s.kind === filter));
  const open = filter === "open";

  return (
    <div className="sp-wrap">
      <header className="sp-head">
        <p className="sp-eyebrow" aria-hidden="true">
          SHOPS
        </p>
        <h1 className="sp-h1">お店・出し物</h1>
        <p className="sp-lead">
          <ByPhase
            before="値段はすべて予定です。当日（11/28）は、営業中・売り切れの様子もここに出ます。"
            day={
              <>
                営業中・売り切れの様子は、
                <PollSeconds /> 秒ごとに自動で更新されます。
              </>
            }
            after="エンカレ夢中万博は終了しました。ご来場ありがとうございました。"
          />
        </p>
      </header>

      <nav className="sp-filter" aria-label="何をしたいかで絞り込む">
        <span className="sp-filter-q">何したい？</span>
        {FILTERS.map((x) => (
          <Link key={x} href={x === "all" ? "/shops" : `/shops?kind=${x}`} aria-current={x === filter ? "page" : undefined} scroll={false}>
            {FILTER_LABEL[x]}
          </Link>
        ))}
      </nav>
      <FilterCount filter={filter} label={FILTER_LABEL[filter]} ids={list.map((s) => s.id)} />

      <div className="sp-depts">
        {[...depts, { ...NO_DEPT, id: "__none" }].map((d) => {
          // 部門が消えたお店は、最後に「未分類」としてまとめる
          const inDept = list.filter((s) => (d.id === "__none" ? !depts.some((x) => x.id === s.dept) : s.dept === d.id));
          if (!inDept.length) return null;
          return (
            <OpenOnly key={d.id} on={open} ids={inDept.map((s) => s.id)}>
              <section className={`sp-dept tone-${d.color}`} aria-labelledby={`dept-${d.id}`}>
                <h2 id={`dept-${d.id}`} className="sp-dept-h">
                  <span className="sp-dept-dot" aria-hidden="true" />
                  {d.name}
                  {d.tagline && <small>{d.tagline}</small>}
                </h2>
                <ul className="sp-cards">
                  {inDept.map((s) => {
                    const prices = s.menu.filter((m) => m.price).map((m) => `${m.name} ${m.price}`);
                    const id = `card-${s.id}`;
                    const desc = [s.catch && `${id}-c`, prices.length > 0 && `${id}-p`, `${id}-w`].filter(Boolean).join(" ");
                    return (
                      <OpenOnly key={s.id} on={open} ids={[s.id]}>
                        <li>
                          <ShopCardLink shopId={s.id} className="sp-card" labelledBy={`${id}-n ${id}-s`} describedBy={desc}>
                            <span className="sp-card-top">
                              <span className="sp-card-kicker" aria-hidden="true">
                                {d.short}
                              </span>
                              <span id={`${id}-s`} className="sp-card-state">
                                <LiveShopBadges shopId={s.id} />
                              </span>
                            </span>
                            <span className="sp-card-name" id={`${id}-n`}>
                              {s.name}
                            </span>
                            {s.catch && (
                              <span className="sp-card-catch" id={`${id}-c`}>
                                {s.catch}
                              </span>
                            )}
                            {prices.length > 0 && (
                              <span className="sp-card-price" id={`${id}-p`}>
                                {prices.slice(0, 2).join(" ／ ")}
                              </span>
                            )}
                            <span className="sp-card-place" id={`${id}-w`}>
                              <Icon name="場所" size={16} />
                              <span>
                                <span className="sr-only">場所：</span>
                                {placeName[s.placeId] || s.placeNote || (
                                  <ByPhase before="場所は決まりしだいお知らせします" day="場所は係（生徒・先生）におたずねください" after="場所の情報はありません" />
                                )}
                              </span>
                            </span>
                            <LiveNotice shopId={s.id} />
                            <span className="sp-card-more" aria-hidden="true">
                              くわしく見る
                              <Icon name="右へ" size={16} />
                            </span>
                          </ShopCardLink>
                        </li>
                      </OpenOnly>
                    );
                  })}
                </ul>
              </section>
            </OpenOnly>
          );
        })}
      </div>
    </div>
  );
}
