import { NotFoundBody } from "./_components/not-found-body";

/** お客さん側のページで見つからないとき（お店が非表示・なくなった）。上の帯・下のメニューの枠の中に出す（main は枠の側にある） */
export default function PublicNotFound() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "40px 16px", textAlign: "center" }}>
      <NotFoundBody />
    </div>
  );
}
