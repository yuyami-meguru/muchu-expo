import { Card } from "./card";
import { Loading, Skeleton, SkeletonRows } from "./skeleton";

/**
 * 画面ぜんたいの「読み込み中」の形（見出し・説明・一覧のカード）。各区画の loading.tsx で使う。
 * 押したらすぐ形が出るので、つぎの画面を待つあいだも反応が分かる
 */
export function PageSkeleton({ rows = 5, label }: { rows?: number; label?: string }) {
  return (
    <Loading label={label}>
      <Skeleton width="30%" height={32} />
      <div style={{ height: 8 }} />
      <Skeleton width="20%" height={12} />
      <div style={{ height: 24 }} />
      <Card flush>
        <SkeletonRows rows={rows} />
      </Card>
    </Loading>
  );
}
