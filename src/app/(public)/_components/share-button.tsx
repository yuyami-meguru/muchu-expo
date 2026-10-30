"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { SITE_URL } from "@/lib/site";

/** 送るアドレス。本番はサイトの正式なアドレス、手元（next dev）では開いているアドレス */
function urlOf(path: string) {
  const base = process.env.NODE_ENV === "production" ? SITE_URL : window.location.origin;
  return new URL(path, base).toString();
}

/** 共有の画面が使えないとき：アドレスをコピーする（古い端末は選んでコピーの命令で） */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * ［このページを送る］（家族や友だちに、LINE・メールなどでこのページのアドレスを送る）。
 * スマホの共有の画面（navigator.share）を開く。使えないとき（LINE の中のブラウザ・パソコンなど）はアドレスをコピーして「コピーしました」。
 * コピーもできないときは、アドレスを出して長押しでコピーしてもらう。お店の人に配る QR とは別のもの（お客さん向けのページのアドレスだけ）
 */
export function ShareButton({ path, title, className }: { path: string; title: string; className?: string }) {
  const [msg, setMsg] = useState("");
  const [manual, setManual] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function say(text: string) {
    setMsg(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 8000);
  }

  async function send() {
    const url = urlOf(path);
    setManual("");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (e) {
        // 自分でやめたときは何もしない。共有の画面が開けなかったときはコピーへ
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    if (await copy(url)) return say("アドレスをコピーしました。LINE やメールに貼りつけて送れます。");
    setManual(url);
    say("下のアドレスを長押しして（パソコンでは選んで）、コピーしてください。");
  }

  return (
    <div className={className ? `mx-share ${className}` : "mx-share"}>
      <button type="button" className="mx-share-btn" onClick={send}>
        <Icon name="送る" size={20} />
        このページを送る
      </button>
      <p className="mx-share-msg" role="status">
        {msg}
      </p>
      {manual && (
        <input className="mx-share-url" type="text" readOnly value={manual} aria-label="このページのアドレス" onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}
