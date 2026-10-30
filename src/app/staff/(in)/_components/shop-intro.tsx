"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea, TextField } from "@/components/ui/field";
import { minutesOf } from "@/lib/schedule";
import type { Kind, Shop } from "@/lib/types";
import { send } from "../../_lib/client";
import { failText, nowClock, stamp } from "./shop-result";
import { useLeaveGuard } from "./use-leave-guard";

/** 品物の 1 行。gone は［この品物を消す］を押した印（保存するまで［元に戻す］で戻せる。送るときは入れない） */
type Item = { id: string; name: string; price: string; note: string; gone?: boolean };
/** 当日の流れの 1 行。k は画面の中だけの目印（保存しない）。gone は品物と同じ */
type Step = { k: string; time: string; text: string; gone?: boolean };
/** いま画面で書いている紹介（書きかけとして、この端末にも残す形） */
type Fields = { catch: string; description: string; message: string; schedule: Step[]; menu: Item[] };
/** 保存してある紹介（比べる・送る形。何も書いていない行・消した行は入れない） */
type Saved = { catch: string; description: string; message: string; schedule: { time: string; text: string }[]; menu: { id: string; name: string; price: string; note: string }[] };
type Part = keyof Saved;
const PARTS: Part[] = ["catch", "description", "message", "schedule", "menu"];
/**
 * 書き始めたときの保存の値（欄ごと）。保存では、変えた欄といっしょにこれを base として送り、
 * サーバーの今の値とちがえば（ほかの人がその欄を直した）書かずに 409 が返る。null は分からない（前の版の書きかけ）
 */
type Base = { [P in Part]: Saved[P] | null };
/** 画面の中身：書いている紹介と、その土台 */
type Doc = { f: Fields; base: Base };

/** 品物・流れの数の上限（lib/api.ts の zMenu・zSchedule と同じ） */
const MAX_ITEMS = 40;
const MAX_STEPS = 30;

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
const nameId = (itemId: string) => `intro-name-${itemId}`;
const textId = (k: string) => `intro-text-${k}`;
const undoId = (id: string) => `intro-undo-${id}`;
const conflictId = (p: Part) => `intro-conflict-${p}`;

/** 欄の名前（出し物は「どんな出し物？」「出し物にこめた思い」） */
export function partLabel(p: Part, kind: Kind) {
  if (kind === "see" && p === "description") return "どんな出し物？";
  if (kind === "see" && p === "message") return "出し物にこめた思い";
  return { catch: "ひとこと", description: "どんなお店？", message: "お店の思い", schedule: "当日の流れ", menu: "メニュー" }[p];
}

function savedOf(s: Pick<Shop, "catch" | "description" | "message" | "schedule" | "menu">): Saved {
  return {
    catch: s.catch,
    description: s.description,
    message: s.message,
    schedule: s.schedule.map(({ time, text }) => ({ time, text })),
    menu: s.menu.map(({ id, name, price, note }) => ({ id, name, price, note })),
  };
}

/** 保存の値 → 書く欄の形（流れの行には画面の中だけの目印を付ける） */
function fieldPart<P extends Part>(p: P, v: Saved[P]): Fields[P] {
  if (p === "schedule") return (v as Saved["schedule"]).map((x, i) => ({ k: `r${i}`, ...x })) as Fields[P];
  if (p === "menu") return (v as Saved["menu"]).map((m) => ({ ...m })) as Fields[P];
  return v as Fields[P];
}

function fieldsOf(s: Saved): Fields {
  return { ...s, schedule: fieldPart("schedule", s.schedule), menu: fieldPart("menu", s.menu) };
}

/** 送る形に（前後の空白を取り、何も書いていない行・消した行は捨てる。サーバーと同じ） */
function tidy(f: Fields): Saved {
  return {
    catch: f.catch.trim(),
    description: f.description.trim(),
    message: f.message.trim(),
    schedule: f.schedule
      .filter((s) => !s.gone)
      .map((s) => ({ time: s.time.trim(), text: s.text.trim() }))
      .filter((s) => s.time || s.text),
    menu: f.menu
      .filter((m) => !m.gone)
      .map((m) => ({ id: m.id, name: m.name.trim(), price: m.price.trim(), note: m.note.trim() }))
      .filter((m) => m.name || m.price || m.note),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const str = (v: unknown): v is string => typeof v === "string";
const opt = (v: unknown) => v === undefined || typeof v === "boolean";

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
    f.schedule.every((s) => !!s && str(s.k) && str(s.time) && str(s.text) && opt(s.gone)) &&
    f.menu.every((m) => !!m && str(m.id) && str(m.name) && str(m.price) && str(m.note) && opt(m.gone))
  );
}

/** 端末に残っていた土台が、使える形か（v0.12.0 より前の書きかけには無い） */
function isBase(v: unknown): v is Base {
  const b = v as Partial<Record<Part, unknown>> | null;
  if (!b || typeof b !== "object") return false;
  const ok = (x: unknown, check: (y: unknown) => boolean) => x === null || check(x);
  return (
    ok(b.catch, str) &&
    ok(b.description, str) &&
    ok(b.message, str) &&
    ok(b.schedule, (y) => Array.isArray(y) && y.every((s) => !!s && str(s.time) && str(s.text))) &&
    ok(b.menu, (y) => Array.isArray(y) && y.every((m) => !!m && str(m.id) && str(m.name) && str(m.price) && str(m.note)))
  );
}

/**
 * 保存の値（server）が新しくなったときに、画面の中身をそろえる：
 *  - 書きかえていない欄（土台と同じ）は、新しい値にする（ほかの人が直した分を、黙って取りこむ）
 *  - 書きかえた欄が、いまの保存と同じになっていれば（自分の保存が届いていた・ほかの人も同じに直した）、土台も新しい値に
 *  - 書きかえた欄で、保存もほかの人に直されていれば、そのまま（「ほかの人が直しました」の黄色い所を出す＝conflicts）
 */
function sync(d: Doc, server: Saved): Doc {
  const mine = tidy(d.f);
  let f = d.f;
  const base = { ...d.base };
  for (const p of PARTS) {
    if (same(mine[p], base[p])) {
      if (!same(base[p], server[p])) {
        f = { ...f, [p]: fieldPart(p, server[p]) };
        (base as Record<Part, unknown>)[p] = server[p];
      }
    } else if (same(mine[p], server[p])) {
      (base as Record<Part, unknown>)[p] = server[p];
    }
  }
  return f === d.f && same(base, d.base) ? d : { f, base };
}

/** 黄色い所に出す「いま保存されている中身」（短く） */
function summaryOf(p: Part, v: Saved[Part]) {
  if (p === "menu") {
    const list = v as Saved["menu"];
    return list.length ? list.map((m) => [m.name, m.price].filter(Boolean).join(" ")).join(" ／ ") : "（品物なし）";
  }
  if (p === "schedule") {
    const list = v as Saved["schedule"];
    return list.length ? list.map((s) => `${s.time} ${s.text}`.trim()).join(" ／ ") : "（なし）";
  }
  return (v as string) ? `『${v as string}』` : "（空）";
}

type Problem =
  | { kind: "rows"; text: string }
  | { kind: "conflict" }
  | { kind: "error"; text: string }
  | { kind: "expired" }
  | { kind: "notLanded" }
  | { kind: "reloaded" };

/** 保存の帯に出す短い 1 行（くわしい文は帯の外、すぐ上に出す。帯が画面をふさがないように） */
const SHORT: Record<Problem["kind"], string> = {
  rows: "直す所があります（赤い所）",
  conflict: "ほかの人が直した所があります（黄色い所）",
  error: "保存できませんでした",
  expired: "ログインが切れました",
  notLanded: "保存できていませんでした",
  reloaded: "もう一度押してください",
};

function problemText(p: Problem, saveLabel: string) {
  switch (p.kind) {
    case "rows":
    case "error":
      return p.text;
    case "conflict":
      return "ほかの人（実行委員か、別のスマホ）が、同じ所を直していました。書いた内容は残っています。黄色い所で、どちらにするか選んでから、もう一度［" + saveLabel + "］を押してください";
    case "expired":
      return "ログインが切れました。書いた内容は、このスマホに残っています。お店の QR をもう一度カメラで読み取ってから、［" + saveLabel + "］を押してください";
    case "notLanded":
      return "返事が来ないあいだに、保存できていませんでした。書いた内容は、このスマホに残っています。電波のよい所で、もう一度［" + saveLabel + "］を押してください";
    case "reloaded":
      return "いまの保存を読み込みました。書いた内容は残っています。もう一度［" + saveLabel + "］を押してください";
  }
}

/**
 * ほかの人が同じ欄を直していたときの黄色い所（どちらにするかを選ぶ）。
 * unknown は、いつ書いたか分からない前の版の書きかけで、保存とちがう欄（ほかの人が直したかは分からない）
 */
function ConflictBox({ part, label, now, unknown, onServer, onMine }: { part: Part; label: string; now: string; unknown: boolean; onServer: () => void; onMine: () => void }) {
  return (
    <div className="sh-conflict" id={conflictId(part)} tabIndex={-1} role="group" aria-label={`「${label}」をどちらにするか`}>
      <p className="sh-conflict-h">
        {unknown ? `この書きかけの「${label}」は、いま保存されている内容とちがいます。` : `ほかの人（実行委員か、別のスマホ）が、「${label}」を直していました。`}
      </p>
      <p className="sh-conflict-now">
        いま保存されているのは：<span>{now}</span>
      </p>
      <div className="sh-conflict-act">
        <Button size="sm" onClick={onServer}>
          保存されている方にする
        </Button>
        <Button size="sm" variant="ghost" onClick={onMine}>
          自分が書いた方にする
        </Button>
      </div>
    </div>
  );
}

/** 消した行（保存するまで［元に戻す］で戻せる） */
function GoneRow({ id, text, onUndo }: { id: string; text: string; onUndo: () => void }) {
  return (
    <div className="sh-gone" role="status">
      <p>{text}（まだ保存していません）</p>
      <Button size="sm" variant="secondary" id={undoId(id)} onClick={onUndo}>
        元に戻す
      </Button>
    </div>
  );
}

/** 「人の名前・アレルギーは書かない」の短い一文（欄のそばに出す） */
const NO_NAMES = "人の名前（生徒・先生）は書かないでください";
const NO_ALLERGY = "アレルギー（卵・小麦など）のことは書かないでください（まちがいがあると危ないため）";

/**
 * お店の人が「お店の紹介」を書く欄：ひとこと・どんなお店？・お店の思い・メニュー・当日の流れ。
 * 「保存」で、書き始めたときから変えた欄だけを、書き始めたときの値（base）といっしょに送る。
 *  - ほかの人がその欄を先に直していたら、サーバーが 409 を返す → 読み込み直して、その欄に黄色い「どちらにするか」を出す（書きかけは残す）
 *  - 開いているあいだに保存が新しくなったら（押した答え・読み込み直し）、書きかえていない欄は新しい値にそろえる
 *  - 返事が来なかったら、読み込み直して、保存できていたかを確かめる
 * 書きかけは、この端末（localStorage の muchu-draft-お店id）に土台ごと残す。開いたときに残っていれば戻して知らせる。
 * 品物の残り（売り切れ）は「売り切れ」のボタンで変える。
 */
export function ShopIntroEditor({
  shop,
  layout,
  today,
  reloading,
  onSaved,
  onReload,
  onExpired,
}: {
  /** いちばん新しく分かっているお店（押した答え・読み込み直しで新しくなる） */
  shop: Shop;
  /** 開催前は開いておく（準備でいちばん使うので） */
  layout: "before" | "day";
  /** 日付を付けるか決める基準の時刻（サーバー。分からなければ null） */
  today: number | null;
  /** ページの中身を読み込み直している途中 */
  reloading: boolean;
  onSaved: (s: Shop) => void;
  /** ページの中身を読み込み直す（ほかの人が直した値を知る） */
  onReload: () => void;
  onExpired: () => void;
}) {
  const key = draftKey(shop.id);
  const kind = shop.kind;
  const label = (p: Part) => partLabel(p, kind);
  const server = useMemo(() => savedOf(shop), [shop]);
  const serverKey = JSON.stringify(server);
  const [doc, setDoc] = useState<Doc>(() => ({ f: fieldsOf(savedOf(shop)), base: savedOf(shop) }));
  // 画面にそろえ終わった保存の値（新しくなったら sync する）
  const [seen, setSeen] = useState(serverKey);
  if (seen !== serverKey) {
    setSeen(serverKey);
    setDoc((d) => sync(d, server));
  }
  const f = doc.f;
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  // 送ったあと、読み込み直して確かめている途中（返事が来なかった・ほかの人が直していた）。started は読み込みが始まった印
  const [verify, setVerify] = useState<{ why: "unsure" | "conflict"; started: boolean } | null>(null);
  // 端末の書きかけを戻したか（いつの書きかけか）・読み終えたか（読む前に「書きかけなし」で消してしまわないように）
  const [restored, setRestored] = useState<{ at: number | null } | null>(null);
  const [ready, setReady] = useState(false);
  // 時刻の欄：読めない時刻は、欄を離れたあと（か保存を押したあと）に知らせる
  const [touched, setTouched] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  // 開け閉めは覚えておく（開催前は開いておく。当日は、まだ紹介が空なら開いておく）
  const [open, setOpen] = useState(layout === "before" || (!shop.description && !shop.message));
  const serverRef = useRef(server);
  useEffect(() => {
    serverRef.current = server;
  });

  const next = tidy(f);
  const changed = PARTS.filter((p) => !same(next[p], doc.base[p]));
  const conflicts = changed.filter((p) => !same(server[p], doc.base[p]) && !same(server[p], next[p]));
  const dirty = changed.length > 0;
  const busy = pending || !!verify;
  useLeaveGuard(dirty);
  // 戻した書きかけが無くなったら（［保存されている方にする］・元の文に書き直した）、「…の書きかけを戻しました」は終わり
  // （そのあと書き始めた分に、前の時刻の「戻しました」を出さない）
  if (restored && !dirty) setRestored(null);

  // 品物の名前がない行・することがない行（何か書いてある行だけ）
  const noName = f.menu.filter((m) => !m.gone && !m.name.trim() && (m.price.trim() || m.note.trim()));
  const noText = f.schedule.filter((s) => !s.gone && !s.text.trim() && s.time.trim());

  // 開いたとき：この端末に書きかけが残っていれば戻す（土台が無い前の版の書きかけは、保存とちがう欄を「どちらにするか」で聞く）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const d = raw ? (JSON.parse(raw) as { at?: unknown; fields?: unknown; base?: unknown }) : null;
      if (d && isFields(d.fields)) {
        const S = serverRef.current;
        const fields = d.fields;
        const mine = tidy(fields);
        const base: Base = isBase(d.base) ? d.base : { catch: null, description: null, message: null, schedule: null, menu: null };
        for (const p of PARTS) if (base[p] === null && same(mine[p], S[p])) (base as Record<Part, unknown>)[p] = S[p];
        const got = sync({ f: fields, base }, S);
        if (PARTS.some((p) => !same(tidy(got.f)[p], got.base[p]))) {
          // 端末の中は、画面を出したあとでしか読めない
          setDoc(got);
          setRestored({ at: typeof d.at === "number" ? d.at : null });
          setOpen(true);
        }
      }
    } catch {
      // 読めない書きかけは使わない
    }
    setReady(true);
  }, [key]);

  // 書きかけを、土台ごとこの端末に残す（保存したら・元どおりにしたら消す）
  useEffect(() => {
    if (!ready) return;
    try {
      if (dirty) localStorage.setItem(key, JSON.stringify({ v: 2, at: Date.now(), fields: doc.f, base: doc.base }));
      else localStorage.removeItem(key);
    } catch {
      // 残せない端末（プライベートブラウズなど）は、そのまま
    }
  }, [ready, dirty, doc, key]);

  // 読み込み直しが終わったら、保存できていたか・ほかの人の直しとぶつかっていないかを確かめる
  const conflictKey = conflicts.join(",");
  useEffect(() => {
    if (!verify) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 読み込み直し（ページの中身）が終わったのは、描き終えたあとでしか分からない */
    if (reloading) {
      if (!verify.started) setVerify({ ...verify, started: true });
      return;
    }
    if (!verify.started || seen !== serverKey) return;
    setVerify(null);
    if (conflictKey) setProblem({ kind: "conflict" });
    else if (!dirty) {
      setProblem(null);
      setMsg(verify.why === "unsure" ? `お店の紹介を保存しました（${nowClock()}）` : "保存してあります（ほかの所で同じ内容になっていました）");
    } else setProblem({ kind: verify.why === "unsure" ? "notLanded" : "reloaded" });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [verify, reloading, seen, serverKey, conflictKey, dirty]);

  const edit = (fn: (f: Fields) => Fields) => {
    setDoc((d) => ({ ...d, f: fn(d.f) }));
    setMsg("");
    if (problem?.kind !== "conflict" && problem?.kind !== "expired") setProblem(null);
  };
  const set = (patch: Partial<Fields>) => edit((x) => ({ ...x, ...patch }));
  const setItem = (id: string, patch: Partial<Item>) => edit((x) => ({ ...x, menu: x.menu.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const setStep = (k: string, patch: Partial<Step>) => edit((x) => ({ ...x, schedule: x.schedule.map((s) => (s.k === k ? { ...s, ...patch } : s)) }));
  /** フォーカスを移す（消した行の［元に戻す］・まちがいの欄・黄色い所）。描き終えてから */
  const focusLater = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

  function removeItem(m: Item) {
    // 何も書いていない行は、そのまま消す。書いた行は「消しました［元に戻す］」を残す
    if (!m.name.trim() && !m.price.trim() && !m.note.trim()) return edit((x) => ({ ...x, menu: x.menu.filter((y) => y.id !== m.id) }));
    setItem(m.id, { gone: true });
    focusLater(undoId(m.id));
  }
  function removeStep(s: Step) {
    if (!s.time.trim() && !s.text.trim()) return edit((x) => ({ ...x, schedule: x.schedule.filter((y) => y.k !== s.k) }));
    setStep(s.k, { gone: true });
    focusLater(undoId(s.k));
  }

  /** 黄色い所：保存されている方にする（自分の書いたその欄は捨てる） */
  function takeServer(p: Part) {
    setDoc((d) => ({ f: { ...d.f, [p]: fieldPart(p, server[p]) }, base: { ...d.base, [p]: server[p] } }));
    if (conflicts.length <= 1) setProblem(null);
  }
  /** 黄色い所：自分が書いた方にする（保存すると、ほかの人が直した文の上に書く） */
  function keepMine(p: Part) {
    setDoc((d) => ({ ...d, base: { ...d.base, [p]: server[p] } }));
    if (conflicts.length <= 1) setProblem(null);
  }

  function discard() {
    setDoc({ f: fieldsOf(server), base: server });
    setRestored(null);
    setTouched([]);
    setTried(false);
    setProblem(null);
  }

  const saveLabel = "お店の紹介を保存";

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    // 片方だけ書いた行は聞き返す（何も書いていない行は捨てる）。どの行かを言って、その欄へ
    if (noName.length) {
      const i = f.menu.filter((m) => !m.gone).indexOf(noName[0]) + 1;
      setProblem({ kind: "rows", text: `メニューの ${i} つ目の品物に、名前がありません。名前を書くか、［この品物を消す］で消してください` });
      focusLater(nameId(noName[0].id));
      return;
    }
    if (noText.length) {
      const i = f.schedule.filter((s) => !s.gone).indexOf(noText[0]) + 1;
      setProblem({ kind: "rows", text: `当日の流れの ${i} 行目に「すること」がありません。書くか、［この行を消す］で消してください` });
      focusLater(textId(noText[0].k));
      return;
    }
    if (conflicts.length) {
      setProblem({ kind: "conflict" });
      focusLater(conflictId(conflicts[0]));
      return;
    }
    if (!dirty) {
      setProblem(null);
      return setMsg("変えたところはありません（保存してあります）");
    }
    const sent = Object.fromEntries(changed.map((p) => [p, next[p]])) as Partial<Saved>;
    const base = Object.fromEntries(changed.map((p) => [p, doc.base[p]])) as Partial<Base>;
    setPending(true);
    setProblem(null);
    setMsg("");
    const r = await send<{ shop: Shop | null }>(`/api/staff/shops/${shop.id}`, "PATCH", { ...sent, base });
    setPending(false);
    if (r.ok) {
      // 送った欄の土台を、送った値に（送っているあいだに書き足した分は、まだ書きかけ）。何も書いていない行と消した行を片づける
      setDoc((d) => ({
        f: {
          ...d.f,
          schedule: d.f.schedule.filter((s) => !s.gone && (s.time.trim() || s.text.trim())),
          menu: d.f.menu.filter((m) => !m.gone && (m.name.trim() || m.price.trim() || m.note.trim())),
        },
        base: { ...d.base, ...sent },
      }));
      setRestored(null);
      setTried(false);
      setMsg(`お店の紹介を保存しました（${nowClock()}）`);
      // 品物の名前・数が変わったら、売り切れのボタンにも出す
      if (r.shop) onSaved(r.shop);
      return;
    }
    if (r.unsure) {
      // 返事が来なかった：届いていれば、読み込み直した保存の値が書いた内容と同じになる（sync で土台もそろう）
      setVerify({ why: "unsure", started: false });
      return onReload();
    }
    if (r.status === 409) {
      // ほかの人が同じ欄を直していた：読み込み直して、その欄に黄色い「どちらにするか」を出す（書きかけは残す）
      setVerify({ why: "conflict", started: false });
      return onReload();
    }
    if (r.status === 401) {
      onExpired();
      return setProblem({ kind: "expired" });
    }
    setProblem({ kind: "error", text: failText("お店の紹介を保存できませんでした", r.error, `電波のよい所で、もう一度［${saveLabel}］を押してください。書いた内容は、このスマホに残っています`) });
  }

  const conflictBox = (p: Part) =>
    conflicts.includes(p) && (
      <ConflictBox part={p} label={label(p)} now={summaryOf(p, server[p])} unknown={doc.base[p] === null} onServer={() => takeServer(p)} onMine={() => keepMine(p)} />
    );
  const liveItems = f.menu.filter((m) => !m.gone);
  const liveSteps = f.schedule.filter((s) => !s.gone);

  const status = verify
    ? verify.why === "unsure"
      ? "届いたか確かめています…"
      : "いまの保存を読み込んでいます…"
    : problem
      ? SHORT[problem.kind]
      : dirty
        ? "まだ保存していません"
        : msg;
  const statusClass = verify ? "sh-save-wait" : problem ? "sh-save-ng" : dirty ? "sh-unsaved" : "st-saved";

  return (
    <details className="st-intro" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="st-intro-sum">
        <span>お店の紹介を書く</span>
        <span className="st-muted">お客さんのお店のページに出ます</span>
        {dirty && <span className="sh-unsaved">まだ保存していない書きかけがあります</span>}
      </summary>
      <form className="st-stack st-intro-body" onSubmit={save} noValidate>
        <p className="sh-rule">{NO_NAMES}。アレルギーのことも書かないでください。</p>
        {restored && dirty && (
          <div className="sh-draft" role="status">
            <p>{restored.at ? `${stamp(restored.at, today)} の` : ""}書きかけを戻しました（まだ保存していません）</p>
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
        <div>
          <TextField
            id={INTRO_ID.catch}
            label="ひとこと（一覧のカードに出る）"
            value={f.catch}
            maxLength={60}
            hint={`例：鉄板で焼きたて！（${f.catch.length}/60 字）`}
            onChange={(e) => set({ catch: e.target.value })}
          />
          {conflictBox("catch")}
        </div>
        <div>
          <TextArea
            id={INTRO_ID.description}
            label={label("description")}
            value={f.description}
            maxLength={600}
            rows={4}
            hint={`${kind === "see" ? "例：1 年かけて作った作品を並べます。作り方の説明も聞けます" : "例：学校の畑でとれたサツマイモで焼き芋を作ります"}。${NO_NAMES}（${f.description.length}/600 字）`}
            onChange={(e) => set({ description: e.target.value })}
          />
          {conflictBox("description")}
        </div>
        <div>
          <TextArea
            id={INTRO_ID.message}
            label={label("message")}
            value={f.message}
            maxLength={600}
            rows={4}
            hint={`がんばったこと・来てほしい人へのひとことなど。例：夏から準備してきました。みんなに来てほしいです！ ${NO_NAMES}（${f.message.length}/600 字）`}
            onChange={(e) => set({ message: e.target.value })}
          />
          {conflictBox("message")}
        </div>

        <fieldset className="st-intro-set" id={INTRO_ID.menu}>
          <legend>メニュー（{liveItems.length}）</legend>
          <p className="st-muted">値段が決まっていなければ空のままで大丈夫です。売り切れは「売り切れ」のボタンで変えます。</p>
          <p className="sh-rule">{NO_ALLERGY}。</p>
          {conflictBox("menu")}
          <div className="st-rows">
            {f.menu.map((m) =>
              m.gone ? (
                <GoneRow
                  key={m.id}
                  id={m.id}
                  text={`「${m.name.trim() || "名前のない品物"}」を消しました`}
                  onUndo={() => {
                    setItem(m.id, { gone: false });
                    // ［元に戻す］は消えるので、戻した品物の名前の欄へ（キーボード・読み上げの人が場所を見失わないように）
                    focusLater(nameId(m.id));
                  }}
                />
              ) : (
                <div key={m.id} className="st-rowbox">
                  <div className="st-rowbox-grid">
                    <TextField
                      id={nameId(m.id)}
                      label="品物の名前"
                      value={m.name}
                      maxLength={40}
                      hint="例：焼きそば"
                      error={tried && noName.includes(m) ? "品物の名前を書いてください（いらない行は［この品物を消す］）" : undefined}
                      onChange={(e) => setItem(m.id, { name: e.target.value })}
                    />
                    <TextField id={INTRO_ID.price(m.id)} label="値段" value={m.price} maxLength={30} hint="例：300円" onChange={(e) => setItem(m.id, { price: e.target.value })} />
                    <TextField
                      label="ひとこと説明（お客さんに見えます）"
                      value={m.note}
                      maxLength={60}
                      hint="例：青のり・マヨつき（アレルギーのことは書かない）"
                      onChange={(e) => setItem(m.id, { note: e.target.value })}
                    />
                  </div>
                  <div className="st-row">
                    <span className="st-grow" />
                    <Button variant="danger" size="sm" icon="消す" onClick={() => removeItem(m)}>
                      この品物を消す
                    </Button>
                  </div>
                </div>
              ),
            )}
            {liveItems.length < MAX_ITEMS ? (
              <Button icon="足す" onClick={() => set({ menu: [...f.menu, { id: newId("m"), name: "", price: "", note: "" }] })}>
                品物を足す
              </Button>
            ) : (
              <p className="st-muted">品物は {MAX_ITEMS} 個までです。</p>
            )}
          </div>
        </fieldset>

        <fieldset className="st-intro-set" id={INTRO_ID.schedule}>
          <legend>当日の流れ（{liveSteps.length}）</legend>
          <p className="st-muted">「10:00　開店」「12:00　焼きたてができる」のように書くと、お客さんが来る時間を決めやすくなります。{NO_NAMES}。</p>
          {conflictBox("schedule")}
          <div className="st-rows">
            {f.schedule.map((s) => {
              if (s.gone) {
                return (
                  <GoneRow
                    key={s.k}
                    id={s.k}
                    text={`「${`${s.time} ${s.text}`.trim()}」の行を消しました`}
                    onUndo={() => {
                      setStep(s.k, { gone: false });
                      focusLater(textId(s.k));
                    }}
                  />
                );
              }
              const unreadable = s.time.trim() !== "" && minutesOf(s.time) === null && (tried || touched.includes(s.k));
              return (
                <div key={s.k} className="st-rowbox">
                  <div className="st-rowbox-grid st-rowbox-grid--2">
                    <TextField
                      label="時刻"
                      value={s.time}
                      maxLength={20}
                      hint={
                        unreadable ? (
                          <span className="sh-warn">時刻として読めないので、タイムテーブルでは「時刻が決まっていないもの」に入ります。決まっていれば 10:00 のように書いてください</span>
                        ) : (
                          "例：10:00"
                        )
                      }
                      onBlur={() => setTouched((l) => (l.includes(s.k) ? l : [...l, s.k]))}
                      onChange={(e) => setStep(s.k, { time: e.target.value })}
                    />
                    <TextField
                      id={textId(s.k)}
                      label="すること"
                      value={s.text}
                      maxLength={80}
                      hint="例：開店。焼きたてから"
                      error={tried && noText.includes(s) ? "することを書いてください（いらない行は［この行を消す］）" : undefined}
                      onChange={(e) => setStep(s.k, { text: e.target.value })}
                    />
                  </div>
                  <div className="st-row">
                    <span className="st-grow" />
                    <Button variant="danger" size="sm" icon="消す" onClick={() => removeStep(s)}>
                      この行を消す
                    </Button>
                  </div>
                </div>
              );
            })}
            {liveSteps.length < MAX_STEPS ? (
              <Button icon="足す" onClick={() => set({ schedule: [...f.schedule, { k: newId("r"), time: "", text: "" }] })}>
                流れを足す
              </Button>
            ) : (
              <p className="st-muted">当日の流れは {MAX_STEPS} 行までです。</p>
            )}
          </div>
        </fieldset>

        {problem && (
          <p className="st-err sh-problem" role="alert">
            {problemText(problem, saveLabel)}
          </p>
        )}
        <div className="st-actions" role="group" aria-label="お店の紹介の保存">
          <Button type="submit" variant="primary" size="lg" pending={pending} aria-disabled={busy || undefined}>
            {saveLabel}
          </Button>
          <span className={statusClass} role="status" aria-live="polite">
            {status}
          </span>
        </div>
      </form>
    </details>
  );
}
