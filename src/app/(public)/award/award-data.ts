import { z } from "zod";

/*
 * 夢中アワードの設定（実行委員の画面で決める。保存は設定のキー "award" に JSON）。
 * 分け方・審査のしかたはまだ決まっていないので、賞の名前・数・受賞のお店はあとから自由に変えられる。
 * 発表（published）がオフのあいだは、お客さんには受賞を見せない。
 */

const t = (max: number) => z.string().trim().max(max);
const zShopId = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const awardBody = z.object({
  title: t(20).min(1),
  published: z.boolean(),
  teaser: t(40),
  awards: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{1,40}$/),
        name: t(20).min(1),
        note: t(60),
        winners: z.array(z.object({ shop: zShopId, comment: t(120) })).max(20),
      }),
    )
    .max(30),
});

export type AwardSetting = z.infer<typeof awardBody>;
export type Award = AwardSetting["awards"][number];

export const AWARD_KEY = "award";
export const DEFAULT_AWARD: AwardSetting = { title: "夢中アワード", published: false, teaser: "", awards: [] };

/** 保存されている文字から読む（壊れていたら初めの形） */
export function parseAward(raw: string | null): AwardSetting {
  if (!raw) return DEFAULT_AWARD;
  try {
    const r = awardBody.safeParse(JSON.parse(raw));
    return r.success ? r.data : DEFAULT_AWARD;
  } catch {
    return DEFAULT_AWARD;
  }
}
