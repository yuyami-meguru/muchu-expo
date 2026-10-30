export type Result = { text: string; error?: boolean } | null;

/** 押した結果の文。押したカードの中（ボタンのすぐ下）に出す。失敗は赤 */
export function ResultLine({ r }: { r: Result }) {
  return (
    <p className={r?.error ? "ops-result ops-result--ng" : "ops-result"} role={r?.error ? "alert" : "status"}>
      {r?.text}
    </p>
  );
}
