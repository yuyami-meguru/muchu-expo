"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CALL_STATUS_LABEL, CLOSE_AT, OPEN_AT, type AdminLive, type Call } from "@/lib/ops";
import { NO_DEPT, STATE_LABEL, STOCK_LABEL, type Dept, type Shop, type Stock } from "@/lib/types";
import { clock, send } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { clockNow, latest, shapeOf, stamp, useShapeRefresh } from "../ops-live";
import "../ops.css";

const NEXT: Record<Stock, Stock> = { on: "few", few: "out", out: "on" };

type Note = { id: number; text: string; error: boolean };

/**
 * 実行委員の「いまの様子」。いちばん上に呼び出し、その下にお店の人への連絡、部門ごとのお店。
 * 品物の札を押すと「販売中 → 残りわずか → 売り切れ」の順に変わる（次の値は、いちばん新しい値から決める）。
 * 15 秒ごとに読み直すので、お店の人や、ほかの実行委員が押した売り切れ・呼び出しも入る。押した結果は画面の下の帯に出す。
 */
export function AdminOverview({ shops: initial, depts }: { shops: Shop[]; depts: Dept[] }) {
  const { live, failed, refresh } = useStaffLive<AdminLive>();
  const [mine, setMine] = useState<Record<string, Shop>>({});
  /** 送っているお店（お店 id → 品物と送った値）。答えが来るまで、そのお店の札は押せない */
  const [sending, setSending] = useState<Record<string, { item: string; stock: Stock }>>({});
  const [callMine, setCallMine] = useState<Record<string, Call>>({});
  const [callBusy, setCallBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const noteId = useRef(0);
  useShapeRefresh(live, shapeOf(initial));

  const say = (text: string, error = false) => setNote({ id: ++noteId.current, text, error });

  // 成功の帯は 6 秒で消す（失敗は閉じるまで残す）
  useEffect(() => {
    if (!note || note.error) return;
    const t = setTimeout(() => setNote((n) => (n?.id === note.id ? null : n)), 6000);
    return () => clearTimeout(t);
  }, [note]);

  const at = live?.at ?? 0;
  const shops = initial
    .filter((s) => !live || live.shops[s.id]) // 消されたお店は出さない
    .map((s) => {
      const v = latest(s, mine[s.id], live?.shops[s.id]);
      const p = sending[s.id];
      return p ? { ...v, menu: v.menu.map((m) => (m.id === p.item ? { ...m, stock: p.stock } : m)) } : v;
    });
  const name = (id: string) => initial.find((s) => s.id === id)?.name ?? id;

  const calls = (live?.calls ?? []).map((c) => (callMine[c.id] && callMine[c.id].updatedAt >= c.updatedAt ? callMine[c.id] : c));
  const waiting = calls.filter((c) => c.status === "new");
  const going = calls.filter((c) => c.status === "going");
  const done = calls.filter((c) => c.status === "done");

  // 対応していない呼び出しがあるあいだは、タブの題にも出す（ほかのタブを見ていても気づけるように。音は出さない）
  useEffect(() => {
    const strip = (t: string) => t.replace(/^（呼び出し \d+）/, "");
    document.title = waiting.length ? `（呼び出し ${waiting.length}）${strip(document.title)}` : strip(document.title);
    return () => {
      document.title = strip(document.title);
    };
  }, [waiting.length]);

  async function cycle(s: Shop, itemId: string) {
    if (sending[s.id]) return;
    const item = s.menu.find((m) => m.id === itemId);
    if (!item) return;
    const stock = NEXT[item.stock];
    setSending((p) => ({ ...p, [s.id]: { item: itemId, stock } }));
    const r = await send<{ shop: Shop | null }>(`/api/staff/shops/${s.id}`, "PATCH", { stock: [{ id: itemId, stock }] });
    setSending((p) => {
      const next = { ...p };
      delete next[s.id];
      return next;
    });
    if (!r.ok) return say(`${s.name}『${item.name}』を${STOCK_LABEL[stock]}にできませんでした。${r.error}`, true);
    if (r.shop) setMine((p) => ({ ...p, [s.id]: r.shop! }));
    say(`${s.name}『${item.name}』を${STOCK_LABEL[stock]}に・${clockNow()}`);
    refresh();
  }

  async function answer(c: Call, status: "going" | "done") {
    setCallBusy(c.id);
    const r = await send<{ call: Call }>(`/api/staff/calls/${c.id}`, "PATCH", { status });
    setCallBusy(null);
    if (!r.ok) return say(`${name(c.shop)}の呼び出し：${r.error}`, true);
    setCallMine((p) => ({ ...p, [c.id]: r.call }));
    say(
      status === "going"
        ? `${name(c.shop)}に「向かっています」と出しました・${clockNow()}`
        : `${name(c.shop)}の呼び出しを「済み」にしました・${clockNow()}`,
    );
    refresh();
  }

  const visible = shops.filter((s) => !s.hidden);
  const memo = live?.memo ?? null;
  const seen = memo ? visible.filter((s) => live?.acks[s.id] === memo.id) : [];
  const notYet = memo ? visible.filter((s) => live?.acks[s.id] !== memo.id) : [];
  // 当日の 10:00〜14:00 に「準備中」のままのお店（時刻はサーバーの時計）
  const lateTime = at >= OPEN_AT && at < CLOSE_AT;
  const late = lateTime ? visible.filter((s) => s.state === "prep") : [];

  const callLine = (c: Call) => (
    <>
      <strong>{name(c.shop)}</strong>：{c.reason}
      {c.text && `『${c.text}』`} <time dateTime={new Date(c.at).toISOString()}>{clock(c.at)}</time>
    </>
  );

  return (
    <div className="ops">
      {/* 15 秒ごとに変わるので、読み上げの知らせ（role="status"）にはしない */}
      <p className={failed ? "ops-clock ops-clock--ng" : "ops-clock"}>
        {!live
          ? "いまの様子を読んでいます…"
          : failed
            ? `読み直せませんでした（電波を確かめてください）。表示は ${clock(at)} のままです`
            : `${clock(at)} の様子（15 秒ごとに更新）`}
      </p>

      <section className="ops-calls" id="calls" aria-labelledby="ops-calls-h">
        <h2 id="ops-calls-h" className="ops-h">
          お店からの呼び出し
          {waiting.length > 0 && <span className="ops-count">まだ {waiting.length}</span>}
        </h2>
        {!live ? null : waiting.length + going.length === 0 ? (
          <p className="st-muted">いまは呼び出しはありません。</p>
        ) : (
          <ul className="ops-call-list">
            {[...waiting, ...going].map((c) => (
              <li key={c.id} className={`ops-call ops-call--${c.status}${c.status === "new" && at - c.at < 120_000 ? " ops-call--fresh" : ""}`}>
                <p className="ops-call-text">
                  <span className="ops-call-state">{c.status === "new" ? "まだ" : CALL_STATUS_LABEL[c.status]}</span>
                  {callLine(c)}
                </p>
                <div className="ops-call-btns">
                  {c.status === "new" && (
                    <button type="button" className="ops-btn ops-btn--go" disabled={callBusy === c.id} onClick={() => answer(c, "going")}>
                      向かいます
                    </button>
                  )}
                  <button type="button" className="ops-btn" disabled={callBusy === c.id} onClick={() => answer(c, "done")}>
                    済み
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <details className="ops-done">
            <summary>済んだ呼び出し（{done.length}）</summary>
            <ul>
              {done.map((c) => (
                <li key={c.id}>{callLine(c)}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {memo && (
        <section className="ops-memo" aria-label="お店の人への連絡">
          <p className="ops-memo-text">
            <span className="ops-memo-k">お店の人への連絡（{clock(memo.at)}）</span>
            {memo.text}
          </p>
          <p className="ops-memo-seen">
            見たお店 {seen.length}/{visible.length}
            {notYet.length > 0 && (
              <span className="st-muted">
                （まだ：{notYet.slice(0, 8).map((s) => s.name).join("・")}
                {notYet.length > 8 && ` ほか ${notYet.length - 8} 店`}）
              </span>
            )}
          </p>
          <Link href="/staff/news#memo" className="ops-link">
            全体のお知らせの画面で直す・消す
          </Link>
        </section>
      )}

      {late.length > 0 && (
        <p className="ops-late" role="status">
          10:00 を過ぎても「準備中」のお店：{late.map((s) => s.name).join("・")}
        </p>
      )}

      {[...depts, { ...NO_DEPT, id: "__none" }].map((d) => {
        // 部門が消えたお店は「未分類」にまとめる
        const list = shops.filter((s) => (d.id === "__none" ? !depts.some((x) => x.id === s.dept) : s.dept === d.id));
        if (!list.length) return null;
        return (
          <section key={d.id} className={`st-dept tone-${d.color}`} aria-labelledby={`st-d-${d.id}`}>
            <h2 id={`st-d-${d.id}`} className="st-dept-title">
              {d.name}
            </h2>
            <div className="st-cards">
              {list.map((s) => {
                const busy = !!sending[s.id];
                const isLate = lateTime && !s.hidden && s.state === "prep";
                return (
                  <article key={s.id} className={isLate ? "st-card st-card--late" : "st-card"} aria-busy={busy || undefined}>
                    <div className="st-card-head">
                      <Link href={`/staff/shops/${s.id}`} className="st-card-name">
                        {s.name}
                      </Link>
                      <span className="st-badge" data-v={s.hidden ? "hidden" : s.state}>
                        {s.hidden ? "非表示" : STATE_LABEL[s.state]}
                      </span>
                    </div>
                    {isLate && <p className="st-card-late">10:00 を過ぎても準備中です</p>}
                    {s.notice && <p className="st-muted">お店からのお知らせ：{s.notice}</p>}
                    {s.menu.length ? (
                      <div className="st-chips">
                        {s.menu.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="st-chip"
                            data-v={m.stock}
                            disabled={busy}
                            aria-busy={sending[s.id]?.item === m.id || undefined}
                            onClick={() => cycle(s, m.id)}
                            aria-label={`${m.name}（いま ${STOCK_LABEL[m.stock]}。押すと${STOCK_LABEL[NEXT[m.stock]]}）`}
                          >
                            {m.name}
                            <span className="st-muted">{sending[s.id]?.item === m.id ? "送っています…" : STOCK_LABEL[m.stock]}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="st-muted">品物なし</p>
                    )}
                    {s.updatedAt > 0 && at > 0 && <p className="st-card-at">最後の変更 {stamp(s.updatedAt, at)}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* 押した結果と、まだ対応していない呼び出しは、画面の下に固定して出す（スクロールしていても見える） */}
      <div className="ops-band">
        {waiting.length > 0 && (
          <p className="ops-band-item ops-band-item--call">
            <span>
              まだ対応していない呼び出しが {waiting.length} 件あります（{name(waiting[0].shop)}
              {waiting.length > 1 && " ほか"}）
            </span>
            <a href="#calls" className="ops-band-act">
              見る
            </a>
          </p>
        )}
        <div role="status" aria-live="polite">
          {note && !note.error && <p className="ops-band-item">{note.text}</p>}
        </div>
        <div role="alert">
          {note?.error && (
            <p className="ops-band-item ops-band-item--ng">
              <span>{note.text}</span>
              <button type="button" className="ops-band-act" onClick={() => setNote(null)}>
                閉じる
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
