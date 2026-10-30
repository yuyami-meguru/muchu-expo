"use client";

import { Button } from "@/components/ui/button";

/** 帯に出す知らせ 1 つ（文と、押すボタン 1 つ） */
export type ShopAlertItem = { text: string; action: string; onAction: () => void; pending?: boolean; tone: "memo" | "info" };

/**
 * お店の人の画面のいちばん上に重ねて出す細い帯（スマホは上の帯のロゴの所に重なる）。
 * あとから届いた知らせ（実行委員からの連絡・品物が変わった・表示の時期が変わった）は、画面の中に差しこまずにここへ出す
 * （差しこむと、売り切れのボタンが下にずれて押しまちがえるので）。帯は 1 つだけ（大事な順に ShopHome が選ぶ）
 */
export function ShopAlert({ alert }: { alert: ShopAlertItem | null }) {
  // 読み上げで知らせるため、入れ物はいつも置いておく（中身が入ったときに読む）
  return (
    <div className="sh-alert-slot" role="status">
      {alert && (
        <div className={`sh-alert sh-alert--${alert.tone}`}>
          <p className="sh-alert-text">{alert.text}</p>
          <Button size="sm" variant={alert.tone === "memo" ? "primary" : "secondary"} pending={alert.pending} onClick={alert.onAction}>
            {alert.action}
          </Button>
        </div>
      )}
    </div>
  );
}
