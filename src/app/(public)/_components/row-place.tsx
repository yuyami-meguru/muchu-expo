import Link from "next/link";
import { Icon } from "@/components/icons";

/**
 * タイムテーブル・ホームの「このあと」の行に添える場所（「知育館 3階・301 教室」）。
 * 地図のピンがあれば押すとマップでその場所を指す（/map?place=）。ピンが無ければ字だけ（場所の補足）。場所が空なら何も出さない。
 * サーバーの部品からも画面の側の部品からも使える（中で状態を持たない）
 */
export function RowPlace({ place, placeId, className }: { place: string; placeId: string; className: string }) {
  if (!place) return null;
  const inner = (
    <>
      <Icon name="場所" size={16} />
      <span className="mx-rowplace-t">
        <span className="sr-only">場所：</span>
        {place}
      </span>
    </>
  );
  if (!placeId) return <span className={className}>{inner}</span>;
  return (
    <Link href={`/map?place=${encodeURIComponent(placeId)}`} className={className}>
      {inner}
      <span className="mx-rowplace-go">
        マップ<span aria-hidden="true"> ▶</span>
      </span>
    </Link>
  );
}
