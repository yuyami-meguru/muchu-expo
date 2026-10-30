"use client";

// 従業員側の画面から API を呼ぶ。失敗したら、サーバーが返した日本語（error）をそのまま返す。
export type SendResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: string;
      /** 返事の番号（401＝ログインが切れた、409＝ほかで変わっていた など）。返事が来なかったときは無い */
      status?: number;
      /** 返事を待ちきれずに打ち切った。サーバーには届いて保存されているかもしれない（いまの様子を読み直して確かめる） */
      unsure?: boolean;
      /** 409 のとき、ほかの人が直していた欄（"menu"・"description" など。PATCH /api/staff/shops/<id> の base） */
      conflict?: string[];
    };

/** 電波で送れなかったときの文（画面の側で「電波のせいか」を見分けるのにも使う） */
export const NO_SIGNAL_ERROR = "電波が届かず、送れませんでした（まだ保存されていません）。電波のよい所で、もう一度押してください";

/** 返事を待ちきれずに打ち切ったときの文。届いていることもあるので「保存されていません」とは言わない */
export const UNSURE_ERROR = "返事が来ませんでした。届いているかもしれないので、いまの様子を読み直して確かめています";

/** 電波が弱いとき、いつまでも「送信中」にならないよう、この時間で打ち切る */
const TIMEOUT_MS = 10_000;

export async function send<T = Record<string, unknown>>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<SendResult<T>> {
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal: ctl.signal,
    });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; conflict?: unknown } & T) | null;
    if (!res.ok || !json?.ok) {
      const conflict = Array.isArray(json?.conflict) ? json.conflict.filter((x): x is string => typeof x === "string") : undefined;
      return { ok: false, error: json?.error ?? `うまくいきませんでした（${res.status}）。少し待って、もう一度ためしてください`, status: res.status, ...(conflict ? { conflict } : {}) };
    }
    return json as { ok: true } & T;
  } catch {
    // 打ち切ったのは、送ったあとに返事が遅れただけかもしれない（電波で送れなかったのとは分ける）
    return timedOut ? { ok: false, error: UNSURE_ERROR, unsure: true } : { ok: false, error: NO_SIGNAL_ERROR };
  } finally {
    clearTimeout(timer);
  }
}

/** 時刻を「13:05」に（日本時間） */
export function clock(at: number) {
  return new Date(at).toLocaleTimeString("ja-JP", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Tokyo" });
}

/** 「保存しました 13:05」 */
export function savedAt() {
  const d = new Date();
  return `保存しました ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 英字の名前（a-z・0-9・-）に直す */
export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
