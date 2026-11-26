"use client";

import { useEffect } from "react";

/**
 * 日本語を、ことばの切れ目（文節）で折り返す（「金平｜糖」「工｜作」「ロビ｜ー」「販売｜中」のような切れ方をなくす。2026-11-26 のユーザーの指摘）。
 * - Chrome・Edge（Android・パソコン）は CSS の word-break: auto-phrase でできるので、html に ja-auto を付けるだけ（globals.css）。
 * - それ以外（iPhone・iPad の Safari、LINE などアプリの中の画面、Firefox）は、BudouX（Google の文節分け）で文節の間に幅のない空白（U+200B）を入れ、
 *   html に ja-ph を付けて word-break: keep-all にする（その空白と句読点の後ろでだけ折り返す。入りきらないことばは body の overflow-wrap で折る）。
 * 字を書きかえるのは、サーバーの HTML と画面の照合が済んだあと（描いた直後の useEffect）。あとから変わった字・増えた所も見張って入れ直す。
 * 入力欄・SVG・コード・data-no-phrase の中には入れない。コピーするときは空白を抜く（貼り付け先に見えない字が残らないように）。
 * 試すとき：Chrome でも localStorage の muchu-phrase を "js" にすると、BudouX の方で動く
 */
const ZW = "​";
const JA = /[぀-ヿ㐀-鿿豈-﫿]/;
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
    const html = document.documentElement;
    if (typeof CSS !== "undefined" && CSS.supports("word-break", "auto-phrase") && !forceJs()) {
      html.classList.add("ja-auto");
      return () => html.classList.remove("ja-auto");
    }
    let off = false;
    let obs: MutationObserver | undefined;
    const onCopy = (e: ClipboardEvent) => {
      const s = document.getSelection()?.toString() ?? "";
      if (!s.includes(ZW) || !e.clipboardData) return;
      e.clipboardData.setData("text/plain", s.replaceAll(ZW, ""));
      e.preventDefault();
    };
    document.addEventListener("copy", onCopy);
    import("budoux")
      .then(({ loadDefaultJapaneseParser }) => {
        if (off) return;
        const parser = loadDefaultJapaneseParser();
        const fix = (n: Node) => {
          const v = n.nodeValue;
          if (!v || !JA.test(v)) return;
          const el = n.parentElement;
          if (!el || el.closest(SKIP)) return;
          const out = parser.parse(v.replaceAll(ZW, "")).join(ZW);
          // 同じなら書かない（自分の書きかえで見張りがまた呼ばれても、ここで止まる）
          if (out !== v) n.nodeValue = out;
        };
        const walk = (root: Node) => {
          if (root.nodeType === Node.TEXT_NODE) return fix(root);
          if (root.nodeType !== Node.ELEMENT_NODE) return;
          const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let t = w.nextNode(); t; t = w.nextNode()) fix(t);
        };
        walk(document.body);
        html.classList.add("ja-ph");
        obs = new MutationObserver((list) => {
          for (const r of list) {
            if (r.type === "characterData") fix(r.target);
            else r.addedNodes.forEach(walk);
          }
        });
        obs.observe(document.body, { subtree: true, childList: true, characterData: true });
      })
      .catch(() => {
        // 読めなければ今までどおりの折り返し（字は書きかえない）
      });
    return () => {
      off = true;
      obs?.disconnect();
      document.removeEventListener("copy", onCopy);
      html.classList.remove("ja-ph");
    };
  }, []);
  return null;
}
