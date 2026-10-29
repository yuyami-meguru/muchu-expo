"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import type { ScheduleItem, Shop } from "@/lib/types";
import { savedAt, send } from "../../_lib/client";

type Item = { id: string; name: string; price: string; note: string };

/** 新しい品物の英字の名前（m1, m2 …。いまある名前と重ならないもの） */
function newItemId(used: string[]) {
  let n = 1;
  while (used.includes(`m${n}`)) n++;
  return `m${n}`;
}

/**
 * お店の人が「お店の紹介」を書く欄：ひとこと・どんなお店？・お店の思い・当日の流れ・メニュー。
 * 「保存」でまとめて送る。品物の残り（売り切れ）は上のボタンで変える（ここで保存しても残りは変わらない）。
 */
export function ShopIntroEditor({ shop }: { shop: Shop }) {
  const router = useRouter();
  const [catchText, setCatch] = useState(shop.catch);
  const [description, setDescription] = useState(shop.description);
  const [message, setMessage] = useState(shop.message);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(shop.schedule);
  const [menu, setMenu] = useState<Item[]>(shop.menu.map(({ id, name, price, note }) => ({ id, name, price, note })));
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  // 開け閉めは覚えておく（はじめは、まだ紹介が空なら開いておく）
  const [open, setOpen] = useState(!shop.description && !shop.message);

  const setItem = (i: number, patch: Partial<Item>) => setMenu((l) => l.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setStep = (i: number, patch: Partial<ScheduleItem>) => setSchedule((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function save(e: FormEvent) {
    e.preventDefault();
    // 何も書いていない行は捨てる。片方だけ書いた行は聞き返す
    const items = menu.filter((m) => m.name.trim() || m.price.trim() || m.note.trim());
    if (items.some((m) => !m.name.trim())) return setError("メニューに、品物の名前が空の行があります。名前を書くか、その行を消してください");
    const steps = schedule.filter((s) => s.time.trim() || s.text.trim());
    if (steps.some((s) => !s.text.trim())) return setError("当日の流れに「すること」が空の行があります。書くか、その行を消してください");
    setPending(true);
    setError("");
    setMsg("");
    const r = await send(`/api/staff/shops/${shop.id}`, "PATCH", {
      catch: catchText,
      description,
      message,
      schedule: steps,
      menu: items,
    });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setMenu(items);
    setSchedule(steps);
    setMsg(`お店の紹介を${savedAt()}`);
    router.refresh();
  }

  return (
    <details className="st-intro" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="st-intro-sum">
        <span>お店の紹介を書く</span>
        <span className="st-muted">お客さんのお店のページに出ます</span>
      </summary>
      <form className="st-stack st-intro-body" onSubmit={save} noValidate>
        <TextField
          label="ひとこと（一覧のカードに出る）"
          value={catchText}
          maxLength={60}
          placeholder="例：鉄板で焼きたて！"
          hint={`${catchText.length}/60 字`}
          onChange={(e) => setCatch(e.target.value)}
        />
        <TextArea
          label="どんなお店？"
          value={description}
          maxLength={600}
          rows={4}
          placeholder="例：学校の畑でとれたサツマイモで焼き芋を作ります。"
          hint={`${description.length}/600 字`}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextArea
          label="お店の思い"
          value={message}
          maxLength={600}
          rows={4}
          placeholder="例：夏から準備してきました。みんなに食べてほしいです！"
          hint={`がんばったこと・来てほしい人へのひとことなど（${message.length}/600 字）`}
          onChange={(e) => setMessage(e.target.value)}
        />

        <fieldset className="st-intro-set">
          <legend>メニュー（{menu.length}）</legend>
          <p className="st-muted">値段が決まっていなければ空のままで大丈夫です。売り切れは上のボタンで変えてください。</p>
          <div className="st-rows">
            {menu.map((m, i) => (
              <div key={m.id} className="st-rowbox">
                <div className="st-rowbox-grid">
                  <TextField label="品物の名前" value={m.name} maxLength={40} placeholder="例：焼きそば" onChange={(e) => setItem(i, { name: e.target.value })} />
                  <TextField label="値段" value={m.price} maxLength={30} placeholder="例：300円" onChange={(e) => setItem(i, { price: e.target.value })} />
                  <TextField label="メモ" value={m.note} maxLength={60} placeholder="例：青のり・マヨつき" onChange={(e) => setItem(i, { note: e.target.value })} />
                </div>
                <div className="st-row">
                  <span className="st-grow" />
                  <Button variant="danger" size="sm" icon="消す" onClick={() => setMenu((l) => l.filter((_, j) => j !== i))}>
                    この品物を消す
                  </Button>
                </div>
              </div>
            ))}
            <Button icon="足す" onClick={() => setMenu((l) => [...l, { id: newItemId(l.map((x) => x.id)), name: "", price: "", note: "" }])}>
              品物を足す
            </Button>
          </div>
        </fieldset>

        <fieldset className="st-intro-set">
          <legend>当日の流れ（{schedule.length}）</legend>
          <p className="st-muted">「10:00　開店」「12:00　焼きたてができる」のように書くと、お客さんが来る時間を決めやすくなります。</p>
          <div className="st-rows">
            {schedule.map((s, i) => (
              <div key={i} className="st-rowbox">
                <div className="st-rowbox-grid st-rowbox-grid--2">
                  <TextField label="時間" value={s.time} maxLength={20} placeholder="例：10:00" onChange={(e) => setStep(i, { time: e.target.value })} />
                  <TextField label="すること" value={s.text} maxLength={80} placeholder="例：開店。焼きたてから" onChange={(e) => setStep(i, { text: e.target.value })} />
                </div>
                <div className="st-row">
                  <span className="st-grow" />
                  <Button variant="danger" size="sm" icon="消す" onClick={() => setSchedule((l) => l.filter((_, j) => j !== i))}>
                    この行を消す
                  </Button>
                </div>
              </div>
            ))}
            <Button icon="足す" onClick={() => setSchedule((l) => [...l, { time: "", text: "" }])}>
              流れを足す
            </Button>
          </div>
        </fieldset>

        <div className="st-actions" role="group" aria-label="お店の紹介の保存">
          <Button type="submit" variant="primary" size="lg" pending={pending}>
            お店の紹介を保存
          </Button>
          <span className="st-saved" role="status" aria-live="polite">
            {msg}
          </span>
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
