"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { send } from "../../_lib/client";

export function PrintButton({ label = "印刷する" }: { label?: string }) {
  return (
    <Button variant="primary" icon="写す" onClick={() => window.print()}>
      {label}
    </Button>
  );
}

/**
 * 1 枚だけ印刷する。押した 1 枚（id の要素。data-print-unit を付けておく）に印を付けて、ほかは印刷に出さない（CSS の html.st-print-one）。
 * 印刷が終わったら（afterprint）印を外す。
 */
export function PrintOneButton({ target, label = "この 1 枚だけ印刷" }: { target: string; label?: string }) {
  return (
    <Button
      size="sm"
      icon="写す"
      onClick={() => {
        const el = document.getElementById(target);
        if (!el) return;
        const root = document.documentElement;
        const done = () => {
          el.removeAttribute("data-print-one");
          root.classList.remove("st-print-one");
        };
        el.setAttribute("data-print-one", "");
        root.classList.add("st-print-one");
        window.addEventListener("afterprint", done, { once: true });
        window.print();
      }}
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
          const r = await send(`/api/staff/shops/${shopId}/key`, "POST");
          if (!r.ok) return setError(r.error);
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
