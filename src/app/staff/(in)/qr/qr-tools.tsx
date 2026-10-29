"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { send } from "../../_lib/client";

export function PrintButton() {
  return (
    <Button variant="primary" icon="写す" onClick={() => window.print()}>
      印刷する
    </Button>
  );
}

/** QR を作り直す（なくした・知らない人に渡ったとき）。前の QR と、それでログイン中の人は使えなくなる */
export function RotateKeyButton({ shopId, shopName }: { shopId: string; shopName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon="鍵"
        pending={pending}
        onClick={async () => {
          if (!window.confirm(`「${shopName}」の QR を作り直しますか？ 前の QR は使えなくなり、いまログインしているお店の人も入り直しになります。`)) return;
          setPending(true);
          setError("");
          const r = await send(`/api/staff/shops/${shopId}/key`, "POST");
          setPending(false);
          if (!r.ok) return setError(r.error);
          router.refresh();
        }}
      >
        QR を作り直す
      </Button>
      {error && (
        <p className="st-err" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
