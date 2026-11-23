import { z } from "zod";

/*
 * 夢中アワードの設定（実行委員の画面で決める。保存は設定のキー "award" に JSON）。
 * 賞の名前・数・受賞のお店はあとから自由に変えられる。発表（published）がオフのあいだは、お客さんには受賞を見せない。
 * v0.19.0（2026-11-23）：実行委員会で 4 つの賞に決まった（部門の賞はなくなり、個人の展示が対象。賞の説明が審査の基準）→ DEFAULT_AWARDS。
 * お客さんはアンケートで賞ごとに「ふさわしいと思う展示」を選べる（lib/survey.ts の award）
 */

const t = (max: number) => z.string().trim().max(max);
const zShopId = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const awardBody = z.object({
  /** 2 = v0.19.0 からの画面で保存した（それより前の保存で、受賞がまだ無いものは、4 つの賞に読みかえる＝parseAward） */
  v: z.number().int().optional(),
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
/** 賞の対象の部門（個人発表・展示）。アンケートの投票と、受賞を選ぶ欄の候補 */
export const AWARD_DEPT = "kojin";

/** 2026-11-20 に実行委員会で決まった 4 つの賞（名前／説明＝審査の基準）。id は投票の集計に使うので変えない */
export const DEFAULT_AWARDS: Award[] = [
  { id: "unique", name: "ユニークアワード", note: "印象に残ったもの、個性のあるもの", winners: [] },
  { id: "charming", name: "チャーミングアワード", note: "魅力が引き出せていたもの", winners: [] },
  { id: "remember", name: "リメンバーアワード", note: "もう一度見たいもの", winners: [] },
  { id: "dream", name: "ドリームアワード", note: "見ていて自分も夢中になれたもの", winners: [] },
];
export const DEFAULT_AWARD: AwardSetting = { v: 2, title: "夢中アワード", published: false, teaser: "", awards: DEFAULT_AWARDS };

/**
 * 保存されている文字から読む（壊れていたら初めの形）。v0.19.0 より前の保存で、受賞がまだ 1 つも無いものは、
 * 賞を 4 つの賞に読みかえる（部門の賞はなくなったため。名前・発表前の文はそのまま。次に保存したときから、その内容を使う）
 */
export function parseAward(raw: string | null): AwardSetting {
  if (!raw) return DEFAULT_AWARD;
  try {
    const r = awardBody.safeParse(JSON.parse(raw));
    if (!r.success) return DEFAULT_AWARD;
    const a = r.data;
    if (a.v !== 2 && !a.awards.some((x) => x.winners.length)) return { ...a, v: 2, awards: DEFAULT_AWARDS };
    return a;
  } catch {
    return DEFAULT_AWARD;
  }
}
