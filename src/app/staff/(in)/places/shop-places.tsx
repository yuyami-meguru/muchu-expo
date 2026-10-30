"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import { Select } from "@/components/ui/field";
import { deptLookup, placeLabeler, placeOptions, type Area, type Dept, type Place, type PlaceOption, type Shop } from "@/lib/types";
import { send } from "../../_lib/client";
import { OnlyToggle } from "../_components/only-toggle";
import { noteAuth } from "../_components/session-signal";
import { failText, nowClock, visible, without, type Result } from "../_components/shop-result";

/** 選ぶ欄の中を、外・フロアごとにまとめる（placeOptions の並びのまま） */
function byGroup(options: PlaceOption[]) {
  const m = new Map<string, PlaceOption[]>();
  for (const o of options) m.set(o.group, [...(m.get(o.group) ?? []), o]);
  return [...m];
}

/**
 * 実行委員の「お店の場所を決める」（地図のピンの画面のいちばん下）。全部のお店を 1 行ずつ並べ、場所を選ぶとすぐ保存する（PATCH { placeId }）。
 * 選び方はお店の編集と同じ（placeOptions：外 → フロアの順）。ここではフロアごとにまとめ、場所の横に、もうそこにいるお店の数を出す。
 * 結果は行の下に出す（「✓ 保存しました 12:03」、失敗は赤で理由と［もう一度］）。結果の 1 行ぶんは先に空けておく（出ても下の行がずれないように）。
 * 同じお店を続けて選び直したら、送っている途中の分が終わってから、最後に選んだ場所だけを送る（答えの順が入れかわって、前の場所が残らないように）
 */
export function ShopPlaces({ shops, places, areas, depts }: { shops: Shop[]; places: Place[]; areas: Area[]; depts: Dept[] }) {
  const router = useRouter();
  // 保存できた場所（お店 id → 場所と、そのときのお店の updatedAt）。ページを読み直した値より新しいあいだは、こちらを使う
  const [saved, setSaved] = useState<Record<string, { placeId: string; at: number }>>({});
  // 選んで、まだ保存できていない場所（送っている途中・順番待ち）。選ぶ欄にはこちらを出す
  const [want, setWant] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  // 「未定のお店だけ」：押したときに未定だったお店（場所を決めたあとも ✓ が見えるよう、押し直すまで出しておく）
  const [only, setOnly] = useState<string[] | null>(null);
  // 送っている途中のお店と、その次に送る場所（画面に出さないので ref）
  const inflight = useRef(new Set<string>());
  const queued = useRef(new Map<string, string>());

  const dept = deptLookup(depts);
  const where = placeLabeler(areas);
  const options = placeOptions(places, areas);
  const groups = byGroup(options);
  const known = new Map(places.map((p) => [p.id, p]));
  const savedOf = (s: Shop) => {
    const m = saved[s.id];
    return m && m.at >= s.updatedAt ? m.placeId : s.placeId;
  };
  const shownOf = (s: Shop) => want[s.id] ?? savedOf(s);
  // 未定：場所を選んでいない・選んだピンが消された（お客さんの画面にも場所が出ない）
  const undecided = (s: Shop) => !known.has(shownOf(s));
  const labelOf = (id: string) => (!id ? "未定" : (options.find((o) => o.value === id)?.label ?? (known.has(id) ? where(known.get(id)) : "（消した場所）")));

  // 場所ごとの、いまそこにいるお店の数（選んで送っている途中の分も入れる）
  const count = new Map<string, number>();
  for (const s of shops) {
    const v = shownOf(s);
    if (v) count.set(v, (count.get(v) ?? 0) + 1);
  }
  const tbd = shops.filter(undecided).length;
  const rows = only ? shops.filter((s) => only.includes(s.id) || undecided(s)) : shops;

  /** 場所を選んだ。同じお店を送っている途中なら、終わってから（最後に選んだ分だけ）送る */
  function choose(s: Shop, placeId: string) {
    setWant((m) => ({ ...m, [s.id]: placeId }));
    setResults((m) => without(m, s.id));
    if (inflight.current.has(s.id)) {
      queued.current.set(s.id, placeId);
      return;
    }
    void run(s, placeId);
  }

  async function run(s: Shop, first: string) {
    inflight.current.add(s.id);
    let placeId: string | undefined = first;
    let last: Result | null = null;
    let unsure = false;
    while (placeId !== undefined) {
      queued.current.delete(s.id);
      const target: string = placeId;
      // ログインが切れていたら、上の帯（入り直し）にも知らせる
      const r = noteAuth(await send<{ shop: Shop | null }>(`/api/staff/shops/${s.id}`, "PATCH", { placeId: target }));
      if (r.ok) {
        if (r.shop) {
          const { placeId: now, updatedAt } = r.shop;
          setSaved((m) => ({ ...m, [s.id]: { placeId: now, at: updatedAt } }));
        }
        last = { ok: true, value: target, text: `✓ 保存しました ${nowClock()}` };
      } else if (r.unsure) {
        // 返事が来なかった：保存できているかもしれない。読み直して、選ぶ欄をサーバーの場所にする
        // （保存できていれば、選ぶ欄がその場所になり、この文は visible() で消える。できていなければ残る）
        unsure = true;
        const label = labelOf(target);
        last = { ok: false, value: target, text: `返事が来ませんでした。選ぶ欄を、いま保存されている場所にしました。「${label}」でなければ、もう一度押してください`, retry: () => choose(s, target) };
      } else {
        last = { ok: false, value: target, text: failText(`「${labelOf(target)}」にできませんでした`, r.error), retry: () => choose(s, target) };
      }
      placeId = queued.current.get(s.id);
    }
    inflight.current.delete(s.id);
    const done = last;
    setWant((m) => without(m, s.id));
    if (done) setResults((m) => ({ ...m, [s.id]: done }));
    // 上の地図のピンの数（その場所のお店の数）も新しくする。返事が来なかったときは、保存できたかを読み直して確かめる
    if (done?.ok || unsure) router.refresh();
  }

  return (
    <Card title="お店の場所を決める" id="shop-places" className="st-sp">
      <p className="st-muted">
        選ぶとすぐ保存します（お客さんのお店のページと地図に出ます）。場所の横の（2）は、もうその場所にいるお店の数です。選べるのは、上の地図の「お店・出し物の場所」のピンと部屋の四角です（トイレ・受付などは出しません）。小さな字の「場所の補足」は、「お店の情報」でお店を開いて直します。
      </p>
      <div className="st-sp-bar">
        <p className="st-sp-count">
          場所が未定のお店：<strong>{tbd}</strong>
          <span className="st-muted">（全部で {shops.length} 店）</span>
        </p>
        <OnlyToggle on={!!only} onChange={(on) => setOnly(on ? shops.filter(undecided).map((s) => s.id) : null)}>
          未定のお店だけ
        </OnlyToggle>
      </div>
      {rows.length ? (
        <ul className="st-sp-list">
          {rows.map((s) => {
            const d = dept(s.dept);
            const value = shownOf(s);
            const busy = s.id in want;
            const res = busy ? undefined : visible(results[s.id], value);
            // 選ぶ欄に無い場所（消したピン・設備のピン）を選んでいるとき、その場所も出しておく（「未定」に見えてしまわないように）
            const odd = value !== "" && !options.some((o) => o.value === value);
            return (
              <li key={s.id} className={`st-sp-row tone-${d.color}`}>
                <Select
                  label={
                    <>
                      <span className="st-dot" aria-hidden="true" />
                      <span className="st-sp-name">{s.name}</span>
                      <span className="st-sp-dept">{d.short}</span>
                      {s.hidden && <span className="st-badge st-badge--hidden">非表示</span>}
                    </>
                  }
                  value={value}
                  onChange={(e) => choose(s, e.target.value)}
                  aria-busy={busy || undefined}
                  hint={s.placeNote ? `場所の補足：${s.placeNote}` : undefined}
                >
                  <option value="">未定</option>
                  {odd && <option value={value}>{labelOf(value)}</option>}
                  {groups.map(([g, list]) => (
                    <optgroup key={g} label={g}>
                      {list.map((o) => (
                        // 数は、ほかの場所にだけ付ける（選んでいる場所に付けると、せまい画面で選んだ場所の名前が切れるので）
                        <option key={o.value} value={o.value}>
                          {o.value !== value && count.get(o.value) ? `${o.label}（${count.get(o.value)}）` : o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <div className={cx("sh-result st-sp-result", res && !res.ok && "sh-result--ng")} role="status">
                  {busy ? (
                    <p className="st-sp-wait">送信中…</p>
                  ) : res?.ok ? (
                    <p className="sh-result-ok">{res.text}</p>
                  ) : res ? (
                    <>
                      <p className="sh-result-ng">{res.text}</p>
                      {res.retry && (
                        <Button size="sm" variant="danger" onClick={res.retry}>
                          もう一度
                        </Button>
                      )}
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="st-sp-none">{shops.length ? "場所が未定のお店はありません。" : "お店がまだありません（「お店の情報」の「お店を足す」で足せます）。"}</p>
      )}
    </Card>
  );
}
