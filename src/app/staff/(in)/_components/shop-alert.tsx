"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 帯に出す知らせ 1 つ（文と、押すボタン 1 つ）。
 * more がある知らせ（ログインが切れた。押して直す先がない）は、ボタンが［くわしく］になり、押すと帯の中に more を開く
 */
export type ShopAlertItem =
  | { text: string; action: string; onAction: () => void; pending?: boolean; tone: "memo" | "info" }
  | { text: string; more: string; tone: "ng" };

/**
 * お店の人の画面のいちばん上に重ねて出す細い帯（スマホは上の帯のロゴの所に重なる）。
 * あとから届いた知らせ（実行委員からの連絡・品物が変わった・表示の時期が変わった・ログインが切れた）は、画面の中に差しこまずにここへ出す
 * （差しこむと、売り切れのボタンが下にずれて押しまちがえるので）。帯は 1 つだけ（大事な順に ShopHome が選ぶ）
 */
export function ShopAlert({ alert }: { alert: ShopAlertItem | null }) {
  const [open, setOpen] = useState(false);
  // 読み上げで知らせるため、入れ物はいつも置いておく（中身が入ったときに読む）
  return (
    <div className="sh-alert-slot" role="status">
      {alert && (
        <div className={`sh-alert sh-alert--${alert.tone}`}>
          <p className="sh-alert-text">{alert.text}</p>
          {"more" in alert ? (
            <>
              <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {open ? "閉じる" : "くわしく"}
              </Button>
              {open && <p className="sh-alert-more">{alert.more}</p>}
            </>
          ) : (
            <Button size="sm" variant={alert.tone === "memo" ? "primary" : "secondary"} pending={alert.pending} onClick={alert.onAction}>
              {alert.action}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
