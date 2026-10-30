"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Select, TextArea, TextField } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KIND_LABEL, STATE_LABEL, type Dept, type Kind, type MenuItem, type Place, type ScheduleItem, type Shop, type ShopState, areaOf, OUTSIDE, placeKindOf, placeLabeler, type Area } from "@/lib/types";
import { savedAt, send } from "../../../_lib/client";
import { useUnsavedGuard } from "./use-unsaved-guard";

/** 保存で送る欄（品物の残りは送らない。残りは「いまの様子」「お店の情報」の一覧で変える） */
const KEYS = ["name", "dept", "kind", "catch", "description", "message", "placeId", "placeNote", "hidden", "order", "state", "notice", "menu", "schedule"] as const;
type Key = (typeof KEYS)[number];

/** 品物は名前・値段・ひとこと説明と並びだけを比べる（残りは比べない） */
const menuSig = (menu: MenuItem[]) => JSON.stringify(menu.map((m) => [m.id, m.name, m.price, m.note]));
const scheduleSig = (list: ScheduleItem[]) => JSON.stringify(list.map((s) => [s.time, s.text]));
function same(k: Key, a: Shop, b: Shop) {
  if (k === "menu") return menuSig(a.menu) === menuSig(b.menu);
  if (k === "schedule") return scheduleSig(a.schedule) === scheduleSig(b.schedule);
  return a[k] === b[k];
}

let seq = 0;
/** 新しい品物の英字の名前。消した品物や、お店の人が同じころ足した品物と重ならないよう、時刻から作る（例 m-mhd2k3x81） */
function newItemId() {
  seq += 1;
  return `m-${Date.now().toString(36)}${seq}`;
}

/** 実行委員の、お店をまるごと編集する画面。保存では、開いた時から変えた欄だけを送る（お店の人があとで変えた売り切れ・お知らせなどを戻さない） */
/** お店の場所の選び方：外 → フロアの順に、「知育館 2階・201 小講義室」の形で（トイレ・建物などの設備は出さない） */
function placeOptions(places: Place[], areas: Area[]) {
  const where = placeLabeler(areas);
  const rank = (p: Place) => (areaOf(p) === OUTSIDE ? -1 : (areas.find((a) => a.id === areaOf(p))?.order ?? 999));
  return places
    .filter((p) => placeKindOf(p) === "spot")
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "ja", { numeric: true }))
    .map((p) => ({ value: p.id, label: areaOf(p) === OUTSIDE ? `外・${p.name}` : where(p) }));
}

export function ShopForm({ shop, places, areas, depts }: { shop: Shop; places: Place[]; areas: Area[]; depts: Dept[] }) {
  const router = useRouter();
  // base：開いた時（保存したあとは保存した時）の値。f：いま画面で直している値
  const [base, setBase] = useState(shop);
  const [f, setF] = useState(shop);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const changed = KEYS.filter((k) => !same(k, base, f));
  useUnsavedGuard(changed.length > 0);

  const set = <K extends keyof Shop>(k: K, v: Shop[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setMsg("");
  };
  const setItem = (i: number, patch: Partial<MenuItem>) => set("menu", f.menu.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setStep = (i: number, patch: Partial<ScheduleItem>) => set("schedule", f.schedule.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  async function save() {
    if (!f.name.trim()) return setError("お店の名前を入れてください");
    if (f.menu.some((m) => !m.name.trim())) return setError("名前が空の品物があります。入れるか、消してください");
    if (f.schedule.some((s) => !s.text.trim())) return setError("中身が空の「当日の流れ」があります。入れるか、消してください");
    if (!changed.length) {
      setError("");
      return setMsg("変えたところはありません");
    }
    const body: Record<string, unknown> = {};
    for (const k of changed) {
      body[k] = k === "menu" ? f.menu.map(({ id, name, price, note }) => ({ id, name, price, note })) : f[k];
    }
    const sent = f;
    setPending(true);
    setError("");
    const r = await send<{ shop: Shop }>(`/api/staff/shops/${shop.id}`, "PATCH", body);
    setPending(false);
    if (!r.ok) return setError(r.error);
    // 答えのお店（いちばん新しい値。ほかの人の変更も入っている）に合わせる。送っている間に打った文字は残す
    setBase(r.shop);
    setF((cur) => {
      const next: Shop = { ...r.shop };
      for (const k of KEYS) if (!same(k, cur, sent)) Object.assign(next, { [k]: cur[k] });
      return next;
    });
    setMsg(savedAt());
    router.refresh();
  }

  async function remove() {
    const r = await send(`/api/staff/shops/${shop.id}`, "DELETE");
    if (!r.ok) return setError(r.error);
    router.push("/staff/shops");
    router.refresh();
  }

  return (
    <form
      className="st-stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      <Card title="基本">
        <div className="st-form-grid">
          <TextField label="お店の名前" value={f.name} maxLength={40} onChange={(e) => set("name", e.target.value)} />
          <TextField label="ひとこと（一覧のカードに出る）" value={f.catch} maxLength={60} onChange={(e) => set("catch", e.target.value)} />
          <Select label="部門" value={f.dept} onChange={(e) => set("dept", e.target.value as Shop["dept"])} options={[...depts.map((d) => ({ value: d.id, label: d.name })), ...(depts.some((d) => d.id === f.dept) ? [] : [{ value: f.dept, label: "（消した部門）" }])]} />
          <Select
            label="「何したい？」の分け方"
            value={f.kind}
            onChange={(e) => set("kind", e.target.value as Kind)}
            options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
          <Select
            label="お店の状態"
            value={f.state}
            onChange={(e) => set("state", e.target.value as ShopState)}
            options={(Object.keys(STATE_LABEL) as ShopState[]).map((k) => ({ value: k, label: STATE_LABEL[k] }))}
            hint="変えたときだけ保存されます（お店の人も自分で変えられます）"
          />
          <TextField label="並べる順（小さいほど前）" type="number" inputMode="numeric" min={0} max={9999} value={f.order} onChange={(e) => set("order", Math.max(0, Math.min(9999, Number(e.target.value) || 0)))} />
          <TextArea className="st-span2" label="どんなお店？" value={f.description} maxLength={600} rows={4} onChange={(e) => set("description", e.target.value)} hint={`${f.description.length}/600 字`} />
          <TextArea className="st-span2" label="お店の思い" value={f.message} maxLength={600} rows={4} onChange={(e) => set("message", e.target.value)} hint={`お店の人の言葉をそのまま。名前は書かない（${f.message.length}/600 字）`} />
          <TextField className="st-span2" label="お客さんへのお知らせ" value={f.notice} maxLength={120} onChange={(e) => set("notice", e.target.value)} hint="変えたときだけ保存されます（お店の人も自分で変えられます）" />
          <div className="st-span2">
            <Checkbox label="お客さんの画面に出さない（非表示）" hint="中身ができるまで隠しておくとき" checked={f.hidden} onChange={(e) => set("hidden", e.target.checked)} />
          </div>
        </div>
      </Card>

      <Card title="場所">
        <div className="st-form-grid">
          <Select
            label="地図のピン"
            value={f.placeId}
            onChange={(e) => set("placeId", e.target.value)}
            options={[{ value: "", label: "未定" }, ...placeOptions(places, areas)]}
            hint="ピンは「地図のピン」の画面で足せます"
          />
          <TextField label="場所の補足" value={f.placeNote} maxLength={60} onChange={(e) => set("placeNote", e.target.value)} placeholder="例：201 号室" />
        </div>
      </Card>

      <Card title={`メニューと値段（${f.menu.length}）`}>
        <p className="st-muted">売り切れ・残りわずかは「いまの様子」か「お店の情報」の一覧で変えます（ここで保存しても変わりません）。</p>
        <div className="st-rows">
          {f.menu.map((m, i) => (
            <div key={m.id} className="st-rowbox">
              <div className="st-rowbox-grid">
                <TextField label="品物の名前" value={m.name} maxLength={40} onChange={(e) => setItem(i, { name: e.target.value })} />
                <TextField label="値段" value={m.price} maxLength={30} placeholder="例：300円" onChange={(e) => setItem(i, { price: e.target.value })} />
                <TextField label="ひとこと説明（お客さんに見えます）" value={m.note} maxLength={60} onChange={(e) => setItem(i, { note: e.target.value })} />
              </div>
              <div className="st-row">
                <span className="st-grow" />
                <Button variant="ghost" size="sm" icon="上げる" disabled={i === 0} onClick={() => set("menu", swap(f.menu, i, i - 1))}>
                  上へ
                </Button>
                <Button variant="danger" size="sm" icon="消す" onClick={() => set("menu", f.menu.filter((_, j) => j !== i))}>
                  消す
                </Button>
              </div>
            </div>
          ))}
          <Button icon="足す" onClick={() => set("menu", [...f.menu, { id: newItemId(), name: "", price: "", note: "", stock: "on" }])}>
            品物を足す
          </Button>
        </div>
      </Card>

      <Card title={`当日の流れ（${f.schedule.length}）`}>
        <div className="st-rows">
          {f.schedule.map((s, i) => (
            <div key={i} className="st-rowbox">
              <div className="st-rowbox-grid st-rowbox-grid--2">
                <TextField label="時間" value={s.time} maxLength={20} placeholder="例：11:00" onChange={(e) => setStep(i, { time: e.target.value })} />
                <TextField label="すること" value={s.text} maxLength={80} placeholder="例：開店。焼きたてから" onChange={(e) => setStep(i, { text: e.target.value })} />
              </div>
              <div className="st-row">
                <span className="st-grow" />
                <Button variant="ghost" size="sm" icon="上げる" disabled={i === 0} onClick={() => set("schedule", swap(f.schedule, i, i - 1))}>
                  上へ
                </Button>
                <Button variant="danger" size="sm" icon="消す" onClick={() => set("schedule", f.schedule.filter((_, j) => j !== i))}>
                  消す
                </Button>
              </div>
            </div>
          ))}
          <Button icon="足す" onClick={() => set("schedule", [...f.schedule, { time: "", text: "" }])}>
            流れを足す
          </Button>
        </div>
      </Card>

      <Card title="お店を消す">
        <p className="st-muted">お客さんの画面からも消えます。元に戻せません。お店の QR も使えなくなります。</p>
        <ConfirmDialog title={`「${shop.name}」を消しますか？`} confirmLabel="消す" triggerLabel="このお店を消す" triggerIcon="消す" onConfirm={remove}>
          お客さんの画面・地図・お店の QR から消えます。元に戻せません。
        </ConfirmDialog>
      </Card>

      <div className="st-actions" role="group" aria-label="保存">
        <Button type="submit" variant="primary" size="lg" pending={pending}>
          保存
        </Button>
        <span className="st-saved" role="status" aria-live="polite">
          {changed.length ? "まだ保存していない変更があります" : msg}
        </span>
        {error && (
          <p className="st-err st-grow" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function swap<T>(list: T[], a: number, b: number) {
  const next = list.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
