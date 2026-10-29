import type { IconName } from "@/components/icons";

/* メニューの項目（AVERIX の nav-items と同じ形）。枠（shell）は項目を受け取って並べるだけ。 */

export type NavItem = {
  /** active と比べる名前 */
  key: string;
  label: string;
  href: string;
  icon: IconName;
  /** 赤い丸の数（左メニュー） */
  count?: number;
  /** 下のメニューで、数の代わりに出す赤い点 */
  dot?: boolean;
};

export type NavGroup = { label?: string; items: NavItem[] };

export type FooterColumn = { title: string; links: { label: string; href: string }[] };

/* ───── お客さん側（だれでも見られる） ───── */
export const PUBLIC_NAV: NavItem[] = [
  { key: "home", label: "ホーム", href: "/", icon: "ホーム" },
  { key: "shops", label: "お店・出し物", href: "/shops", icon: "一覧" },
  { key: "map", label: "マップ", href: "/map", icon: "地図" },
  { key: "info", label: "ご案内", href: "/info", icon: "情報" },
];

export const PUBLIC_FOOTER: FooterColumn[] = [
  {
    title: "見る",
    links: [
      { label: "お店・出し物", href: "/shops" },
      { label: "マップ", href: "/map" },
      { label: "ご来場の方へ・アクセス", href: "/info" },
    ],
  },
  {
    title: "出す人へ",
    links: [{ label: "お店・実行委員の入口", href: "/staff" }],
  },
];

/* ───── 従業員側（お店の人・実行委員） ───── */
/** 実行委員・先生（合言葉でログイン） */
export const ADMIN_GROUPS: NavGroup[] = [
  {
    label: "当日",
    items: [
      { key: "home", label: "いまの様子", href: "/staff", icon: "ホーム" },
      { key: "news", label: "お知らせ", href: "/staff/news", icon: "お知らせ" },
    ],
  },
  {
    label: "準備",
    items: [
      { key: "shops", label: "お店の情報", href: "/staff/shops", icon: "一覧" },
      { key: "depts", label: "部門", href: "/staff/depts", icon: "しぼる" },
      { key: "places", label: "地図のピン", href: "/staff/places", icon: "地図" },
      { key: "qr", label: "お店の QR", href: "/staff/qr", icon: "QR" },
    ],
  },
];

export const ADMIN_TABS: NavItem[] = [
  { key: "home", label: "いまの様子", href: "/staff", icon: "ホーム" },
  { key: "news", label: "お知らせ", href: "/staff/news", icon: "お知らせ" },
  { key: "shops", label: "お店", href: "/staff/shops", icon: "一覧" },
  { key: "places", label: "地図", href: "/staff/places", icon: "地図" },
  { key: "more", label: "その他", href: "/staff/more", icon: "その他" },
];

/** お店の人（お店の QR でログイン）。自分のお店だけ */
export function shopTabs(shopId: string): NavItem[] {
  return [
    { key: "home", label: "売り切れ", href: "/staff", icon: "値札" },
    { key: "view", label: "お客さんの画面", href: `/shops/${shopId}`, icon: "外へ" },
  ];
}
