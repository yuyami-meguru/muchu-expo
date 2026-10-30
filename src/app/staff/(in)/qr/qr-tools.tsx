"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { send } from "../../_lib/client";
import { noteAuth } from "../_components/session-signal";

export function PrintButton({ label = "印刷する" }: { label?: string }) {
  return (
    <Button variant="primary" icon="写す" onClick={() => window.print()}>
      {label}
    </Button>
  );
}

/** 印を付けた紙（data-print-unit の要素）だけを印刷する。ほかは CSS（html.st-print-one）で隠す。印刷が終わったら（afterprint）印を外す */
function printOnly(els: Element[]) {
  if (!els.length) return;
  const root = document.documentElement;
  const done = () => {
    for (const el of els) el.removeAttribute("data-print-one");
    root.classList.remove("st-print-one");
  };
  for (const el of els) el.setAttribute("data-print-one", "");
  root.classList.add("st-print-one");
  window.addEventListener("afterprint", done, { once: true });
  window.print();
}

/** 1 枚だけ印刷する。押した 1 枚（id の要素。data-print-unit を付けておく）に印を付けて、ほかは印刷に出さない */
export function PrintOneButton({ target, label = "この 1 枚だけ印刷" }: { target: string; label?: string }) {
  return (
    <Button
      size="sm"
      icon="写す"
      onClick={() => {
        const el = document.getElementById(target);
        if (el) printOnly([el]);
      }}
    >
      {label}
    </Button>
  );
}

/** ひとまとまりの紙（フロアの案内を全部、など）だけを印刷する。group は data-print-group の値 */
export function PrintGroupButton({ group, label, size = "md" }: { group: string; label: string; size?: "sm" | "md" }) {
  return (
    <Button
      size={size}
      icon="写す"
      onClick={() => printOnly([...document.querySelectorAll(`[data-print-unit][data-print-group="${group}"]`)])}
    >
      {label}
    </Button>
  );
}

/** QR を作り直す（なくした・知らない人に渡ったとき）。前の QR と、それでログイン中の人は使えなくなる */
export function RotateKeyButton({ shopId, shopName }: { shopId: string; shopName: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <>
      <ConfirmDialog
        title={`「${shopName}」の QR を作り直しますか？`}
        confirmLabel="作り直す"
        triggerLabel="QR を作り直す"
        triggerVariant="secondary"
        triggerSize="sm"
        triggerIcon="鍵"
        onConfirm={async () => {
          setError("");
          setDone(false);
          // ログインが切れていたら、画面の上の帯（合言葉で入り直す）にも知らせる
          const r = noteAuth(await send(`/api/staff/shops/${shopId}/key`, "POST"));
          if (!r.ok) {
            // 返事が来なかったときは、作り直せているかもしれない（client.ts の UNSURE_ERROR は「読み直して確かめています」と言うが、
            // ここでは確かめる手立てがない）。前の（使えなくなった）QR を刷らないよう、画面を読み直してから刷ってもらう
            if (r.unsure) {
              router.refresh();
              return setError("返事が来ませんでした（作り直せたか分かりません）。使えなくなった QR を刷らないよう、電波のよい所でこの画面を開き直してから刷ってください。なくした QR を確実に使えなくするには、もう一度［QR を作り直す］を押してください");
            }
            return setError(r.error);
          }
          setDone(true);
          router.refresh();
        }}
      >
        前の紙の QR は使えなくなり、いまログインしているお店の人も入り直しになります。作り直したら、新しい QR を印刷してお店の人に渡してください。
      </ConfirmDialog>
      {done && (
        <p className="st-qr-done" role="status">
          作り直しました。前の紙の QR はもう使えません。この QR を印刷して渡してください
        </p>
      )}
      {error && (
        <p className="st-err" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
