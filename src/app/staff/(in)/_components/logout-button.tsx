"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { send } from "../../_lib/client";
import { failText } from "./shop-result";

/**
 * ログアウト（ページのいちばん下）。お店の人は、もう一度 QR を読み取るまで売り切れを変えられなくなるので、先に確かめる。
 * ログアウトのあとは入口へ（「お店の人は QR で、実行委員は合言葉で入れます」と出す）。
 */
export function LogoutButton({ shop = false }: { shop?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    const r = await send("/api/staff/logout", "POST");
    if (!r.ok) {
      setPending(false);
      return setError(failText("ログアウトできませんでした", r.error));
    }
    router.replace("/staff/login?from=logout");
    router.refresh();
  }

  return (
    <>
      {shop ? (
        <ConfirmDialog
          title="ログアウトしますか？"
          confirmLabel="ログアウトする"
          triggerLabel="ログアウト"
          triggerVariant="ghost"
          triggerIcon="ログアウト"
          onConfirm={logout}
        >
          ログアウトすると、お店の QR をもう一度読み取るまで売り切れを変えられません。
        </ConfirmDialog>
      ) : (
        <Button variant="ghost" icon="ログアウト" pending={pending} onClick={logout}>
          ログアウト
        </Button>
      )}
      {error && (
        <p className="st-err" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
