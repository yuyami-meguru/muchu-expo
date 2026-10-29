// サイトのバージョン（package.json の version。リリースのたびに上げて、CHANGELOG.md とタグ v○.○.○ をそろえる）
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
/** 作ったときのコミット（7 文字。分からなければ空） */
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "";

/** 画面に出す表記（例：「v2.0.0-beta.1（ためし版）」） */
export function versionLabel() {
  const beta = /-(beta|rc|alpha)/.test(APP_VERSION);
  return `v${APP_VERSION}${beta ? "（ためし版）" : ""}`;
}
