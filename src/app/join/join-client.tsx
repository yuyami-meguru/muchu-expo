"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { isNoSignal } from "../staff/(in)/_components/shop-result";
import { send } from "../staff/_lib/client";

/** 実行委員に見せる、お店の名前とかぎの指紋（かぎそのものは画面に渡さない） */
export type JoinShop = { id: string; name: string; kfp: string };
/** お店の人としてログイン中なら、そのお店（別のお店の QR を読んだときに、黙って切りかえないため） */
export type JoinCurrent = { id: string; name: string };

type Pair = { shop: string; key: string };
type View =
  | { kind: "opening" }
  | { kind: "error"; text: string }
  | { kind: "offline"; pair: Pair; unsure: boolean }
  | { kind: "other"; pair: Pair; current: JoinCurrent }
  | { kind: "admin"; pair: Pair; shop: JoinShop | null; valid: boolean | null };

/** QR の中身の形がちがう（欠けている・読みまちがい）ときの文。サーバーの「入れた内容を…」は、QR を読んだ人には分からないので */
const BAD_QR = "QR の中身が読めませんでした。カメラでもう一度読み取ってください（何度やってもだめなときは、実行委員に新しい QR をもらってください）";
/** QR の中身の形（サーバーの api/staff/join と同じ：お店の英字の名前・10〜100 字のかぎ）。ちがえば送らずに BAD_QR */
const goodPair = (p: Pair) => /^[a-z0-9-]{1,40}$/.test(p.shop) && p.key.length >= 10 && p.key.length <= 100;

/** 電波で入れなかったとき、もう一度ためせるよう、QR の中身をこのタブの中だけに一時的に置く（入れたら・タブを閉じたら消える） */
const KEEP = "muchu-join";

function readKept(): Pair | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEEP) ?? "null") as Partial<Pair> | null;
    return v && typeof v.shop === "string" && typeof v.key === "string" ? { shop: v.shop, key: v.key } : null;
  } catch {
    return null;
  }
}

function keep(p: Pair | null) {
  try {
    if (p) sessionStorage.setItem(KEEP, JSON.stringify(p));
    else sessionStorage.removeItem(KEEP);
  } catch {
    // 置けない端末（プライベートブラウズなど）は、QR をもう一度読み取ってもらう
  }
}

/** 入る。入れたら null（お店の画面へ）。電波・返事が来なかったときだけ QR の中身を一時的に置く（もう一度ためせるように） */
async function tryJoin(pair: Pair): Promise<View | null> {
  const r = await send("/api/staff/join", "POST", pair);
  if (r.ok) {
    keep(null);
    return null;
  }
  if (isNoSignal(r.error) || r.unsure) {
    keep(pair);
    return { kind: "offline", pair, unsure: !!r.unsure };
  }
  keep(null);
  return { kind: "error", text: r.status === 400 ? BAD_QR : r.error };
}

/** かぎの指紋（サーバーの keyPrint と同じ：sha256("kfp:" + かぎ) の base64url の先頭 12 字）。調べられない端末は null */
async function keyPrint(key: string): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kfp:${key}`));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 12);
  } catch {
    return null;
  }
}

/** 実行委員の画面で：この QR がどのお店のものか・いまも使えるか（使えるか分からなければ null） */
async function checkQr(pair: Pair, list: JoinShop[]): Promise<View> {
  const shop = list.find((x) => x.id === pair.shop) ?? null;
  if (!shop || !shop.kfp) return { kind: "admin", pair, shop, valid: false };
  const fp = await keyPrint(pair.key);
  return { kind: "admin", pair, shop, valid: fp === null ? null : fp === shop.kfp };
}

// 開発中は effect が 2 回動くので、はじめに読んだ # のうしろを覚えておく（2 回目はもう消えている）
let captured: string | null = null;

/**
 * お店の QR を読んだ画面（/join#s=お店&k=かぎ）。読んだらすぐアドレスからかぎを消して、サーバーに確かめてもらい、お店の画面へ移る。
 *  - 電波で入れなかった・返事が来なかったとき：［もう一度ためす］（QR の中身はこのタブの中だけに一時的に置く。読み込み直しても、もう一度ためす）
 *  - 実行委員でログイン中：黙ってお店の人に切りかえない。どのお店の QR か・使えるかを見せて、選んでもらう
 *  - 別のお店の人としてログイン中：黙って切りかえない。いまのお店にもどるか、この QR のお店に入るかを選んでもらう
 */
export function JoinClient({ admin, current }: { admin: JoinShop[] | null; current: JoinCurrent | null }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "opening" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (captured === null || window.location.hash) captured = window.location.hash;
    const params = new URLSearchParams(captured.slice(1));
    const s = params.get("s") ?? "";
    const k = params.get("k") ?? "";
    history.replaceState(null, "", "/join");
    const pair = s && k ? { shop: s, key: k } : readKept();
    let alive = true;
    const next: Promise<View | null> = !pair || !goodPair(pair)
      ? Promise.resolve({ kind: "error", text: BAD_QR })
      : admin
        ? checkQr(pair, admin)
        : current && current.id !== pair.shop
          ? Promise.resolve({ kind: "other", pair, current })
          : tryJoin(pair);
    next.then((v) => {
      if (!alive) return;
      if (v) setView(v);
      else router.replace("/staff");
    });
    return () => {
      alive = false;
    };
  }, [router, admin, current]);

  async function enter(pair: Pair) {
    setPending(true);
    const v = await tryJoin(pair);
    if (!v) return router.replace("/staff");
    setPending(false);
    setView(v);
  }

  return (
    <main id="main" className="st-login">
      <div className="st-login-card">
        <Logo href="/" />
        {view.kind === "opening" && (
          <div role="status">
            <h1>お店の画面をひらいています…</h1>
            <p className="st-muted">少しお待ちください。</p>
          </div>
        )}

        {view.kind === "error" && (
          <>
            <h1>お店の画面に入れませんでした</h1>
            <p className="st-err" role="alert">
              {view.text}
            </p>
            <p className="st-muted lg-join-text">
              実行委員・先生は <Link href="/staff/login">合言葉でログイン</Link>
            </p>
          </>
        )}

        {view.kind === "offline" && (
          <>
            <h1>お店の画面に入れませんでした</h1>
            <p className="st-err" role="alert">
              {view.unsure
                ? "返事が来ませんでした。電波のよい所で［もう一度ためす］を押してください。"
                : "電波が届きませんでした。電波のよい所で［もう一度ためす］を押すか、QR をもう一度読み取ってください。"}
            </p>
            <div className="lg-actions">
              <Button variant="primary" size="lg" block pending={pending} onClick={() => enter(view.pair)}>
                もう一度ためす
              </Button>
            </div>
          </>
        )}

        {view.kind === "other" && (
          <>
            <h1>別のお店の QR です</h1>
            <p className="lg-join-text">
              いまは『{view.current.name}』のお店の人として入っています。この QR で入ると、この QR のお店の画面に切りかわります（『{view.current.name}』にもどるときは、そのお店の QR をもう一度読み取ります）。
            </p>
            <div className="lg-actions">
              <Button href="/staff" variant="primary" size="lg" block>
                『{view.current.name}』の画面にもどる
              </Button>
              <Button size="lg" block pending={pending} onClick={() => enter(view.pair)}>
                この QR のお店に入る
              </Button>
            </div>
          </>
        )}

        {view.kind === "admin" &&
          (!view.shop ? (
            <>
              <h1>この QR のお店が見つかりません</h1>
              <p className="st-err">消したお店の QR かもしれません。</p>
              <div className="lg-actions">
                <Button href="/staff" size="lg" block>
                  実行委員の画面へ
                </Button>
              </div>
            </>
          ) : view.valid === false ? (
            <>
              <h1>この QR は『{view.shop.name}』用ですが、もう使えません</h1>
              <p className="st-err">新しい QR に作り直されています。「お店の人に配る QR」から印刷し直して、お店に渡してください。</p>
              <div className="lg-actions">
                <Button href={`/staff/shops/${view.shop.id}`} variant="primary" size="lg" block>
                  このお店を編集
                </Button>
                <Button href="/staff/qr" size="lg" block>
                  お店の人に配る QR へ
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1>
                この QR は『{view.shop.name}』用{view.valid ? "で、使えます" : "です"}
              </h1>
              <p className="lg-join-text">
                いまは実行委員としてログインしています。
                {view.valid === null && "（この端末では、QR が使えるかまでは確かめられませんでした）"}
              </p>
              <div className="lg-actions">
                <Button href={`/staff/shops/${view.shop.id}`} variant="primary" size="lg" block>
                  このお店を編集
                </Button>
                <Button size="lg" block pending={pending} onClick={() => enter(view.pair)}>
                  お店の人として入る
                </Button>
                <p className="ui-hint">押すと実行委員のログインが終わり、『{view.shop.name}』のお店の人の画面になります（合言葉で、また実行委員に戻れます）。</p>
              </div>
            </>
          ))}
      </div>
    </main>
  );
}
