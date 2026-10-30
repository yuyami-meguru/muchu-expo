"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Select, TextArea, TextField } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { missingText, readinessOf } from "@/lib/readiness";
import {
  KIND_LABEL,
  STATE_LABEL,
  placeOptions,
  type Area,
  type Dept,
  type Kind,
  type MenuItem,
  type Place,
  type PlaceOption,
  type ScheduleItem,
  type Shop,
  type ShopState,
} from "@/lib/types";
import { savedAt, send } from "../../../_lib/client";
import { noteAuth } from "../../_components/session-signal";
import { useUnsavedGuard } from "./use-unsaved-guard";

/** 保存で送る欄（品物の残りは送らない。残りは「いまの様子」「お店の情報」の一覧で変える） */
const KEYS = ["name", "dept", "kind", "catch", "description", "message", "placeId", "placeNote", "hidden", "order", "state", "notice", "menu", "schedule"] as const;
type Key = (typeof KEYS)[number];

/** 欄の呼び名（ほかの人が直したときの知らせに使う。画面の見出しと同じ字） */
const KEY_LABEL: Record<Key, string> = {
  name: "お店の名前",
  dept: "部門",
  kind: "「何したい？」の分け方",
  catch: "ひとこと",
  description: "どんなお店？",
  message: "お店の思い",
  placeId: "地図のピン",
  placeNote: "場所の補足",
  hidden: "お客さんの画面に出すか",
  order: "並び順",
  state: "お店の状態",
  notice: "お店からのお知らせ",
  menu: "メニューと値段",
  schedule: "当日の流れ",
};
/** 文の欄（ほかの人の内容に置きかえたとき、自分が書いた文を下に残して見せる） */
const TEXT_KEYS: Key[] = ["name", "catch", "description", "message", "placeNote", "notice"];

/** 品物は名前・値段・ひとこと説明と並びだけを比べる（残りは比べない） */
const menuSig = (menu: MenuItem[]) => JSON.stringify(menu.map((m) => [m.id, m.name, m.price, m.note]));
const scheduleSig = (list: ScheduleItem[]) => JSON.stringify(list.map((s) => [s.time, s.text]));
function same(k: Key, a: Shop, b: Shop) {
  if (k === "menu") return menuSig(a.menu) === menuSig(b.menu);
  if (k === "schedule") return scheduleSig(a.schedule) === scheduleSig(b.schedule);
  return a[k] === b[k];
}
/** 送る形（品物は残りを除く） */
const wire = (k: Key, s: Shop) => (k === "menu" ? s.menu.map(({ id, name, price, note }) => ({ id, name, price, note })) : s[k]);

let seq = 0;
/** 新しい品物の英字の名前。消した品物や、お店の人が同じころ足した品物と重ならないよう、時刻から作る（例 m-mhd2k3x81） */
function newItemId() {
  seq += 1;
  return `m-${Date.now().toString(36)}${seq}`;
}

/** 選ぶ欄の中を、外・フロアごとにまとめる（placeOptions の並びのまま） */
function byGroup(options: PlaceOption[]) {
  const m = new Map<string, PlaceOption[]>();
  for (const o of options) m.set(o.group, [...(m.get(o.group) ?? []), o]);
  return [...m];
}

/** ほかの人と重なったとき：自分が書いていた文（欄 → 文）と、ほかの人の内容に置きかえた欄 */
type Clash = { keys: Key[]; mine: Partial<Record<Key, string>> };

/**
 * 実行委員の、お店をまるごと編集する画面。保存では、開いた時から変えた欄だけを送る（お店の人があとで変えた売り切れ・お知らせなどを戻さない）。
 * いっしょに、その欄の「開いたときの値」（base）も送る。そのあいだにほかの人（お店の人・ほかの実行委員）が同じ欄を直していたら、
 * サーバーが 409 で断る →「ほかの人が直しました［読み込み直す］」。読み込み直すと、その欄はほかの人の内容になり、自分の書いた文は下に残す。
 * 非表示のお店は、いちばん上に「いまはお客さんに見えていません［見せる］」と、次にすること。
 * 場所の選び方（placeOptions）は、地図のピンの「お店の場所を決める」と同じ（フロアごとにまとめ、ほかのお店の数も出す）
 */
export function ShopForm({
  shop,
  places,
  areas,
  depts,
  placeCount,
  added,
}: {
  shop: Shop;
  places: Place[];
  areas: Area[];
  depts: Dept[];
  /** 場所ごとの、ほかのお店の数 */
  placeCount: Record<string, number>;
  /** 「お店を足す」から来た */
  added: boolean;
}) {
  const router = useRouter();
  // base：開いた時（保存したあとは保存した時）の値。f：いま画面で直している値
  const [base, setBase] = useState(shop);
  const [f, setF] = useState(shop);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  /** 409（ほかの人が直した）：［読み込み直す］を出す */
  const [conflict, setConflict] = useState(false);
  /** 読み込み直して、ほかの人の内容に置きかえた欄 */
  const [clash, setClash] = useState<Clash | null>(null);
  const [showBusy, setShowBusy] = useState(false);
  const [showMsg, setShowMsg] = useState<{ text: string; error: boolean } | null>(null);
  /** ［読み込み直す］を押した（次に届いたお店の値で、重なった欄をほかの人の内容にする） */
  const [reloading, setReloading] = useState(false);
  const changed = KEYS.filter((k) => !same(k, base, f));
  useUnsavedGuard(changed.length > 0);

  // 読み込み直した値（router.refresh のあと、サーバーからの新しい shop）が届いたら、まぜる：
  //  - 自分が直していない欄 → 新しい値
  //  - 自分が直している欄 → そのまま（開いたときの値も古いまま。保存すると、ほかの人が直していればサーバーが知らせる）
  //  - ［読み込み直す］のあとで、ほかの人も直していた欄 → ほかの人の内容にして、自分の文は下に残す
  const [seen, setSeen] = useState(shop);
  if (shop !== seen) {
    setSeen(shop);
    if (shop.updatedAt >= base.updatedAt) {
      const take = reloading ? changed.filter((k) => !same(k, shop, base)) : [];
      if (reloading) setReloading(false);
      const nextBase: Shop = { ...shop };
      const nextF: Shop = { ...shop };
      for (const k of changed) {
        if (take.includes(k)) continue;
        Object.assign(nextBase, { [k]: base[k] });
        Object.assign(nextF, { [k]: f[k] });
      }
      setBase(nextBase);
      setF(nextF);
      if (take.length) {
        setClash({ keys: take, mine: Object.fromEntries(take.filter((k) => TEXT_KEYS.includes(k)).map((k) => [k, String(f[k])])) });
        setConflict(false);
        setError("");
      } else if (conflict) {
        setConflict(false);
        setError("");
      }
    }
  }

  const set = <K extends keyof Shop>(k: K, v: Shop[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setMsg("");
  };
  const setItem = (i: number, patch: Partial<MenuItem>) => set("menu", f.menu.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setStep = (i: number, patch: Partial<ScheduleItem>) => set("schedule", f.schedule.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  async function save() {
    if (!f.name.trim()) return setError("お店の名前を入れてください");
    if (f.menu.some((m) => !m.name.trim())) return setError("名前が空の品物があります。書くか、その品物を消してください");
    if (f.schedule.some((s) => !s.text.trim())) return setError("当日の流れに「すること」が空の行があります。書くか、その行を消してください");
    if (!changed.length) {
      setError("");
      return setMsg("変えたところはありません");
    }
    // 変えた欄と、その欄の「開いたときの値」（ほかの人が直していないかをサーバーが確かめる）
    const body: Record<string, unknown> = {};
    const was: Record<string, unknown> = {};
    for (const k of changed) {
      body[k] = wire(k, f);
      was[k] = wire(k, base);
    }
    body.base = was;
    const sent = f;
    setPending(true);
    setError("");
    setConflict(false);
    const r = noteAuth(await send<{ shop: Shop }>(`/api/staff/shops/${shop.id}`, "PATCH", body));
    setPending(false);
    if (!r.ok) {
      if (r.status === 409) setConflict(true);
      return setError(
        r.unsure
          ? "返事が来ませんでした。保存できているかもしれません。［お客さんの画面］で確かめるか、少し待ってから、もう一度［保存］を押してください（同じ内容なら、2 回押しても大丈夫です）"
          : r.status === 401 || r.status === 403
            ? "ログインが切れています。画面のいちばん上の［合言葉で入り直す］から入り直して、もう一度［保存］を押してください（書いた内容は消えていません）"
            : r.error,
      );
    }
    // 答えのお店（いちばん新しい値。ほかの人の変更も入っている）に合わせる。送っている間に打った文字は残す
    setBase(r.shop);
    setF((cur) => {
      const next: Shop = { ...r.shop };
      for (const k of KEYS) if (!same(k, cur, sent)) Object.assign(next, { [k]: cur[k] });
      return next;
    });
    setClash(null);
    setMsg(savedAt());
    router.refresh();
  }

  /** ［読み込み直す］（409 のあと）：サーバーのいちばん新しい値を読み、ほかの人が直した欄はその内容にする */
  function reload() {
    setReloading(true);
    setError("");
    router.refresh();
  }

  /** いちばん上の［見せる］（非表示のお店）。この欄だけをすぐ保存する */
  async function show() {
    setShowBusy(true);
    setShowMsg(null);
    const r = noteAuth(await send<{ shop: Shop }>(`/api/staff/shops/${shop.id}`, "PATCH", { hidden: false, base: { hidden: true } }));
    setShowBusy(false);
    if (!r.ok) {
      if (r.status === 409) router.refresh();
      return setShowMsg({ text: r.unsure ? "返事が来ませんでした。少し待ってから、一覧で「表示中」になっているか確かめてください" : r.error, error: true });
    }
    // 非表示の欄だけ新しくする（ほかの書きかけはそのまま）
    setBase((b) => ({ ...b, hidden: r.shop.hidden, updatedAt: r.shop.updatedAt }));
    setF((x) => ({ ...x, hidden: r.shop.hidden }));
    setShowMsg({ text: "お客さんの画面に出しました。一覧・地図・ポスターの QR から見られます", error: false });
    router.refresh();
  }

  async function remove() {
    const r = noteAuth(await send(`/api/staff/shops/${shop.id}`, "DELETE"));
    if (!r.ok) return setError(r.unsure ? "返事が来ませんでした。一覧を開いて、消えているか確かめてください" : r.error);
    router.push("/staff/shops");
    router.refresh();
  }

  // 場所の選び方（外 → フロアの順。フロアごとにまとめる）
  const options = placeOptions(places, areas);
  const groups = byGroup(options);
  const known = new Set(places.map((p) => p.id));
  const odd = f.placeId !== "" && !options.some((o) => o.value === f.placeId);
  const placeMoved = f.placeId !== base.placeId;
  // いまお客さんに出ている中身（保存してある値）で、準備の進み具合を出す
  const ready = readinessOf(base, known);
  const kindNow = KIND_LABEL[base.kind];

  return (
    <form
      className="st-stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      {base.hidden ? (
        <section className="st-hidden-box" aria-labelledby="st-hidden-h">
          <h2 id="st-hidden-h" className="st-hidden-h">
            {added ? `『${base.name}』を足しました。いまはお客さんの画面に出ていません（非表示）` : "このお店は、いまお客さんの画面に出ていません（非表示）"}
          </h2>
          <p className="st-hidden-ready">{ready.ready ? "✓ お客さんに見せる準備はできています" : `まだ：${missingText(ready)}`}</p>
          <ol className="st-hidden-steps">
            <li>「何したい？」の分け方を確かめる（いま：{kindNow}）</li>
            <li>下の「場所」で場所を決める（「地図のピン」の「お店の場所を決める」でも決められます）</li>
            <li>ひとこと・どんなお店？・メニューと値段を入れる（お店の人も、お店の QR から書けます）</li>
            <li>
              <a href={`/staff/qr#qr-${shop.id}`}>お店の人に配る QR</a> を刷って、このお店の人に渡す
            </li>
            <li>中身ができたら［見せる］（一覧の［見せる］でも同じです）</li>
          </ol>
          <div className="st-row">
            <Button variant="primary" pending={showBusy} onClick={show}>
              見せる
            </Button>
            {/* 非表示のあいだも、実行委員には「非表示」の帯つきで見える（ほかの人には見つからない）。書きかけを消さないよう新しいタブで */}
            <Button href={`/shops/${shop.id}`} target="_blank" rel="noopener noreferrer" variant="secondary" icon="外へ">
              お客さんの画面で下見
            </Button>
            {changed.length > 0 && <span className="st-muted">（書きかけの欄は保存されません。あとで［保存］を押してください）</span>}
          </div>
          {showMsg && (
            <p className={showMsg.error ? "ops-result ops-result--ng" : "ops-result"} role={showMsg.error ? "alert" : "status"}>
              {showMsg.text}
            </p>
          )}
        </section>
      ) : (
        showMsg && !showMsg.error && (
          <p className="ops-result" role="status">
            ✓ {showMsg.text}
          </p>
        )
      )}

      {clash && (
        <section className="st-clash" aria-labelledby="st-clash-h" role="status">
          <h2 id="st-clash-h" className="st-clash-h">
            読み込み直しました。{clash.keys.map((k) => `「${KEY_LABEL[k]}」`).join("")}は、ほかの人が直した内容になっています
          </h2>
          {Object.keys(clash.mine).length > 0 ? (
            <>
              <p className="st-muted">あなたが書いていた文は下にあります。必要なら写して、もう一度直して［保存］を押してください。</p>
              {(Object.entries(clash.mine) as [Key, string][]).map(([k, v]) => (
                <details key={k} className="st-more-opt">
                  <summary>あなたが書いていた「{KEY_LABEL[k]}」</summary>
                  <p className="st-clash-text">{v || "（空）"}</p>
                </details>
              ))}
            </>
          ) : (
            <p className="st-muted">必要なら、もう一度直して［保存］を押してください。</p>
          )}
          <Button size="sm" variant="ghost" onClick={() => setClash(null)}>
            わかった（この知らせを閉じる）
          </Button>
        </section>
      )}

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
            hint="お客さんの一覧でしぼるときの分け方。食べ物・飲み物を売るなら「食べる・飲む」"
          />
          <Select
            label="お店の状態"
            value={f.state}
            onChange={(e) => set("state", e.target.value as ShopState)}
            options={(Object.keys(STATE_LABEL) as ShopState[]).map((k) => ({ value: k, label: STATE_LABEL[k] }))}
            hint="変えたときだけ保存されます（お店の人も自分で変えられます）"
          />
          <TextField label="並び順（小さいほど前）" type="number" inputMode="numeric" min={0} max={9999} value={f.order} onChange={(e) => set("order", Math.max(0, Math.min(9999, Number(e.target.value) || 0)))} />
          <TextArea className="st-span2" label="どんなお店？" value={f.description} maxLength={600} rows={4} onChange={(e) => set("description", e.target.value)} hint={`${f.description.length}/600 字`} />
          <TextArea className="st-span2" label="お店の思い" value={f.message} maxLength={600} rows={4} onChange={(e) => set("message", e.target.value)} hint={`お店の人の言葉をそのまま。人の名前・アレルギーのことは書かない（${f.message.length}/600 字）`} />
          <TextField className="st-span2" label="お店からのお知らせ" value={f.notice} maxLength={120} onChange={(e) => set("notice", e.target.value)} hint="変えたときだけ保存されます（お店の人も自分で変えられます）" />
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
            hint="外・フロアごとに並んでいます。（ほかに 1 店）は、もうその場所にいるお店の数。ピンは「地図のピン」の画面で足せます"
          >
            <option value="">未定</option>
            {odd && <option value={f.placeId}>{known.has(f.placeId) ? "（トイレなど、お店用でないピン）" : "（消した場所）"}</option>}
            {groups.map(([g, list]) => (
              <optgroup key={g} label={g}>
                {list.map((o) => (
                  // 数は、ほかの場所にだけ付ける（選んでいる場所に付けると、せまい画面で選んだ場所の名前が切れるので。選んでいる場所の数は下に出す）
                  <option key={o.value} value={o.value}>
                    {o.value !== f.placeId && placeCount[o.value] ? `${o.label}（ほかに ${placeCount[o.value]} 店）` : o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <TextField label="場所の補足" value={f.placeNote} maxLength={60} onChange={(e) => set("placeNote", e.target.value)} placeholder="例：入口を入ってすぐ右" />
          {placeCount[f.placeId] > 0 && (
            <p className="st-muted st-span2 st-place-share">この場所には、ほかに {placeCount[f.placeId]} 店あります（同じ部屋・テントを分けて使うときは、「場所の補足」でどのあたりかを書きます）</p>
          )}
          {placeMoved && f.placeNote.trim() !== "" && (
            <p className="ops-warn st-span2" role="status">
              場所を変えました。「場所の補足」（{f.placeNote}）が、新しい場所に合っているか確かめてください。合わなければ直すか、空にしてください。
            </p>
          )}
        </div>
      </Card>

      <Card title={`メニューと値段（${f.menu.length}）`}>
        <p className="st-muted">売り切れ・残りわずかは「いまの様子」か「お店の情報」の一覧で変えます（ここで保存しても変わりません）。アレルギーのことは書かないでください（まちがえると危ないため）。</p>
        <div className="st-rows">
          {f.menu.map((m, i) => (
            <div key={m.id} className="st-rowbox">
              <div className="st-rowbox-grid">
                <TextField label="品物の名前" value={m.name} maxLength={40} onChange={(e) => setItem(i, { name: e.target.value })} />
                <TextField label="値段" value={m.price} maxLength={30} placeholder="例：300 円" onChange={(e) => setItem(i, { price: e.target.value })} />
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
        <p className="st-muted">場所がちがう発表は、場所ごとに別のお店・出し物として足すと、タイムテーブルに正しい場所が出ます。</p>
        <div className="st-rows">
          {f.schedule.map((s, i) => (
            <div key={i} className="st-rowbox">
              <div className="st-rowbox-grid st-rowbox-grid--2">
                <TextField label="時刻" value={s.time} maxLength={20} placeholder="例：11:00" onChange={(e) => setStep(i, { time: e.target.value })} />
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
        <p className="st-muted">お客さんの画面からも消えます。元に戻せません。お店の QR も使えなくなります。しばらく出さないだけなら、上の「非表示」にしてください。</p>
        <ConfirmDialog title={`「${shop.name}」を消しますか？`} confirmLabel="消す" triggerLabel="このお店を消す" triggerIcon="消す" onConfirm={remove}>
          お客さんの画面・地図・お店の QR から消えます。元に戻せません。
        </ConfirmDialog>
      </Card>

      <div className="st-actions" role="group" aria-label="保存">
        <Button type="submit" variant="primary" size="lg" pending={pending}>
          保存
        </Button>
        <span className="st-saved" role="status" aria-live="polite">
          {changed.length ? `まだ保存していない変更があります（${changed.map((k) => KEY_LABEL[k]).join("・")}）` : msg}
        </span>
        {error && (
          <div className="st-err st-grow" role="alert">
            <p className="st-err-text">{error}</p>
            {conflict && (
              <Button size="sm" variant="secondary" onClick={reload}>
                読み込み直す
              </Button>
            )}
          </div>
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
