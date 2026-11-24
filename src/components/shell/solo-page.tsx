/**
 * パンフの QR から開いたページ（URL に ?solo=1）の目印。2026-11-24 ユーザー「QR を開いたとき、サイトではなくそのページだけ開きたい」
 * → 「上のメニューを消す」。ページの中にこれを置くと、まわりの枠（上の帯・スマホの下のメニュー・いちばん下の案内の欄）を出さない
 * （shell.css の :has。サーバーで描くので、開いた瞬間からメニューが出ない）。ほかのページへ移ると目印が無くなり、ふだんの枠に戻る。
 * いちばん下の帯の「主催・サイト制作・版」の行は残す（版の表記はどの画面にも出す）
 */
export function SoloPage({ on }: { on: boolean }) {
  return on ? <span hidden data-solo-page="" /> : null;
}

/** ?solo=1 か（パンフの QR の転送ページ docs/2f・3f・survey・award が付ける） */
export const isSolo = (v: string | string[] | undefined) => v === "1";
