"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CLOSE_AT, DAY_END, DAY_START, OPEN_AT, phaseOf, type AdminLive, type AlertLevel, type Phase, type PhaseMode, type SiteAlert } from "@/lib/ops";
import { NO_DEPT, STATE_LABEL, STOCK_LABEL, type Dept, type Shop, type Stock } from "@/lib/types";
import { clock, send } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { clockNow, latest, shapeOf, stamp, useShapeRefresh } from "../ops-live";
import { everyText, failMsg } from "../ops-result";
import { noteAuth, useReportLive } from "./session-signal";
import { modeLabel, PHASE_LABEL } from "./staff-bands";
import "../ops.css";

const NEXT: Record<Stock, Stock> = { on: "few", few: "out", out: "on" };
const LEVEL: Record<AlertLevel, string> = { info: "お知らせ", rain: "雨", urgent: "急ぎ" };
/** 終わりの時間の案内を出しはじめる時刻（14:00 の 15 分前） */
const CLOSE_SOON = CLOSE_AT - 15 * 60_000;

/** 押した結果。undo があれば［元に戻す］（いまの値が、押した値のままのときだけ出す） */
type Note = { id: number; text: string; error: boolean; undo?: { shop: string; item: string; from: Stock; to: Stock } };

/** 運営の状態（いまの様子のいちばん上）。ページを開いたときの値（サーバー）。at はそのときのサーバーの時刻 */
export type OpsNow = { alert: SiteAlert; phase: PhaseMode; phaseNow: Phase; onAir: boolean; at: number };

/**
 * 15 秒ごとの「いまの様子」に運営の設定（全体の帯・表示の時期・ラジオ）が入っていれば、それを使う。
 * 入っていなければ（古い答え）、ページを開いたときの値のまま（読み込みを増やさないため、ここでは取りに行かない）
 */
function opsOf(live: AdminLive | null, first: OpsNow): OpsNow {
  if (!live) return first;
  return {
    alert: live.alert ?? first.alert,
    phase: live.phase ?? first.phase,
    phaseNow: live.phase ? phaseOf(live.at, live.phase) : first.phaseNow,
    onAir: live.radio ? live.radio.onAir : first.onAir,
    at: live.at,
  };
}

/**
 * 実行委員の「いまの様子」。いちばん上に運営の状態（表示の時期・全体の帯・連絡・ラジオ。押すとその画面へ）と、
 * 当日の 10:00・14:00 の前には「当日の道具」への近道。その下にお店の人への連絡、部門ごとのお店。
 * 品物の札を押すと「販売中 → 残りわずか → 売り切れ」の順に変わる（次の値は、いちばん新しい値から決める）。
 * 15 秒ごとに読み直すので、お店の人や、ほかの実行委員が押した売り切れも入る。押した結果は画面の下の帯に出し、［元に戻す］で前の値に戻せる。
 */
export function AdminOverview({ shops: initial, depts, exp, ops: firstOps }: { shops: Shop[]; depts: Dept[]; exp: number; ops: OpsNow }) {
  const { live, failed, expired, refresh } = useStaffLive<AdminLive>();
  useReportLive(live, expired);
  const [mine, setMine] = useState<Record<string, Shop>>({});
  /** 送っているお店（お店 id → 品物と送った値）。答えが来るまで、そのお店の札は押せない */
  const [sending, setSending] = useState<Record<string, { item: string; stock: Stock }>>({});
  const [note, setNote] = useState<Note | null>(null);
  const noteId = useRef(0);
  useShapeRefresh(live, shapeOf(initial));

  const say = (text: string, error = false, undo?: Note["undo"]) => setNote({ id: ++noteId.current, text, error, undo });

  // 成功の帯は 6 秒（［元に戻す］があれば 12 秒）で消す。失敗は閉じるまで残す
  useEffect(() => {
    if (!note || note.error) return;
    const t = setTimeout(() => setNote((n) => (n?.id === note.id ? null : n)), note.undo ? 12_000 : 6000);
    return () => clearTimeout(t);
  }, [note]);

  const o = opsOf(live, firstOps);
  const at = live?.at ?? firstOps.at;
  const shops = initial
    .filter((s) => !live || live.shops[s.id]) // 消されたお店は出さない
    .map((s) => {
      const v = latest(s, mine[s.id], live?.shops[s.id]);
      const p = sending[s.id];
      return p ? { ...v, menu: v.menu.map((m) => (m.id === p.item ? { ...m, stock: p.stock } : m)) } : v;
    });

  /** 品物の残りを stock にする（back：［元に戻す］から。前の値に戻す） */
  async function setStock(s: Shop, itemId: string, stock: Stock, back = false) {
    if (sending[s.id]) return;
    const item = s.menu.find((m) => m.id === itemId);
    if (!item) return;
    const from = item.stock;
    const label = `${s.name}『${item.name}』を`;
    setSending((p) => ({ ...p, [s.id]: { item: itemId, stock } }));
    const r = noteAuth(await send<{ shop: Shop | null }>(`/api/staff/shops/${s.id}`, "PATCH", { stock: [{ id: itemId, stock }] }));
    setSending((p) => {
      const next = { ...p };
      delete next[s.id];
      return next;
    });
    if (!r.ok) {
      if (r.unsure) refresh();
      return say(failMsg(`${label}${back ? "元の" : ""}「${STOCK_LABEL[stock]}」に`, r), true);
    }
    if (r.shop) setMine((p) => ({ ...p, [s.id]: r.shop! }));
    if (back) say(`${label}「${STOCK_LABEL[stock]}」に戻しました（${clockNow()}）`);
    else say(`${label}「${STOCK_LABEL[stock]}」にしました（${clockNow()}）`, false, { shop: s.id, item: itemId, from, to: stock });
    refresh();
  }

  const visible = shops.filter((s) => !s.hidden);
  const memo = live?.memo ?? null;
  const seen = memo ? visible.filter((s) => live?.acks[s.id] === memo.id) : [];
  const notYet = memo ? visible.filter((s) => live?.acks[s.id] !== memo.id) : [];
  // 当日の 10:00〜14:00 に「準備中」のままのお店（時刻はサーバーの時計）
  const lateTime = at >= OPEN_AT && at < CLOSE_AT;
  const late = lateTime ? visible.filter((s) => s.state === "prep") : [];
  // 当日の朝（10:00 まで）と、14:00 の 15 分前からは「当日の道具」への近道を出す
  const today = at >= DAY_START && at < DAY_END;
  const todo = today && at < OPEN_AT ? "open" : today && at >= CLOSE_SOON ? "close" : null;

  // ［元に戻す］：押した品物が、いまも押した値のままなら出す（ほかの人がもう変えていたら出さない）
  const undo = note?.undo;
  const undoShop = undo ? shops.find((s) => s.id === undo.shop) : undefined;
  const canUndo = !!undo && !!undoShop && !sending[undoShop.id] && undoShop.menu.find((m) => m.id === undo.item)?.stock === undo.to;

  return (
    <div className="ops">
      {/* 読み直すたびに変わるので、読み上げの知らせ（role="status"）にはしない */}
      <p className={failed ? "ops-clock ops-clock--ng" : "ops-clock"}>
        <span>
          {!live
            ? "いまの様子を読んでいます…"
            : failed
              ? `読み直せませんでした（電波を確かめてください）。表示は ${clock(at)} のままです`
              : `${clock(at)} の様子（${everyText(o.phaseNow)}に更新）`}
        </span>
        <span className="ops-clock-sub">ログインは {stamp(exp, at)} まで</span>
      </p>

      <nav className="ops-status" aria-label="運営の状態（押すと、その画面へ）">
        <Link href="/staff/tools#phase" className="ops-pill" data-v={o.phase === "auto" ? undefined : "warn"}>
          <span className="ops-pill-k">表示の時期</span>
          {o.phase === "auto" ? `日時で自動（いま：${PHASE_LABEL[o.phaseNow]}）` : `「${modeLabel(o.phase)}」のまま`}
        </Link>
        <Link href="/staff/news#alert" className="ops-pill" data-v={o.alert.on ? (o.alert.level === "urgent" ? "ng" : "warn") : undefined}>
          <span className="ops-pill-k">全体の帯</span>
          {o.alert.on ? `出ています（${LEVEL[o.alert.level]}）` : "出していません"}
        </Link>
        <Link href="/staff/news#memo" className="ops-pill">
          <span className="ops-pill-k">お店の人への連絡</span>
          {memo ? `見たお店 ${seen.length}/${visible.length}` : live ? "出していません" : "…"}
        </Link>
        <Link href="/staff/radio" className="ops-pill" data-v={o.onAir ? "on" : undefined}>
          <span className="ops-pill-k">校内ラジオ</span>
          {o.onAir ? "放送中（ON AIR）" : "放送していません"}
        </Link>
      </nav>

      {todo && (
        <p className="ops-todo">
          <span>{todo === "open" ? "10:00 になったら、全部のお店を「営業中」にします" : "14:00 になったら、全部のお店を「終了」にします"}</span>
          <Link href={todo === "open" ? "/staff/tools#open" : "/staff/tools#close"} className="ops-todo-go">
            当日の道具へ
          </Link>
        </p>
      )}

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
                          // 送っているあいだは「押せない」印だけ（disabled にすると、キーボードで選んでいた所が消えるため）
                          <button
                            key={m.id}
                            type="button"
                            className="st-chip"
                            data-v={m.stock}
                            aria-disabled={busy || undefined}
                            aria-busy={sending[s.id]?.item === m.id || undefined}
                            onClick={() => !busy && setStock(s, m.id, NEXT[m.stock])}
                            aria-label={`${m.name}（いま ${STOCK_LABEL[m.stock]}。押すと${STOCK_LABEL[NEXT[m.stock]]}）`}
                          >
                            {m.name}
                            <span className="st-muted">{sending[s.id]?.item === m.id ? "送信中…" : STOCK_LABEL[m.stock]}</span>
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

      {/* 押した結果は、画面の下に固定して出す（スクロールしていても見える） */}
      <div className="ops-band">
        <div role="status" aria-live="polite">
          {note && !note.error && (
            <p className="ops-band-item">
              <span>{note.text}</span>
              {canUndo && undo && undoShop && (
                <button type="button" className="ops-band-act" onClick={() => setStock(undoShop, undo.item, undo.from, true)}>
                  元に戻す
                </button>
              )}
            </p>
          )}
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
