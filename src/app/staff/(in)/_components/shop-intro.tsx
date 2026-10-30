"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea, TextField } from "@/components/ui/field";
import { minutesOf } from "@/lib/schedule";
import type { Shop } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";
import { failText } from "./shop-result";
import { useLeaveGuard } from "./use-leave-guard";

type Item = { id: string; name: string; price: string; note: string };
/** 当日の流れの 1 行。k は画面の中だけの目印（保存しない） */
type Step = { k: string; time: string; text: string };
/** いま画面で書いている紹介（書きかけとして、この端末にも残す形） */
type Fields = { catch: string; description: string; message: string; schedule: Step[]; menu: Item[] };
/** 保存してある紹介（比べる・送る形。何も書いていない行は入れない） */
type Saved = { catch: string; description: string; message: string; schedule: { time: string; text: string }[]; menu: Item[] };
const PARTS = ["catch", "description", "message", "schedule", "menu"] as const;

let seq = 0;
/** 新しい英字の名前（時刻から作る）。品物を消して足しても前の名前を使い回さない（前の品物の売り切れが付かないように。例 m-mhd2k3x81） */
function newId(head: "m" | "r") {
  seq += 1;
  return `${head}-${Date.now().toString(36)}${seq}`;
}

/** 書きかけを残す場所（この端末の中だけ。お店ごと） */
const draftKey = (shopId: string) => `muchu-draft-${shopId}`;

/** 書く欄の id（「お客さんに見せる準備」の［書く］から、その欄へ飛ぶのに使う。shop-ready.tsx） */
export const INTRO_ID = {
  catch: "intro-catch",
  description: "intro-description",
  message: "intro-message",
  menu: "intro-menu",
  schedule: "intro-schedule",
  /** 品物ごとの値段の欄 */
  price: (itemId: string) => `intro-price-${itemId}`,
} as const;

function savedOf(s: Pick<Shop, "catch" | "description" | "message" | "schedule" | "menu">): Saved {
  return {
    catch: s.catch,
    description: s.description,
    message: s.message,
    schedule: s.schedule.map(({ time, text }) => ({ time, text })),
    menu: s.menu.map(({ id, name, price, note }) => ({ id, name, price, note })),
  };
}

function fieldsOf(s: Saved): Fields {
  return { ...s, schedule: s.schedule.map((x, i) => ({ k: `r${i}`, ...x })), menu: s.menu.map((m) => ({ ...m })) };
}

/** 送る形に（前後の空白を取り、何も書いていない行は捨てる。サーバーと同じ） */
function tidy(f: Fields): Saved {
  return {
    catch: f.catch.trim(),
    description: f.description.trim(),
    message: f.message.trim(),
    schedule: f.schedule.map((s) => ({ time: s.time.trim(), text: s.text.trim() })).filter((s) => s.time || s.text),
    menu: f.menu.map((m) => ({ id: m.id, name: m.name.trim(), price: m.price.trim(), note: m.note.trim() })).filter((m) => m.name || m.price || m.note),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const str = (v: unknown): v is string => typeof v === "string";

/** 端末に残っていた書きかけが、使える形か */
function isFields(v: unknown): v is Fields {
  const f = v as Partial<Fields> | null;
  return (
    !!f &&
    str(f.catch) &&
    str(f.description) &&
    str(f.message) &&
    Array.isArray(f.schedule) &&
    Array.isArray(f.menu) &&
    f.schedule.every((s) => !!s && str(s.k) && str(s.time) && str(s.text)) &&
    f.menu.every((m) => !!m && str(m.id) && str(m.name) && str(m.price) && str(m.note))
  );
}

/**
 * お店の人が「お店の紹介」を書く欄：ひとこと・どんなお店？・お店の思い・当日の流れ・メニュー。
 * 「保存」で、開いたとき（保存したとき）から変えた欄だけを送る。品物の残り（売り切れ）は上のボタンで変える。
 * 書きかけは、この端末（localStorage の muchu-draft-お店id）に残す。開いたときに残っていれば戻して知らせる。
 */
export function ShopIntroEditor({ shop, onSaved }: { shop: Shop; onSaved: (s: Shop) => void }) {
  const key = draftKey(shop.id);
  // saved：保存してある紹介（開いたとき・保存したとき）。f：いま画面で書いている紹介
  const [saved, setSaved] = useState(() => savedOf(shop));
  const [f, setF] = useState(() => fieldsOf(savedOf(shop)));
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  // 端末の書きかけを戻したか・読み終えたか（読む前に「書きかけなし」で消してしまわないように）
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  // 時刻の欄：読めない時刻は、欄を離れたあと（か保存を押したあと）に知らせる
  const [touched, setTouched] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  // 開け閉めは覚えておく（はじめは、まだ紹介が空なら開いておく）
  const [open, setOpen] = useState(!shop.description && !shop.message);

  const next = tidy(f);
  const changed = PARTS.filter((p) => !same(next[p], saved[p]));
  const dirty = changed.length > 0;
  useLeaveGuard(dirty);

  // 開いたとき：この端末に書きかけが残っていれば戻す
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const d = raw ? (JSON.parse(raw) as { fields?: unknown }) : null;
      if (d && isFields(d.fields) && !same(tidy(d.fields), savedOf(shop))) {
        /* eslint-disable react-hooks/set-state-in-effect -- 端末の中は、画面を出したあとでしか読めない */
        setF(d.fields);
        setRestored(true);
        setOpen(true);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // 読めない書きかけは使わない
    }
    setReady(true);
  }, [key, shop]);

  // 書きかけを、この端末に残す（保存したら・元どおりにしたら消す）
  useEffect(() => {
    if (!ready) return;
    try {
      if (dirty) localStorage.setItem(key, JSON.stringify({ at: Date.now(), fields: f }));
      else localStorage.removeItem(key);
    } catch {
      // 残せない端末（プライベートブラウズなど）は、そのまま
    }
  }, [ready, dirty, f, key]);

  const set = (patch: Partial<Fields>) => {
    setF((x) => ({ ...x, ...patch }));
    setMsg("");
  };
  const setItem = (id: string, patch: Partial<Item>) => setF((x) => ({ ...x, menu: x.menu.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const setStep = (k: string, patch: Partial<Step>) => setF((x) => ({ ...x, schedule: x.schedule.map((s) => (s.k === k ? { ...s, ...patch } : s)) }));

  function discard() {
    setF(fieldsOf(saved));
    setRestored(false);
    setTouched([]);
    setTried(false);
    setError("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    // 片方だけ書いた行は聞き返す（何も書いていない行は捨てる）
    if (next.menu.some((m) => !m.name)) return setError("メニューに、品物の名前が空の行があります。名前を書くか、その行を消してください");
    if (next.schedule.some((s) => !s.text)) return setError("当日の流れに「すること」が空の行があります。書くか、その行を消してください");
    if (!dirty) {
      setError("");
      return setMsg("変えたところはありません（保存してあります）");
    }
    const body: Partial<Saved> = Object.fromEntries(changed.map((p) => [p, next[p]]));
    setPending(true);
    setError("");
    setMsg("");
    const r = await send<{ shop: Shop | null }>(`/api/staff/shops/${shop.id}`, "PATCH", body);
    setPending(false);
    if (!r.ok) {
      return setError(failText("お店の紹介を保存できませんでした", r.error, "電波のよい所で、もう一度［お店の紹介を保存］を押してください。書いた内容は、この端末に残っています"));
    }
    setSaved((s) => ({ ...s, ...body }));
    // 何も書いていない行を片づける（送っているあいだに書いた分は残す）
    setF((x) => ({
      ...x,
      schedule: x.schedule.filter((s) => s.time.trim() || s.text.trim()),
      menu: x.menu.filter((m) => m.name.trim() || m.price.trim() || m.note.trim()),
    }));
    setRestored(false);
    setTried(false);
    setMsg(`お店の紹介を${savedAt()}`);
    // 品物の名前・数が変わったら、上の売り切れのボタンにも出す
    if (r.shop) onSaved(r.shop);
  }

  return (
    <details className="st-intro" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="st-intro-sum">
        <span>お店の紹介を書く</span>
        <span className="st-muted">お客さんのお店のページに出ます</span>
        {dirty && <span className="sh-unsaved">まだ保存していない書きかけがあります</span>}
      </summary>
      <form className="st-stack st-intro-body" onSubmit={save} noValidate>
        {restored && dirty && (
          <div className="sh-draft" role="status">
            <p>書きかけを戻しました（まだ保存していません）</p>
            <ConfirmDialog
              title="書きかけを消しますか？"
              confirmLabel="書きかけを消す"
              triggerLabel="書きかけを消す"
              triggerVariant="ghost"
              triggerSize="sm"
              onConfirm={discard}
            >
              保存してあるお店の紹介に戻します。消した書きかけは元に戻せません。
            </ConfirmDialog>
          </div>
        )}
        <TextField
          id={INTRO_ID.catch}
          label="ひとこと（一覧のカードに出る）"
          value={f.catch}
          maxLength={60}
          hint={`例：鉄板で焼きたて！（${f.catch.length}/60 字）`}
          onChange={(e) => set({ catch: e.target.value })}
        />
        <TextArea
          id={INTRO_ID.description}
          label="どんなお店？"
          value={f.description}
          maxLength={600}
          rows={4}
          hint={`例：学校の畑でとれたサツマイモで焼き芋を作ります（${f.description.length}/600 字）`}
          onChange={(e) => set({ description: e.target.value })}
        />
        <TextArea
          id={INTRO_ID.message}
          label="お店の思い"
          value={f.message}
          maxLength={600}
          rows={4}
          hint={`がんばったこと・来てほしい人へのひとことなど。例：夏から準備してきました。みんなに食べてほしいです！（${f.message.length}/600 字）`}
          onChange={(e) => set({ message: e.target.value })}
        />

        <fieldset className="st-intro-set" id={INTRO_ID.menu}>
          <legend>メニュー（{f.menu.length}）</legend>
          <p className="st-muted">値段が決まっていなければ空のままで大丈夫です。売り切れは上のボタンで変えてください。</p>
          <div className="st-rows">
            {f.menu.map((m) => (
              <div key={m.id} className="st-rowbox">
                <div className="st-rowbox-grid">
                  <TextField label="品物の名前" value={m.name} maxLength={40} hint="例：焼きそば" onChange={(e) => setItem(m.id, { name: e.target.value })} />
                  <TextField id={INTRO_ID.price(m.id)} label="値段" value={m.price} maxLength={30} hint="例：300 円" onChange={(e) => setItem(m.id, { price: e.target.value })} />
                  <TextField
                    label="ひとこと説明（お客さんに見えます）"
                    value={m.note}
                    maxLength={60}
                    hint="例：青のり・マヨつき"
                    onChange={(e) => setItem(m.id, { note: e.target.value })}
                  />
                </div>
                <div className="st-row">
                  <span className="st-grow" />
                  <Button variant="danger" size="sm" icon="消す" onClick={() => set({ menu: f.menu.filter((x) => x.id !== m.id) })}>
                    この品物を消す
                  </Button>
                </div>
              </div>
            ))}
            <Button icon="足す" onClick={() => set({ menu: [...f.menu, { id: newId("m"), name: "", price: "", note: "" }] })}>
              品物を足す
            </Button>
          </div>
        </fieldset>

        <fieldset className="st-intro-set" id={INTRO_ID.schedule}>
          <legend>当日の流れ（{f.schedule.length}）</legend>
          <p className="st-muted">「10:00　開店」「12:00　焼きたてができる」のように書くと、お客さんが来る時間を決めやすくなります。</p>
          <div className="st-rows">
            {f.schedule.map((s) => {
              const unreadable = s.time.trim() !== "" && minutesOf(s.time) === null && (tried || touched.includes(s.k));
              return (
                <div key={s.k} className="st-rowbox">
                  <div className="st-rowbox-grid st-rowbox-grid--2">
                    <TextField
                      label="時刻"
                      value={s.time}
                      maxLength={20}
                      hint="例：10:00"
                      error={unreadable ? "時刻として読めません。10:00 のように書いてください" : undefined}
                      onBlur={() => setTouched((l) => (l.includes(s.k) ? l : [...l, s.k]))}
                      onChange={(e) => setStep(s.k, { time: e.target.value })}
                    />
                    <TextField label="すること" value={s.text} maxLength={80} hint="例：開店。焼きたてから" onChange={(e) => setStep(s.k, { text: e.target.value })} />
                  </div>
                  <div className="st-row">
                    <span className="st-grow" />
                    <Button variant="danger" size="sm" icon="消す" onClick={() => set({ schedule: f.schedule.filter((x) => x.k !== s.k) })}>
                      この行を消す
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button icon="足す" onClick={() => set({ schedule: [...f.schedule, { k: newId("r"), time: "", text: "" }] })}>
              流れを足す
            </Button>
          </div>
        </fieldset>

        <div className="st-actions" role="group" aria-label="お店の紹介の保存">
          <Button type="submit" variant="primary" size="lg" pending={pending}>
            お店の紹介を保存
          </Button>
          {dirty ? (
            <span className="sh-unsaved" role="status">
              まだ保存していません
            </span>
          ) : (
            <span className="st-saved" role="status" aria-live="polite">
              {msg}
            </span>
          )}
          {error && (
            <p className="st-err st-grow" role="alert">
              {error}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
