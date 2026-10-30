import Link from "next/link";
import { Sprite } from "@/components/pixel/sprites";

/**
 * ホームに置く「夢中アワード 発表！」の帯。発表がオンのときだけ出す（オフなら何も出さない）。
 * データは呼ぶ側で getSetting("award") → parseAward して渡す
 */
export function AwardBanner({ published, title }: { published: boolean; title: string }) {
  if (!published) return null;
  return (
    <section className="aw-banner-wrap" aria-label={`${title}の発表`}>
      <Link href="/award" className="aw-banner">
        <Sprite name="trophy" size={44} />
        <span>
          <strong>{title} 発表！</strong>
          <small>選ばれた「夢中」を見る</small>
        </span>
        <span className="aw-banner-go" aria-hidden="true">
          ▶
        </span>
      </Link>
    </section>
  );
}
