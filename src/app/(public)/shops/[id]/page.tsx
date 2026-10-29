import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { LiveNotice, LiveShopBadges, LiveStock } from "@/components/live/live-parts";
import { getShop, loadAll } from "@/lib/store";
import { DEPTS, KIND_LABEL } from "@/lib/types";
import "../shops.css";

export async function generateMetadata({ params }: PageProps<"/shops/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await getShop(id);
  return { title: s && !s.hidden ? s.name : "お店" };
}

/** お店の詳細：いまの状態・メニューと値段（売り切れ）・当日の流れ・お店の思い・場所 */
export default async function ShopPage({ params }: PageProps<"/shops/[id]">) {
  const { id } = await params;
  const { shops, places } = await loadAll();
  const s = shops.find((x) => x.id === id);
  if (!s || s.hidden) notFound();
  const place = places.find((p) => p.id === s.placeId);
  const others = shops.filter((x) => !x.hidden && x.dept === s.dept && x.id !== s.id);

  return (
    <article className={`sd d-${s.dept}`}>
      <header className="sd-hero">
        <div className="sp-wrap">
          <Link href="/shops" className="sd-back">
            <Icon name="左へ" size={18} />
            お店・出し物
          </Link>
          <p className="sd-kicker">
            {DEPTS[s.dept].name} ・ {KIND_LABEL[s.kind]}
          </p>
          <h1 className="sd-name">{s.name}</h1>
          {s.catch && <p className="sd-catch">{s.catch}</p>}
        </div>
      </header>

      <div className="sp-wrap sd-body">
        <section className="sd-card sd-now" aria-label="いまの様子">
          <LiveShopBadges shopId={s.id} />
          <LiveNotice shopId={s.id} />
        </section>

        {s.description && (
          <section className="sd-card">
            <h2>どんなお店？</h2>
            <p className="sd-text">{s.description}</p>
          </section>
        )}

        <section className="sd-card">
          <h2>メニューと値段</h2>
          {s.menu.length ? (
            <ul className="sd-menu">
              {s.menu.map((m) => (
                <li key={m.id}>
                  <span className="sd-menu-name">
                    {m.name}
                    {m.note && <small>{m.note}</small>}
                  </span>
                  <span className="sd-menu-price">{m.price || <span className="tbd">値段は準備中</span>}</span>
                  <LiveStock shopId={s.id} itemId={m.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="sd-text ink-3">見て・聴いて楽しむ出し物です。</p>
          )}
        </section>

        <section className="sd-card">
          <h2>当日の流れ</h2>
          {s.schedule.length ? (
            <ol className="sd-flow">
              {s.schedule.map((x, i) => (
                <li key={i}>
                  <span className="sd-flow-time">{x.time}</span>
                  <span className="sd-flow-text">{x.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="sd-text">
              <span className="tbd">スケジュールは準備中</span>
            </p>
          )}
        </section>

        <section className="sd-card sd-message">
          <h2>お店の思い</h2>
          {s.message ? <blockquote>{s.message}</blockquote> : <p className="sd-text"><span className="tbd">準備中</span></p>}
        </section>

        <section className="sd-card">
          <h2>場所</h2>
          <p className="sd-text">
            <strong>{s.placeNote || place?.name || <span className="tbd">準備中</span>}</strong>
          </p>
          {place && (
            <Link href={`/map?place=${place.id}`} className="sd-maplink">
              <Icon name="地図" size={18} />
              マップで見る
            </Link>
          )}
        </section>

        {others.length > 0 && (
          <section className="sd-others" aria-labelledby="others-h">
            <h2 id="others-h">{DEPTS[s.dept].name}のほかのお店</h2>
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
      </div>
    </article>
  );
}
