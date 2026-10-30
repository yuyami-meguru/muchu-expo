import type { Metadata } from "next";
import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";
import { getSetting, loadAll } from "@/lib/store";
import { deptLookup } from "@/lib/types";
import { AWARD_KEY, parseAward } from "./award-data";
import "./award.css";

export async function generateMetadata(): Promise<Metadata> {
  const a = parseAward(await getSetting(AWARD_KEY));
  return { title: a.title };
}

/** 夢中アワード（発表がオフのあいだは受賞を見せない） */
export default async function AwardPage() {
  const [raw, { shops, depts }] = await Promise.all([getSetting(AWARD_KEY), loadAll()]);
  const a = parseAward(raw);
  const dept = deptLookup(depts);
  const shopOf = new Map(shops.filter((s) => !s.hidden).map((s) => [s.id, s]));

  if (!a.published) {
    return (
      <div className="aw-wrap">
        <header className="aw-head">
          <Sprite name="trophy" size={96} />
          <h1 className="aw-h1 px-title">{a.title}</h1>
          <p className="aw-teaser">{a.teaser || "発表をお楽しみに！"}</p>
          <p className="aw-sub">生徒たちの「夢中」の中から、心に残ったものを表彰します。</p>
          <p className="aw-links">
            <Link href="/shops">お店・出し物を見る</Link>
            <Link href="/survey">アンケートで「印象に残ったもの」を教える</Link>
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="aw-wrap">
      <div className="aw-confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * -0.9}s` }} />
        ))}
      </div>
      <header className="aw-head">
        <Sprite name="crown" size={88} />
        <p className="aw-eyebrow">RESULT</p>
        <h1 className="aw-h1 px-title">{a.title}</h1>
        <p className="aw-sub">たくさんの「夢中」の中から、選ばれたのはこちら！</p>
      </header>

      {a.awards.length === 0 ? (
        <p className="aw-empty">まだ賞がありません。</p>
      ) : (
        <ol className="aw-list">
          {a.awards.map((aw) => (
            <li key={aw.id} className="aw-card">
              <div className="aw-card-head">
                <Sprite name="trophy" size={52} />
                <div>
                  <h2 className="aw-name">{aw.name}</h2>
                  {aw.note && <p className="aw-note">{aw.note}</p>}
                </div>
              </div>
              {aw.winners.filter((w) => shopOf.has(w.shop)).length === 0 ? (
                <p className="aw-empty">発表をお待ちください</p>
              ) : (
                <ul className="aw-winners">
                  {aw.winners
                    .filter((w) => shopOf.has(w.shop))
                    .map((w) => {
                      const s = shopOf.get(w.shop)!;
                      const d = dept(s.dept);
                      return (
                        <li key={w.shop} className={`tone-${d.color}`}>
                          <Link href={`/shops/${s.id}`} className="aw-winner">
                            <span className="aw-dept">{d.short}</span>
                            <span className="aw-shop">{s.name}</span>
                            {w.comment && <span className="aw-comment">{w.comment}</span>}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="aw-thanks">すべての出し物に、たくさんの「夢中」がつまっていました。ご来場ありがとうございました！</p>
    </div>
  );
}
