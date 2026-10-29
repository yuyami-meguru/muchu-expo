import type { Dept, MenuItem, Place, Shop, SiteData } from "./types";

// はじめに入れておくデータ（実行委員まとめ 8 月末時点・LINE 10 月まで）。
// 値段・場所・時間はほとんど決まっていないので「（予定）」か空にしてある。当日までに実行委員の画面で直す。
// 生徒・先生の名前は入れない。

const item = (id: string, name: string, price = "", note = ""): MenuItem => ({ id, name, price, note, stock: "on" });

const base = {
  catch: "",
  description: "",
  message: "",
  placeId: "",
  placeNote: "",
  menu: [] as MenuItem[],
  schedule: [] as Shop["schedule"],
  state: "prep" as const,
  notice: "",
  hidden: false,
  updatedAt: 0,
};

export const SEED_DEPTS: Dept[] = [
  { id: "taiken", name: "体験部門", short: "体験", tagline: "遊んで、つくって、持って帰れる", color: "blue", order: 10 },
  { id: "chaya", name: "エンカレ茶屋部門", short: "茶屋", tagline: "あったかい、おいしい、ひと休み", color: "orange", order: 20 },
  { id: "chiiki", name: "地域部門", short: "地域", tagline: "つくる人と、その想いに出会う", color: "red", order: 30 },
  { id: "kojin", name: "個人発表・展示", short: "発表", tagline: "ひとりひとりの「夢中」", color: "purple", order: 40 },
  { id: "unei", name: "実行委員", short: "運営", tagline: "ラジオ・案内", color: "green", order: 50 },
];

export const SEED_PLACES: Place[] = [
  { id: "tent-chiiku", name: "知育館そばのテント", x: 72, y: 30, note: "射的・くじ引き・押し花しおり" },
  { id: "tent-food", name: "屋外テント（食べ物）", x: 48, y: 62, note: "焼きそば・唐揚げ（予定）" },
  { id: "classroom", name: "校舎の教室", x: 24, y: 36, note: "喫茶・発表・展示" },
  { id: "radio", name: "放送ブース", x: 36, y: 74, note: "場所は決まり次第" },
];

export const SEED_SHOPS: Shop[] = [
  {
    ...base,
    id: "shateki",
    dept: "taiken",
    kind: "play",
    order: 10,
    name: "輪ゴム鉄砲の射的＆くじ引き",
    catch: "竹の鉄砲で、ねらって当てよう！",
    description:
      "学校の竹林で取った竹で、輪ゴム鉄砲を手作りしました。高得点の人にはお菓子、そのほかの人にも生徒が3Dプリンターなどでつくったオリジナルグッズの景品があります。参加賞は駄菓子です。",
    placeId: "tent-chiiku",
    placeNote: "知育館のそば（屋外テント）",
    menu: [item("shateki", "射的", "", "値段は準備中"), item("kuji", "くじ引き", "", "値段は準備中"), item("keihin", "手作りの景品")],
  },
  {
    ...base,
    id: "oshibana",
    dept: "taiken",
    kind: "play",
    order: 20,
    name: "押し花しおりづくり",
    catch: "生徒が育てた花で、自分だけのしおりを",
    description: "夏から生徒が種をまいて育てた花（キク・パンジー・コスモス・ジニア・ビオラ）を押し花にして、しおりをつくれます。",
    placeId: "tent-chiiku",
    placeNote: "知育館のそば（屋外テント）",
    menu: [item("shiori", "押し花しおり")],
  },
  {
    ...base,
    id: "chaya",
    dept: "chaya",
    kind: "eat",
    order: 30,
    name: "エンカレ茶屋",
    catch: "エンカレの桜のさくら茶で、ほっとひと息",
    description: "エンカレの桜を使ったさくら茶と緑茶、焼き団子、焼き芋（大学芋・塩バター味）。",
    menu: [item("sakura", "さくら茶"), item("ryokucha", "緑茶"), item("dango", "焼き団子"), item("daigaku", "大学芋"), item("shiobata", "焼き芋 塩バター味")],
  },
  {
    ...base,
    id: "yakisoba",
    dept: "chaya",
    kind: "eat",
    order: 40,
    name: "焼きそば",
    catch: "鉄板で焼きたて",
    description: "鉄板で焼きたての焼きそば。青のり・マヨネーズのトッピングも。",
    placeId: "tent-food",
    placeNote: "屋外テント（予定）",
    menu: [item("yakisoba", "焼きそば", "400円前後（予定）", "青のり・マヨ")],
  },
  {
    ...base,
    id: "karaage",
    dept: "chaya",
    kind: "eat",
    order: 50,
    name: "唐揚げ",
    catch: "揚げたてにオーロラソースとレモン",
    description: "揚げたての唐揚げに、オーロラソースとレモンを添えて。",
    placeId: "tent-food",
    placeNote: "屋外テント（予定）",
    menu: [item("karaage", "唐揚げ", "", "値段は準備中")],
  },
  {
    ...base,
    id: "banana",
    dept: "chaya",
    kind: "eat",
    order: 60,
    name: "バナナジュース喫茶",
    catch: "メイド喫茶風のお店でひと休み",
    description: "メイド喫茶風のお店で、バナナジュースとチェキ撮影が楽しめます。",
    placeId: "classroom",
    placeNote: "201 または 303 号室（予定）",
    menu: [item("banana", "バナナジュース", "300円前後（予定）"), item("cheki", "チェキ撮影", "350円前後（予定）")],
  },
  {
    ...base,
    id: "chiiki",
    dept: "chiiki",
    kind: "see",
    order: 70,
    name: "地域のつくり手を紹介",
    catch: "つくる人と、その想いに出会う",
    description: "地域でものをつくっている人と、その仕事や想いを紹介します。広島の魅力が伝わる企画を準備しています。",
  },
  {
    ...base,
    id: "kojin",
    dept: "kojin",
    kind: "see",
    order: 80,
    name: "生徒の「夢中」の発表・展示",
    catch: "作品・探究・バンド演奏など",
    description: "作品の展示、探究の発表、バンド演奏など、生徒が夢中になっていることを一人ひとりが表現します。",
    placeId: "classroom",
    placeNote: "校舎内の各教室",
  },
  {
    ...base,
    id: "radio",
    dept: "unei",
    kind: "see",
    order: 90,
    name: "校内ラジオ",
    catch: "午前と午後に生放送（予定）",
    description: "実行委員が会場全体に向けて放送します。お店や発表のお知らせ、クイズやゲーム。会場をまわると答えがわかる問題も出るかも？ 放送のない時間は、会場を盛り上げる音楽を流します。",
    placeId: "radio",
    schedule: [
      { time: "午前", text: "生放送 1 回目（時刻は準備中）" },
      { time: "午後", text: "生放送 2 回目（時刻は準備中）" },
    ],
  },
];

export const SEED: SiteData = { depts: SEED_DEPTS, shops: SEED_SHOPS, places: SEED_PLACES, news: [] };
