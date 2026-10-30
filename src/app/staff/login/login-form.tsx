"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { send } from "../_lib/client";

/**
 * 実行委員・先生の合言葉の欄。［見る］で入れた文字を確かめられる（大文字・小文字、全角・半角のまちがいに気づけるように）。
 *  - 入口（/staff/login）：入れたら next（なければ /staff）へ
 *  - 画面の上の帯（ログインが切れたとき）：onDone を渡す。ページは移らない（書きかけを消さないため）
 */
export function LoginForm({ next = "/staff", onDone, compact = false }: { next?: string; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const inputId = `pass${useId()}`;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pass = String(new FormData(form).get("pass") ?? "");
    if (!pass.trim()) return setError("合言葉を入れてください");
    setPending(true);
    setError("");
    const r = await send("/api/staff/login", "POST", { pass });
    if (!r.ok) {
      setPending(false);
      return setError(r.unsure ? "返事が来ませんでした。電波のよい所で、もう一度ためしてください" : r.error);
    }
    if (onDone) {
      setPending(false);
      form.reset();
      setShow(false);
      return onDone();
    }
    router.replace(next);
    router.refresh();
  }
  return (
    <form className={compact ? "lg-form lg-form--compact" : "lg-form"} onSubmit={submit} noValidate>
      <div className="ui-field">
        <label className="ui-label" htmlFor={inputId}>
          合言葉
        </label>
        <div className="lg-pass">
          <input
            id={inputId}
            name="pass"
            type={show ? "text" : "password"}
            className="ui-input"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
          />
          <Button aria-label={show ? "合言葉をかくす" : "合言葉を見る"} aria-controls={inputId} onClick={() => setShow((v) => !v)}>
            {show ? "かくす" : "見る"}
          </Button>
        </div>
        <p className="ui-hint" id={`${inputId}-hint`}>
          合言葉は実行委員の先生に聞いてください
        </p>
        {error && (
          <p className="ui-error" id={`${inputId}-error`} role="alert">
            <Icon name="注意" size={14} />
            <span>{error}</span>
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" size={compact ? "md" : "lg"} block={!compact} pending={pending}>
        {compact ? "入り直す" : "ログイン"}
      </Button>
    </form>
  );
}
