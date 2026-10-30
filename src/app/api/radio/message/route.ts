import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { clientIp, fail, guarded, ok, readBody } from "@/lib/api";
import { RADIO_MSG_LABELS, radioMsgBody, type RadioMsg } from "@/lib/radio";
import { loadRadio, MSG_MAX } from "@/lib/radio-server";
import { allow, allowHere, pushList } from "@/lib/store";

// お客さんからラジオへのメッセージ（質問・メッセージ・リクエスト・クイズの答え）。ログインはいらない。
// 回数の上限：
//  - つなぎ先（IP）ごとに 10 分 300 回（会場の Wi-Fi は全員が同じ IP になることがあるので大きめ）。
//    連打はまずこのサーバーの中の回数で止め（1 分 60 回も）、Upstash を使わない
//  - 端末の印（device）があれば、端末ごとに 1 分 5 回・10 分 30 回（人ならこれで足りる）
//  - 同じ端末（無ければ同じ IP とラジオネーム）から同じ文を 10 分のうちに送り直したら、送れたことにして 2 通目は残さない
//    （クイズの答えはみんな同じ文になるので、端末の印が無いときは比べない）
// 届いたメッセージは 2000 通まで（古いものから消える）。いたずらで本物が消えないよう、上の上限で量を抑える
const PROD = process.env.NODE_ENV === "production";
const LIMIT = PROD ? 300 : 1000;
const PER_MIN = PROD ? 60 : 1000;
const DEVICE_PER_MIN = PROD ? 5 : 100;
const DEVICE_PER_10MIN = PROD ? 30 : 1000;
const TOO_MANY = "いまメッセージがとても多いため、受け付けられませんでした。数分待ってから、もう一度［ラジオに送る］を押してください";

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const b = await readBody(req, radioMsgBody, { labels: RADIO_MSG_LABELS });
    if ("error" in b) return b.error;
    const ip = clientIp(req);
    if (!allowHere(`radio:${ip}`, LIMIT, 600) || !allowHere(`radio1m:${ip}`, PER_MIN, 60)) return fail(429, TOO_MANY);
    const { website, device, ...m } = b.data;
    // 見えない欄に何か入っていたら機械の送りつけ。送れたふりをして保存しない
    if (website) return ok();
    if (device && !allowHere(`radio-d1m:${device}`, DEVICE_PER_MIN, 60)) return fail(429, "続けて送りすぎています。1 分ほど待ってから、もう一度［ラジオに送る］を押してください");
    if (!(await loadRadio()).msgOpen) return fail(403, "いまはメッセージを受け付けていません");
    if (!(await allow(`radio:${ip}`, LIMIT, 600))) return fail(429, TOO_MANY);
    if (device && !(await allow(`radio-d:${device}`, DEVICE_PER_10MIN, 600))) return fail(429, "続けて送りすぎています。数分待ってから、もう一度［ラジオに送る］を押してください");
    // 同じ文の送り直し（押しなおし・いたずら）
    const who = device ?? (m.kind === "クイズの答え" ? "" : `${ip}:${m.name}`);
    if (who) {
      const sig = createHash("sha256").update(`${who}\n${m.kind}\n${m.text}`).digest("base64url").slice(0, 22);
      if (!(await allow(`radio-dup:${sig}`, 1, 600))) return ok();
    }
    const msg: RadioMsg = { id: randomBytes(5).toString("hex"), at: Date.now(), ...m };
    await pushList("radio-msg", JSON.stringify(msg), MSG_MAX);
    return ok();
  });
}
