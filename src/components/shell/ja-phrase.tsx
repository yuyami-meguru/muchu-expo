"use client";

import { useEffect } from "react";

/**
 * 日本語を、ことばの切れ目（文節）で折り返す（「金平｜糖」「工｜作」「ロビ｜ー」「販売｜中」のような切れ方をなくす。2026-11-26 のユーザーの指摘）。
 * - Chrome・Edge（Android・パソコン）は CSS の word-break: auto-phrase でできるので、html に ja-auto を付ける（globals.css）。
 * - それ以外（iPhone・iPad の Safari、LINE などアプリの中の画面、Firefox）は、BudouX（Google の文節分け）で文節の間に幅のない空白（U+200B）を入れ、
 *   html に ja-ph を付けて word-break: keep-all にする（その空白と句読点の後ろでだけ折り返す。入りきらないことばは body の overflow-wrap で折る）。
 * - どちらでも、数字と単位のあいだの半角空白（「20 秒」「3 つ」「300 円」「2 階」）は、改行しない空白（U+00A0）にする（「20｜秒」と切れないように）。
 *   切りたくない所には data-no-phrase（何も書きかえない）や .nowrap も使う
 * 字を書きかえるのは、サーバーの HTML と画面の照合が済んだあと（描いた直後の useEffect）。あとから変わった字・増えた所も見張って入れ直す。
 * 入力欄・SVG・コード・data-no-phrase の中には入れない。コピーするときは元の字に戻す（貼り付け先に見えない字が残らないように）。
 * 試すとき：Chrome でも localStorage の muchu-phrase を "js" にすると、BudouX の方で動く
 */
const ZW = "\u200b";
const NB = "\u00a0";
const JA = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;
/**
 * 数字のあとの半角空白で、うしろに単位が続くもの（「20 秒」「3 つ」「300 円」「2 階」「14 件」）。
 * 部屋の番号のうしろ（「202 小講義室」「301 教室」）は単位ではないので、そのまま（空白で折れてよい）
 */
const NUM_SP =
  /(\d) (?=(?:秒|分|時|日|月|年|週|個|件|人|名|組|円|回|階|つ|本|枚|台|店|か所|カ所|ヵ所|歳|才|番|度|点|冊|杯|皿|席|種|号|位|部|問|票|賞|曲|行|字|色|品|匹|頭|羽|ページ|%|％|km|m|cm|mm|kg|g))/g;
/** 改行しない空白のとなりに入った文節の空白（そこで切れると「20｜ 秒」になる）。古い Safari は後ろ読み（?<=）を読めないので、前と後ろを別に消す */
const ZW_BEFORE_NB = /\u200b(?=\u00a0)/g;
const ZW_AFTER_NB = /\u00a0\u200b/g;
const ZW_ALL = /\u200b/g;
const NB_ALL = /\u00a0/g;
const SKIP = "script,style,noscript,textarea,input,select,option,code,pre,svg,math,[contenteditable],[data-no-phrase]";

function forceJs() {
  try {
    return localStorage.getItem("muchu-phrase") === "js";
  } catch {
    return false;
  }
}

export function JaPhrase() {
  useEffect(() => {
    // 古い端末で何かが使えなくても、画面全体を止めない（失敗したら今までどおりの折り返し）
    try {
      return phrase();
    } catch {
      return undefined;
    }
  }, []);
  return null;
}

function phrase(): () => void {
  {
    const html = document.documentElement;
    const auto = typeof CSS !== "undefined" && CSS.supports("word-break", "auto-phrase") && !forceJs();
    let off = false;
    let obs: MutationObserver | undefined;
    // BudouX（ja-ph のときだけ）。読み込むまでは数字の空白だけ直す
    let parse: ((s: string) => string[]) | null = null;
    const textOf = (v: string) => {
      let out = (v.includes(ZW) ? v.replace(ZW_ALL, "") : v).replace(NUM_SP, `$1${NB}`);
      if (parse) out = parse(out).join(ZW).replace(ZW_BEFORE_NB, "").replace(ZW_AFTER_NB, NB);
      return out;
    };
    const fix = (n: Node) => {
      const v = n.nodeValue;
      if (!v || !JA.test(v)) return;
      const el = n.parentElement;
      if (!el || el.closest(SKIP)) return;
      const out = textOf(v);
      // 同じなら書かない（自分の書きかえで見張りがまた呼ばれても、ここで止まる）
      if (out !== v) n.nodeValue = out;
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return fix(root);
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) fix(t);
    };
    const start = () => {
      walk(document.body);
      obs?.disconnect();
      obs = new MutationObserver((list) => {
        for (const r of list) {
          if (r.type === "characterData") fix(r.target);
          else r.addedNodes.forEach(walk);
        }
      });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    };
    const onCopy = (e: ClipboardEvent) => {
      const s = document.getSelection()?.toString() ?? "";
      if (!(s.includes(ZW) || s.includes(NB)) || !e.clipboardData) return;
      e.clipboardData.setData("text/plain", s.replace(ZW_ALL, "").replace(NB_ALL, " "));
      e.preventDefault();
    };
    document.addEventListener("copy", onCopy);
    if (auto) {
      html.classList.add("ja-auto");
      start();
    } else {
      start();
      import("budoux")
        .then(({ loadDefaultJapaneseParser }) => {
          if (off) return;
          const parser = loadDefaultJapaneseParser();
          parse = (s) => parser.parse(s);
          walk(document.body);
          html.classList.add("ja-ph");
        })
        .catch(() => {
          // 読めなければ今までどおりの折り返し（数字の空白だけ直したまま）
        });
    }
    return () => {
      off = true;
      obs?.disconnect();
      document.removeEventListener("copy", onCopy);
      html.classList.remove("ja-auto", "ja-ph");
    };
  }
}
