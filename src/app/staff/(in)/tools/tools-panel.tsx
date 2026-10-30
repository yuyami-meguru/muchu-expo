"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { savedAt, send } from "../../_lib/client";

type Summary = { shops: number; open: number; out: number; notices: number };
type Backup = { app?: string; exportedAt?: string; depts?: unknown[]; shops?: unknown[]; places?: unknown[] };

export function ToolsPanel({ ready, summary }: { ready: boolean; summary: Summary }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [backup, setBackup] = useState<Backup | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(url: string, body: unknown, done: (r: Record<string, unknown>) => string) {
    setError("");
    setMsg("");
    const r = await send<Record<string, unknown>>(url, "POST", body);
    if (!r.ok) return setError(r.error);
    setMsg(`${done(r)}（${savedAt()}）`);
    router.refresh();
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    setError("");
    setMsg("");
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2_000_000) return setError("ファイルが大きすぎます（控えのファイルは 2MB より小さいはずです）");
    try {
      const data = JSON.parse(await f.text()) as Backup;
      if (data.app !== "muchu-expo" || !Array.isArray(data.shops)) return setError("夢中万博の控えのファイルではないようです");
      setBackup(data);
      setImportOpen(true);
    } catch {
      setError("ファイルが読めませんでした（「データの控えを保存」で作った .json を選んでください）");
    }
  }

  const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "日時不明";

  return (
    <div className="st-stack">
      <p className="st-muted">
        いまの様子：公開中のお店 {summary.shops}・営業中 {summary.open}・売り切れか残りわずかの品物 {summary.out}・お店からのお知らせ {summary.notices}
      </p>
      {(msg || error) && (
        <p className={error ? "st-err" : "st-saved"} role={error ? "alert" : "status"}>
          {error || msg}
        </p>
      )}

      <Card title="当日の朝">
        <div className="st-tool">
          <div>
            <h3 className="st-tool-h">全部のお店を「営業中」にする</h3>
            <p className="st-muted">10:00 の開始に合わせて押します。品物の残り・お店からのお知らせはそのままです（非表示のお店は変えません）。</p>
          </div>
          {ready ? (
            <ConfirmDialog
              title="全部のお店を「営業中」にしますか？"
              confirmLabel="営業中にする"
              tone="primary"
              triggerLabel="全部を営業中にする"
              triggerVariant="primary"
              onConfirm={() => run("/api/staff/open-all", {}, (r) => `${r.count ?? 0} 店を営業中にしました`)}
            >
              お客さんの画面に、すぐ「営業中」と出ます。
            </ConfirmDialog>
          ) : (
            <Button variant="primary" disabled>
              全部を営業中にする
            </Button>
          )}
        </div>
      </Card>

      <Card title="練習のあと・やり直し">
        <div className="st-tool">
          <div>
            <h3 className="st-tool-h">売り切れと状態をまとめて戻す</h3>
            <p className="st-muted">全部のお店の品物を「販売中」、状態を「準備中」にして、お店からのお知らせを消します。前日の練習のあとに使います。</p>
          </div>
          {ready ? (
            <ConfirmDialog
              title="売り切れと状態を、まとめて戻しますか？"
              confirmLabel="まとめて戻す"
              triggerLabel="まとめて戻す"
              onConfirm={() => run("/api/staff/reset", { confirm: "リセット" }, (r) => `${r.count ?? 0} 店を戻しました`)}
            >
              全部のお店の売り切れ・営業中・お店からのお知らせが消えます。お店の名前・メニュー・値段・思いは消えません。元に戻すボタンはないので、気になるときは先に「データの控えを保存」をしてください。
            </ConfirmDialog>
          ) : (
            <Button variant="danger" disabled>
              まとめて戻す
            </Button>
          )}
        </div>
      </Card>

      <Card title="データの控え">
        <div className="st-tool">
          <div>
            <h3 className="st-tool-h">データの控えを保存</h3>
            <p className="st-muted">部門・お店（メニュー・値段・思い・売り切れ）・地図のピン・お知らせを、1 つのファイルにして保存します。お店の編集用の QR の中身は入りません。</p>
          </div>
          <a className={buttonClass({ variant: "secondary" })} href="/api/staff/export" download>
            控えを保存
          </a>
        </div>
        <div className="st-tool">
          <div>
            <h3 className="st-tool-h">控えから戻す</h3>
            <p className="st-muted">保存しておいた控えのファイルを選ぶと、部門・お店・地図のピンがその時の中身に戻ります。控えのあとで足したお店は消えます。お知らせと、配ったお店の QR はそのまま使えます。</p>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pickFile} />
          <Button variant="secondary" disabled={!ready} onClick={() => fileRef.current?.click()}>
            控えのファイルを選ぶ
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        title="この控えで上書きしますか？"
        confirmLabel="上書きする"
        open={importOpen}
        onOpenChange={setImportOpen}
        onConfirm={async () => {
          if (!backup) return;
          await run("/api/staff/import", { confirm: "上書き", data: backup }, (r) => {
            const rm = (r.removed ?? {}) as { shops?: number };
            return `控え（${when(backup.exportedAt)}）から戻しました${rm.shops ? `。控えのあとで足したお店 ${rm.shops} 店を消しました` : ""}`;
          });
          setBackup(null);
        }}
      >
        {backup && (
          <>
            控えの日時：{when(backup.exportedAt)}
            <br />
            部門 {backup.depts?.length ?? 0}・お店 {backup.shops?.length ?? 0}・地図のピン {backup.places?.length ?? 0}
            <br />
            いまの中身は、この控えの中身に置きかわります。
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
