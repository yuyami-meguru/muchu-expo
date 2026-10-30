"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { send } from "../_lib/client";

/** 実行委員・先生の合言葉の欄。［見る］で入れた文字を確かめられる（大文字・小文字、全角・半角のまちがいに気づけるように） */
export function LoginForm() {
  const router = useRouter();
  const inputId = `pass${useId()}`;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pass = String(new FormData(e.currentTarget).get("pass") ?? "");
    if (!pass.trim()) return setError("合言葉を入れてください");
    setPending(true);
    setError("");
    const r = await send("/api/staff/login", "POST", { pass });
    if (!r.ok) {
      setPending(false);
      return setError(r.error);
    }
    router.replace("/staff");
    router.refresh();
  }
  return (
    <form className="lg-form" onSubmit={submit} noValidate>
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
      <Button type="submit" variant="primary" size="lg" block pending={pending}>
        ログイン
      </Button>
    </form>
  );
}
