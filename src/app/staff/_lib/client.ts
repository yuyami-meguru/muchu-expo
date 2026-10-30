"use client";

// 従業員側の画面から API を呼ぶ。失敗したら、サーバーが返した日本語（error）をそのまま返す。
export type SendResult<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: string };

/** 電波で送れなかったときの文（画面の側で「電波のせいか」を見分けるのにも使う） */
export const NO_SIGNAL_ERROR = "電波が届かず、送れませんでした（まだ保存されていません）。電波のよい所で、もう一度押してください";

/** 電波が弱いとき、いつまでも「送信中」にならないよう、この時間で打ち切る */
const TIMEOUT_MS = 10_000;

export async function send<T = Record<string, unknown>>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<SendResult<T>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal: ctl.signal,
    });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
    if (!res.ok || !json?.ok) return { ok: false, error: json?.error ?? `うまくいきませんでした（${res.status}）。もう一度ためすか、実行委員に知らせてください` };
    return json as { ok: true } & T;
  } catch {
    return { ok: false, error: NO_SIGNAL_ERROR };
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
