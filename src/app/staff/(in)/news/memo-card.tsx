"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea } from "@/components/ui/field";
import type { AdminLive, Memo } from "@/lib/ops";
import { clock, send } from "../../_lib/client";
import { clockNow } from "../ops-live";
import { ResultLine, type Result } from "../ops-result";

type Props = {
  live: AdminLive | null;
  /** ページを開いたときの連絡と「見ました」の印（「いまの様子」が届くまで使う） */
  first: { memo: Memo | null; acks: Record<string, string> };
  /** 表示中のお店（見たかどうかを数える） */
  shops: { id: string; name: string }[];
  ready: boolean;
  onSaved: () => void;
};

/**
 * お店の人への連絡（実行委員 → 全部のお店。お客さんには見えない）。
 * お店の人が「見ました」を押すと、ここで見たお店の数と、まだのお店の名前が分かる（15 秒ごとに読み直す）。
 */
export function MemoCard({ live, first, shops, ready, onSaved }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  /** 自分が送った・消した連絡（「いまの様子」に入るまで出す） */
  const [over, setOver] = useState<{ memo: Memo | null; at: number } | null>(null);

  const liveMemo = live ? live.memo : first.memo;
  const acks = live ? live.acks : first.acks;
  if (over) {
    // 「いまの様子」に入った、または、そのあとでほかの人が変えたら、読み込んだ方を使う
    const reflected = over.memo ? liveMemo?.id === over.memo.id : liveMemo === null;
    const newer = over.memo ? (liveMemo?.at ?? 0) > over.memo.at : (liveMemo?.at ?? 0) > over.at;
    if (reflected || newer) setOver(null);
  }
  const memo = over ? over.memo : liveMemo;
  const seen = memo ? shops.filter((s) => acks[s.id] === memo.id) : [];
  const notYet = memo ? shops.filter((s) => acks[s.id] !== memo.id) : [];

  async function put(next: string) {
    setBusy(true);
    setResult(null);
    const r = await send<{ memo: Memo | null }>("/api/staff/memo", "PUT", { text: next });
    setBusy(false);
    if (!r.ok) return setResult({ text: r.error, error: true });
    setOver({ memo: r.memo, at: Date.now() });
    if (r.memo) setText("");
    setResult({ text: r.memo ? `全部のお店に送りました（${clock(r.memo.at)}）` : `連絡を消しました（${clockNow()}）` });
    onSaved();
  }

  return (
    <Card title="お店の人への連絡（お客さんには見えません）" id="memo">
      <p className="st-muted">全部のお店の人の画面に出ます。お店の人が「見ました」を押すと、ここで分かります。</p>
      {memo ? (
        <div className="ops-memo">
          <p className="ops-memo-text">
            <span className="ops-memo-k">いま出している連絡（{clock(memo.at)}）</span>
            {memo.text}
          </p>
          <p className="ops-memo-seen">
            見たお店 {seen.length}/{shops.length}
            {notYet.length > 0 && <span className="st-muted">（まだ：{notYet.map((s) => s.name).join("・")}）</span>}
          </p>
          <div className="ops-news-btns">
            <Button size="sm" variant="danger" icon="消す" disabled={!ready || busy} onClick={() => setDelOpen(true)} aria-haspopup="dialog">
              連絡を消す
            </Button>
          </div>
        </div>
      ) : (
        <p className="ops-alert-state">いま：出していません</p>
      )}
      <TextArea
        label={memo ? "新しい連絡（いまの連絡と置きかわります）" : "連絡の文"}
        value={text}
        maxLength={200}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        hint={`例：13:45 で販売を締めてください（${text.length}/200 字）`}
      />
      <div className="ops-news-btns" style={{ marginTop: 8 }}>
        <Button icon="送る" disabled={!ready || !text.trim()} pending={busy} onClick={() => setSendOpen(true)} aria-haspopup="dialog">
          全部のお店に送る
        </Button>
      </div>
      <ResultLine r={result} />

      <ConfirmDialog title="全部のお店に送りますか？" confirmLabel="送る" tone="primary" open={sendOpen} onOpenChange={setSendOpen} onConfirm={() => put(text.trim())}>
        「{text.trim()}」を、全部のお店の人の画面に出します。
        {memo && " いまの連絡は消え、この連絡に置きかわります（「見ました」の数も 0 からになります）。"}
      </ConfirmDialog>
      <ConfirmDialog title="お店の人への連絡を消しますか？" confirmLabel="消す" open={delOpen} onOpenChange={setDelOpen} onConfirm={() => put("")}>
        全部のお店の人の画面から、連絡が消えます。
      </ConfirmDialog>
    </Card>
  );
}
