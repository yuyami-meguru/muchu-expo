/**
 * 端末ごとの乱数（アンケート・ラジオのメッセージに付けて送る。同じ端末からの回答を 1 つに数えたり、いたずらを見分けたりするため）。
 * 名前や連絡先とは結びつかない。端末に残しておき、次からも同じものを送る。残せない端末（プライベートブラウズなど）では毎回新しく作る。40 字まで
 */
const DEVICE_KEY = "muchu-device";

function make() {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return id.slice(0, 40);
}

export function deviceId(): string {
  try {
    const v = localStorage.getItem(DEVICE_KEY);
    if (v && /^[\w-]{8,40}$/.test(v)) return v;
    const n = make();
    localStorage.setItem(DEVICE_KEY, n);
    return n;
  } catch {
    return make();
  }
}
