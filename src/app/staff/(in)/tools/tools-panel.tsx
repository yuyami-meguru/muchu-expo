"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/field";
import type { AdminLive, Memo, Phase, PhaseMode, SiteAlert } from "@/lib/ops";
import { clock, send } from "../../_lib/client";
import { useStaffLive } from "../../_lib/use-staff-live";
import { noteAuth, useReportLive } from "../_components/session-signal";
import { modeLabel } from "../_components/staff-bands";
import { clockNow } from "../ops-live";
import { failMsg, ResultLine, type Result } from "../ops-result";
import { CheckCard } from "./check-card";
import { PhaseCard } from "./phase-card";
import { CLOSING_NEWS } from "./tool-text";
import "../ops.css";

type Summary = { shops: number; open: number; out: number; notices: number };
type Backup = { app?: string; exportedAt?: string; depts?: unknown[]; shops?: { id?: unknown; name?: unknown }[]; places?: unknown[]; areas?: unknown[] };
/** まとめて戻すで、いっしょに消せるもの（POST /api/staff/reset の also） */
type Also = "alert" | "memo" | "radio";
const ALSO_LABEL: Record<Also, string> = { alert: "全体の帯", memo: "お店の人への連絡", radio: "ラジオの「放送中」" };
/** チェックリスト・表示の時期を読み直す間隔（ほかの実行委員の印。画面に戻ったときにも読む） */
const REFRESH_MS = 60_000;

/** 返事が来なかったとき（届いているかもしれない。2 回押す前に、上の数で確かめてもらう） */
const UNSURE_NEXT = "少しして上の「いまの様子」の数が変わるか確かめてから、変わらなければもう一度押してください";

export function ToolsPanel({
  ready,
  summary: initial,
  shops,
  checks,
  phase,
  ops: firstOps,
  closingPosted,
}: {
  ready: boolean;
  summary: Summary;
  shops: { id: string; name: string; hidden: boolean }[];
  checks: Record<string, string>;
  phase: { mode: PhaseMode; now: Phase; until: number };
  /** ページを開いたときの全体の帯・お店の人への連絡・ラジオ（「いまの様子」に入っていれば、そちらを使う） */
  ops: { alert: SiteAlert; memo: Memo | null; onAir: boolean };
  /** 終わりの時間のお知らせが、もう出ている */
  closingPosted: boolean;
}) {
  const router = useRouter();
  const { live, expired, refresh } = useStaffLive<AdminLive>();
  useReportLive(live, expired);
  const [result, setResult] = useState<Record<string, Result>>({});
  const [backup, setBackup] = useState<Backup | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [keepLive, setKeepLive] = useState(false);
  const [radioOff, setRadioOff] = useState(true);
  const [closingNews, setClosingNews] = useState(!closingPosted);
  const [also, setAlso] = useState<Record<Also, boolean>>({ alert: true, memo: true, radio: true });
  const fileRef = useRef<HTMLInputElement>(null);

  // チェックリスト・表示の時期は、ほかの実行委員が変えた分も入るよう 60 秒ごとと、画面に戻ったときに読み直す（画面が見えているときだけ）
  useEffect(() => {
    let last = 0;
    const load = (force = false) => {
      if (document.visibilityState !== "visible") return;
      // 画面に戻ったときは、前に読んでから 20 秒たっていれば
      if (!force && performance.now() - last < 20_000) return;
      last = performance.now();
      router.refresh();
    };
    const t = setInterval(() => load(true), REFRESH_MS);
    const onVis = () => load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router]);

  const say = (card: string, r: Result) => setResult((p) => ({ ...p, [card]: r }));

  // いまの様子は「いまの様子」の読み直しから（まだ届いていなければ、ページを開いたときの数）
  const summary: Summary = live
    ? (() => {
        const v = Object.values(live.shops).filter((s) => !s.hidden);
        return {
          shops: v.length,
          open: v.filter((s) => s.state === "open").length,
          out: v.reduce((n, s) => n + Object.values(s.stock).filter((x) => x !== "on").length, 0),
          notices: v.filter((s) => s.notice).length,
        };
      })()
    : initial;
  const alertOn = (live?.alert ?? firstOps.alert).on;
  const memo = live ? live.memo : firstOps.memo;
  const onAir = live?.radio ? live.radio.onAir : firstOps.onAir;
  const phaseMode = live?.phase ?? phase.mode;
  const now: Record<Also, string> = {
    alert: alertOn ? "いま：出ています" : "いま：出していません",
    memo: memo ? "いま：出しています" : "いま：出していません",
    radio: onAir ? "いま：放送中" : "いま：放送していません",
  };
  // 点呼：いまの連絡を見た（［見ました］を押した）お店の数（表示中のお店で数える）
  const visibleShops = shops.filter((s) => !(live?.shops[s.id]?.hidden ?? s.hidden));
  const seen = memo && live ? visibleShops.filter((s) => live.acks[s.id] === memo.id).length : null;
  const picked = (Object.keys(also) as Also[]).filter((k) => also[k]);

  async function run(card: string, url: string, body: unknown, what: string, done: (r: Record<string, unknown>) => string) {
    say(card, null);
    const r = noteAuth(await send<Record<string, unknown>>(url, "POST", body));
    if (!r.ok) {
      if (r.unsure) refresh();
      return say(card, { text: failMsg(what, r, UNSURE_NEXT), error: true });
    }
    say(card, { text: `${done(r)}（${clockNow()}）` });
    refresh();
    router.refresh();
  }

  /**
   * 終わりの時間：全部のお店を「終了」に → （選んでいれば）ラジオを終える → 全体のお知らせ。
   * できたものはチェックを外す（もう一度押したとき、できなかった分だけやり直す。お知らせが 2 つ出ないように）
   */
  async function closeDay() {
    say("close", null);
    const done: string[] = [];
    const ng: string[] = [];
    const r = noteAuth(await send<{ count: number }>("/api/staff/close-all", "POST", {}));
    if (r.ok) done.push(r.count ? `${r.count} 店を「終了」にしました` : "「終了」にするお店はありませんでした（全部もう終了です）");
    else ng.push(`お店の「終了」（${r.unsure ? "返事が来ませんでした。上の「営業中」の数で確かめてください" : r.error}）`);
    if (radioOff) {
      const x = noteAuth(await send("/api/staff/radio", "PUT", { onAir: false }));
      if (x.ok) {
        done.push("ラジオの放送を終えました");
        setRadioOff(false);
      } else ng.push(`ラジオ（${x.unsure ? "返事が来ませんでした" : x.error}）`);
    }
    if (closingNews) {
      const x = noteAuth(await send("/api/staff/news", "POST", { text: CLOSING_NEWS, pinned: true }));
      // 返事が来なかったときも、出ているかもしれないのでチェックを外す（2 つ出さないように。出ていなければ「全体のお知らせ」で出す）
      if (x.ok || x.unsure) setClosingNews(false);
      if (x.ok) done.push("全体のお知らせを出しました");
      else ng.push(`全体のお知らせ（${x.unsure ? "返事が来ませんでした。「全体のお知らせ」で出ているか確かめてください" : x.error}）`);
    }
    const at = `（${clockNow()}）`;
    say(
      "close",
      ng.length
        ? { text: `${done.length ? `${done.join("・")}。` : ""}できなかったこと：${ng.join("・")}。もう一度押すと、できなかった分をやり直します${at}`, error: true }
        : { text: done.join("・") + at },
    );
    refresh();
    router.refresh();
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    say("backup", null);
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2_000_000) return say("backup", { text: "ファイルが大きすぎます（控えのファイルは 2MB より小さいはずです）", error: true });
    try {
      const data = JSON.parse(await f.text()) as Backup;
      if (data.app !== "muchu-expo" || !Array.isArray(data.shops)) return say("backup", { text: "夢中万博の控えのファイルではないようです", error: true });
      setBackup(data);
      setKeepLive(false);
      setImportOpen(true);
    } catch {
      say("backup", { text: "ファイルが読めませんでした（［控えを保存］で作った .json を選んでください）", error: true });
    }
  }

  const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "日時不明";
  // 控えに無いお店（戻すと消える）
  const inBackup = new Set((backup?.shops ?? []).map((s) => String(s?.id ?? "")));
  const gone = backup ? shops.filter((s) => !inBackup.has(s.id)) : [];

  return (
    <div className="st-stack">
      <p className="st-muted">
        いまの様子{live ? `（${clock(live.at)}）` : ""}：表示中のお店 {summary.shops}・営業中 {summary.open}・売り切れか残りわずかの品物 {summary.out}・お店からのお知らせ {summary.notices}
      </p>

      <nav className="ops-jump" aria-label="この画面の中">
        <a href="#morning">当日の朝</a>
        <a href="#open">10:00 営業中</a>
        <a href="#close">14:00 終了</a>
        <a href="#phase">表示の時期</a>
        <a href="#checks">チェックリスト</a>
        <a href="#backup">データの控え</a>
      </nav>

      <Card title="当日の朝（この順に）" id="morning">
        <ol className="st-steps">
          <li className="st-tool">
            <span className="st-step-n" aria-hidden="true">
              1
            </span>
            <div>
              <h3 className="st-tool-h">データの控えを保存</h3>
              <p className="st-muted">何かあったときに戻せるよう、いまの中身を 1 つのファイルにして保存します。</p>
            </div>
            <a
              className={buttonClass({ variant: "secondary" })}
              href="/api/staff/export"
              download
              onClick={() => say("m1", { text: "控えのファイル（muchu-backup-….json）を保存しています。ダウンロードのフォルダを確かめてください" })}
            >
              控えを保存
            </a>
            <ResultLine r={result.m1 ?? null} />
          </li>
          <li className="st-tool">
            <span className="st-step-n" aria-hidden="true">
              2
            </span>
            <div>
              <h3 className="st-tool-h">売り切れと状態をまとめて戻す</h3>
              <p className="st-muted">
                全部のお店の品物が「販売中」、状態が「準備中」になり、お店からのお知らせは消えます。下でチェックしたものも、いっしょに消します。全体のお知らせは消えません。前日の練習のあとにも使います。
              </p>
              <fieldset className="st-also" disabled={!ready}>
                <legend className="st-also-h">いっしょに消す</legend>
                {(Object.keys(ALSO_LABEL) as Also[]).map((k) => (
                  <Checkbox key={k} label={`${ALSO_LABEL[k]}も消す`} hint={now[k]} checked={also[k]} onChange={(e) => setAlso((a) => ({ ...a, [k]: e.target.checked }))} />
                ))}
              </fieldset>
            </div>
            {ready ? (
              <ConfirmDialog
                title="売り切れと状態を、まとめて戻しますか？"
                confirmLabel="まとめて戻す"
                triggerLabel="まとめて戻す"
                onConfirm={() =>
                  run("m2", "/api/staff/reset", { confirm: "リセット", also: picked }, "売り切れと状態をまとめて戻すことが", (r) => {
                    const cleared = (Array.isArray(r.also) ? r.also : []).filter((x): x is Also => typeof x === "string" && x in ALSO_LABEL);
                    return `${r.count ?? 0} 店の売り切れと状態を戻しました${cleared.length ? `。${cleared.map((x) => ALSO_LABEL[x]).join("・")}も消しました` : ""}`;
                  })
                }
              >
                全部のお店の品物が「販売中」、状態が「準備中」になり、お店からのお知らせは消えます。
                {picked.length ? `${picked.map((x) => ALSO_LABEL[x]).join("・")}も消します。` : ""}
                お店の名前・メニュー・値段・思いと、全体のお知らせは消えません。元に戻すボタンはないので、先に［控えを保存］をしてください。
              </ConfirmDialog>
            ) : (
              <Button variant="danger" disabled>
                まとめて戻す
              </Button>
            )}
            <ResultLine r={result.m2 ?? null} />
          </li>
          <li className="st-tool">
            <span className="st-step-n" aria-hidden="true">
              3
            </span>
            <div>
              <h3 className="st-tool-h">試しに出したお知らせ・ラジオのメッセージを消す</h3>
              <p className="st-muted">全体のお知らせは「全体のお知らせ」の［消す］で、ラジオのメッセージは「校内ラジオ」の［メッセージを全部消す］で消します。</p>
            </div>
            <span className="st-row">
              <Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/staff/news">
                全体のお知らせへ
              </Link>
              <Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/staff/radio">
                校内ラジオへ
              </Link>
            </span>
          </li>
          <li className="st-tool">
            <span className="st-step-n" aria-hidden="true">
              4
            </span>
            <div>
              <h3 className="st-tool-h">表示の時期が「日時で自動」か確かめる</h3>
              <p className={phaseMode === "auto" ? "st-muted" : "ops-warn"}>
                {phaseMode === "auto" ? "✓ いま：日時で自動" : `いま：「${modeLabel(phaseMode)}」のままです。下の「表示の時期」で「日時で自動」に戻してください`}
              </p>
            </div>
            <a className={buttonClass({ variant: "secondary", size: "sm" })} href="#phase">
              表示の時期へ
            </a>
          </li>
          <li className="st-tool">
            <span className="st-step-n" aria-hidden="true">
              5
            </span>
            <div>
              <h3 className="st-tool-h">点呼（お店のスマホが入れているか）</h3>
              <p className="st-muted">
                「お店の人への連絡」で「見えたら［見ました］を押してください」と送り、全部のお店が［見ました］を押したか確かめます。押していないお店には声をかけます。
                {memo && seen !== null && ` いま：見たお店 ${seen}/${visibleShops.length}`}
              </p>
            </div>
            <Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/staff/news#memo">
              お店の人への連絡へ
            </Link>
          </li>
          <li className="st-tool" id="open">
            <span className="st-step-n" aria-hidden="true">
              6
            </span>
            <div>
              <h3 className="st-tool-h">10:00 に全部のお店を「営業中」にする</h3>
              <p className="st-muted">品物の残り・お店からのお知らせはそのままです（非表示のお店は変えません）。</p>
            </div>
            {ready ? (
              <ConfirmDialog
                title="全部のお店を「営業中」にしますか？"
                confirmLabel="営業中にする"
                tone="primary"
                triggerLabel="全部を営業中にする"
                triggerVariant="primary"
                onConfirm={() =>
                  run("m3", "/api/staff/open-all", {}, "全部のお店を「営業中」にすることが", (r) =>
                    r.count ? `${r.count} 店を営業中にしました` : "営業中にするお店はありませんでした（全部もう営業中です）",
                  )
                }
              >
                お客さんの画面に「営業中」と出ます（当日は 20 秒ほどで）。
              </ConfirmDialog>
            ) : (
              <Button variant="primary" disabled>
                全部を営業中にする
              </Button>
            )}
            <ResultLine r={result.m3 ?? null} />
          </li>
        </ol>
      </Card>

      <Card title="終わりの時間（14:00）" id="close">
        <div className="st-tool">
          <div>
            <h3 className="st-tool-h">全部のお店を「終了」にする</h3>
            <p className="st-muted">表示中のお店の状態を「終了」にします。品物の残り・お店からのお知らせはそのままです。いっしょにすることを選べます。</p>
            <Checkbox label="ラジオの放送を終える" hint={onAir ? "いま：放送中" : "いま：放送していません"} checked={radioOff} onChange={(e) => setRadioOff(e.target.checked)} />
            <Checkbox
              label={`全体のお知らせに「${CLOSING_NEWS}」を出す`}
              hint={closingPosted ? "もう出ています（2 つ出さないよう、チェックを外してあります）" : "いちばん上に固定して出します"}
              checked={closingNews}
              onChange={(e) => setClosingNews(e.target.checked)}
            />
          </div>
          {ready ? (
            <ConfirmDialog title="全部のお店を「終了」にしますか？" confirmLabel="終了にする" triggerLabel="全部のお店を「終了」にする" onConfirm={closeDay}>
              お客さんの画面に「終了」と出ます（当日は 20 秒ほどで）。
              {radioOff && <> ラジオの「放送中」も消えます。</>}
              {closingNews && <> 全体のお知らせに「{CLOSING_NEWS}」を出します。</>}
            </ConfirmDialog>
          ) : (
            <Button variant="danger" disabled>
              全部のお店を「終了」にする
            </Button>
          )}
          <ResultLine r={result.close ?? null} />
        </div>
      </Card>

      <PhaseCard ready={ready} phase={phase} />
      <CheckCard ready={ready} checks={checks} />

      <Card title="データの控え" id="backup">
        <div className="st-tool">
          <div>
            <h3 className="st-tool-h">控えを保存</h3>
            <p className="st-muted">部門・お店（メニュー・値段・思い・売り切れ）・地図のピン・フロア・お知らせを、1 つのファイルにして保存します。お店の人に配る QR の中身（かぎ）は入りません。</p>
          </div>
          <a
            className={buttonClass({ variant: "secondary" })}
            href="/api/staff/export"
            download
            onClick={() => say("save", { text: "控えのファイル（muchu-backup-….json）を保存しています。ダウンロードのフォルダを確かめてください" })}
          >
            控えを保存
          </a>
          <ResultLine r={result.save ?? null} />
        </div>
        <div className="st-tool">
          <div>
            <h3 className="st-tool-h">控えから戻す</h3>
            <p className="st-muted">
              保存しておいた控えのファイルを選ぶと、部門・お店・地図のピン・フロアがその時の中身に戻ります。控えのあとで足したお店・部門・ピン・フロアは消えます（戻す前に、消えるお店の名前が出ます）。
            </p>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pickFile} />
          <Button variant="secondary" disabled={!ready} onClick={() => fileRef.current?.click()}>
            控えのファイルを選ぶ
          </Button>
          <ResultLine r={result.backup ?? null} />
        </div>
      </Card>

      <ConfirmDialog
        title="この控えで上書きしますか？"
        confirmLabel="上書きする"
        open={importOpen}
        onOpenChange={setImportOpen}
        onConfirm={async () => {
          if (!backup) return;
          const at = when(backup.exportedAt);
          await run("backup", "/api/staff/import", { confirm: "上書き", keepLive, data: backup }, "控えから戻すことが", (r) => {
            const rm = (r.removed ?? {}) as { shops?: number };
            return `控え（${at}）から戻しました${rm.shops ? `。控えのあとで足したお店 ${rm.shops} 店を消しました` : ""}`;
          });
          setBackup(null);
        }}
      >
        {backup && (
          <>
            <p>
              控えの日時：{when(backup.exportedAt)}
              <br />
              部門 {backup.depts?.length ?? 0}・お店 {backup.shops?.length ?? 0}・地図のピン {backup.places?.length ?? 0}
              {Array.isArray(backup.areas) && `・フロア ${backup.areas.length}`}
            </p>
            {gone.length > 0 ? (
              <p className="ops-warn">
                控えに無いお店 {gone.length} 店（{gone.map((s) => s.name).join("・")}）は消えます。消えたお店の QR は使えなくなります。
              </p>
            ) : (
              <p>消えるお店はありません。</p>
            )}
            <Checkbox label="売り切れ・営業中・お店からのお知らせはいまのまま" checked={keepLive} onChange={(e) => setKeepLive(e.target.checked)} />
            <p>
              {keepLive
                ? "売り切れ・営業中・お店からのお知らせは、いまのまま残ります。"
                : "チェックしなければ、売り切れ・営業中・お店からのお知らせも控えの時に戻ります。"}
              全体のお知らせは変わりません。
            </p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
