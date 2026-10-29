"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { send } from "../staff/_lib/client";
import "../staff/staff.css";

/**
 * お店の QR の行き先（/join#s=お店&k=かぎ）。かぎは # のうしろなのでサーバーの記録に残らない。
 * 読んだらすぐアドレスから消して、サーバーに確かめてもらい、お店の画面へ移る。
 */
// 開発中は effect が 2 回動くので、はじめに読んだ # のうしろを覚えておく（2 回目はもう消えている）
let captured: string | null = null;

export default function JoinPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    if (captured === null || window.location.hash) captured = window.location.hash;
    const params = new URLSearchParams(captured.slice(1));
    const shop = params.get("s") ?? "";
    const key = params.get("k") ?? "";
    history.replaceState(null, "", "/join");
    let alive = true;
    const done = !shop || !key ? Promise.resolve({ ok: false as const, error: "QR の中身が読めませんでした。カメラでもう一度読み取ってください" }) : send("/api/staff/join", "POST", { shop, key });
    done.then((r) => {
      if (!alive) return;
      if (r.ok) router.replace("/staff");
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [router]);
  return (
    <main id="main" className="st-login">
      <div className="st-login-card" role="status" aria-live="polite">
        <Logo href="/" />
        {error ? (
          <>
            <h1>入れませんでした</h1>
            <p className="st-err">{error}</p>
            <p className="st-muted">
              実行委員・先生は <Link href="/staff/login">合言葉でログイン</Link>
            </p>
          </>
        ) : (
          <>
            <h1>お店の画面をひらいています…</h1>
            <p className="st-muted">少しお待ちください。</p>
          </>
        )}
      </div>
    </main>
  );
}
