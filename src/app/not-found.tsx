import { NotFoundBody } from "./(public)/_components/not-found-body";

/** ページが見つからないとき（アドレスのまちがい）。お客さん側のページの中で見つからないときは (public)/not-found.tsx */
export default function NotFound() {
  return (
    <main id="main" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 16px", textAlign: "center" }}>
      <NotFoundBody />
    </main>
  );
}
