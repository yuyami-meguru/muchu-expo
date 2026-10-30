import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { Icon } from "@/components/icons";
import { LiveNotice, LiveShopBadges, LiveStock } from "@/components/live/live-parts";
import { MiniFloorMap } from "@/components/map/mini-floor-map";
import { canEditShop, getSession } from "@/lib/auth";
import { getShop, loadAll } from "@/lib/store";
import { deptLookup, KIND_LABEL, type Kind, placeLabeler } from "@/lib/types";
import { ByPhase } from "../../_components/in-phase";
import { ShareButton } from "../../_components/share-button";
import PublicNotFound from "../../not-found";
import "../shops.css";

/** ログインしている人（題名とページで 1 回だけ読む。お店の人のときは保存先のかぎも確かめるため） */
const sessionOnce = cache(getSession);

/**
 * 非表示のお店を見てよい人か（実行委員と、そのお店の人だけ。下見として帯つきで見せる）。ほかの人には「見つかりません」のまま。
 * 非表示のお店を開いたときだけログインを確かめる（ふつうのお店では読まない）
 */
async function previewer(shopId: string) {
  const s = await sessionOnce();
  return canEditShop(s, shopId) ? s : null;
}

/** 見つからないとき（id のまちがい・非表示）の題名。検索エンジンには載せない */
const NOT_FOUND_META: Metadata = { title: "ページが見つかりません", robots: { index: false, follow: false } };

export async function generateMetadata({ params }: PageProps<"/shops/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await getShop(id);
  if (!s) return NOT_FOUND_META;
  if (s.hidden) return (await previewer(s.id)) ? { title: `下見：${s.name}`, robots: { index: false, follow: false } } : NOT_FOUND_META;
  return { title: s.name };
}

/** 「見る・聴く」は出し物、ほかはお店と呼ぶ */
const nounOf = (kind: Kind) => (kind === "see" ? "出し物" : "お店");

/**
 * お店の詳細：いまの状態と場所・どんなお店？・メニューと値段（売り切れ）・当日の流れ・お店の思い・［このページを送る］。
 * 空の欄は出さない（「まだ書かれていません」を並べない）。時期で変わる文は ByPhase（設定を読み直さない）。
 * 見つからないとき（id のまちがい・非表示）は notFound() を投げずに「ページが見つかりません」をそのまま描く
 * （投げると Next 16 は中身の無い HTML を返し、スクリプトが届くまで真っ白になるため。題名は「見つかりません」・検索には載せない）
 */
export default async function ShopPage({ params }: PageProps<"/shops/[id]">) {
  const { id } = await params;
  const { shops, places, areas, depts } = await loadAll();
  const s = shops.find((x) => x.id === id);
  if (!s) return <PublicNotFound />;
  const viewer = s.hidden ? await previewer(s.id) : null;
  if (s.hidden && !viewer) return <PublicNotFound />;
  const place = places.find((p) => p.id === s.placeId);
  // 場所：フロアなら「知育館 2階・201 小講義室」。補足（placeNote）はその下に
  const placeText = place ? placeLabeler(areas)(place) : s.placeNote;
  const placeExtra = place && s.placeNote ? s.placeNote : "";
  const dept = deptLookup(depts)(s.dept);
  const noun = nounOf(s.kind);
  const others = shops.filter((x) => !x.hidden && x.dept === s.dept && x.id !== s.id);
  const otherNouns = new Set(others.map((o) => nounOf(o.kind)));
  const othersNoun = otherNouns.size === 1 ? [...otherNouns][0] : "お店・出し物";
  const priced = s.menu.filter((m) => m.price).length;

  return (
    <article className={`sd tone-${dept.color}`}>
      {viewer && (
        <div className="sd-preview" role="note" aria-label="下見">
          <div className="sp-wrap">
            <p className="sd-preview-t">非表示（お客さんには見えていません）</p>
            <p className="sd-preview-d">
              このページは、実行委員とこのお店の人だけが見られる下見です。お客さんが開くと「ページが見つかりません」になります。
              {viewer.role === "admin" ? "お客さんに見せるときは、「お店の情報」の一覧で［見せる］を押してください。" : "お客さんに見せる準備ができたら、実行委員に伝えてください。"}
            </p>
            <p className="sd-preview-a">
              {viewer.role === "admin" ? <Link href={`/staff/shops/${s.id}`}>このお店の情報を直す</Link> : <Link href="/staff">お店の画面へ戻る</Link>}
            </p>
          </div>
        </div>
      )}
      <header className="sd-hero">
        <div className="sp-wrap">
          <Link href="/shops" className="sd-back">
            <Icon name="左へ" size={18} />
            お店・出し物
          </Link>
          <p className="sd-kicker">
            {dept.name} ・ {KIND_LABEL[s.kind]}
          </p>
          <h1 className="sd-name">{s.name}</h1>
          {s.catch && <p className="sd-catch">{s.catch}</p>}
        </div>
      </header>

      <div className="sp-wrap sd-body">
        {/* いまの様子と場所（いちばん上にまとめる） */}
        <section className="sd-card sd-now" aria-label="いまの様子と場所">
          <LiveShopBadges shopId={s.id} />
          <LiveNotice shopId={s.id} />
          <div className="sd-place">
            <Icon name="場所" size={20} />
            <p>
              <span className="sd-place-k">場所</span>
              {placeText ? (
                <strong>{placeText}</strong>
              ) : (
                <span className="sd-tbd">
                  {/* 終了後は「未定」と言わない（一覧の「場所の情報はありません」とそろえる） */}
                  <ByPhase before="決まりしだいお知らせします" day="近くの係（生徒・先生）におたずねください" after="情報はありません" />
                </span>
              )}
              {placeExtra && <span className="sd-place-extra">{placeExtra}</span>}
            </p>
            {place && (
              <Link href={`/map?place=${place.id}`} className="sd-maplink">
                <Icon name="地図" size={18} />
                マップで見る
              </Link>
            )}
          </div>
          {/* 建物の中の場所なら、小さな見取り図でその部屋に色を付ける（外の場所・見取り図の無い階では何も出ない）。押すとマップ */}
          <MiniFloorMap place={place} areas={areas} href={place ? `/map?place=${place.id}` : undefined} />

          {s.id === "radio" && (
            <Link href="/radio" className="sd-radio">
              <span aria-hidden="true">▶ </span>番組表を見る・メッセージを送る
            </Link>
          )}
        </section>

        {s.description && (
          <section className="sd-card">
            <h2>どんな{noun}？</h2>
            <p className="sd-text">{s.description}</p>
          </section>
        )}

        {s.menu.length > 0 ? (
          <section className="sd-card">
            <h2>{priced ? "メニューと値段" : "メニュー"}</h2>
            <ul className="sd-menu">
              {s.menu.map((m) => (
                <li key={m.id}>
                  <span className="sd-menu-name">
                    {m.name}
                    {m.note && <small>{m.note}</small>}
                  </span>
                  {m.price && <span className="sd-menu-price">{m.price}</span>}
                  <LiveStock shopId={s.id} itemId={m.id} />
                </li>
              ))}
            </ul>
            {/* 終了後は出さない（<p> ごと時期で出し分ける。中だけ出し分けると、終了後に点線だけの空の行が残る） */}
            {priced < s.menu.length && (
              <ByPhase
                before={
                  <p className="sd-menu-note">
                    {priced ? "値段の書いていないものは、まだ決まっていません。" : "値段は、まだ決まっていません。決まりしだいお知らせします。"}
                  </p>
                }
                day={<p className="sd-menu-note">{priced ? "値段の書いていないものは、お店でおたずねください。" : "値段は、お店でおたずねください。"}</p>}
              />
            )}
          </section>
        ) : (
          s.kind !== "see" && (
            <ByPhase
              before={
                <section className="sd-card">
                  <h2>メニュー</h2>
                  <p className="sd-text">
                    <span className="sd-tbd">メニューは決まりしだいお知らせします。</span>
                  </p>
                </section>
              }
            />
          )
        )}

        {s.schedule.length > 0 && (
          <section className="sd-card">
            <h2>当日の流れ</h2>
            <ol className="sd-flow">
              {s.schedule.map((x, i) => (
                <li key={i}>
                  <span className="sd-flow-time">{x.time}</span>
                  <span className="sd-flow-text">{x.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {s.message && (
          <section className="sd-card sd-message">
            <h2>{noun === "出し物" ? "出し物にこめた思い" : "お店の思い"}</h2>
            <blockquote>{s.message}</blockquote>
          </section>
        )}

        {others.length > 0 && (
          <section className="sd-others" aria-labelledby="others-h">
            <h2 id="others-h">
              {dept.name}のほかの{othersNoun}
            </h2>
            <ul>
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={`/shops/${o.id}`}>
                    {o.name}
                    <Icon name="右へ" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 家族や友だちに送る（非表示のお店の下見では出さない） */}
        {!viewer && <ShareButton path={`/shops/${s.id}`} title={`${s.name}｜エンカレ夢中万博`} className="sd-share" />}
      </div>
    </article>
  );
}
