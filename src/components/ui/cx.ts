/** クラス名をつなぐ（false・undefined は飛ばす） */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
