import "server-only";
import QRCode from "qrcode";
import { EVENT } from "@/lib/venue";
import { areaName, areaOf, OUTSIDE, placeKindOf, type Area, type Place, type Shop, type Tone } from "@/lib/types";

/*
 * 紙（ポスター・フロアの案内・受付の控え）で使う道具。紙に刷るものなので、色はいつも明るい画面の色で決める。
 * お客さん向けの紙の QR は、ここの publicQr だけで作る（行き先はサイトの公開ページだけ。お店の人の QR＝かぎ入りは入れない）。
 */

/** 部門の色（印刷はいつも明るい色。画面がダークモードでも同じ紙になるように） */
export const TONE_HEX: Record<Tone, string> = {
  blue: "#1f4fb0",
  orange: "#c64d0c",
  red: "#b8321f",
  purple: "#6a43a8",
  green: "#2f7a22",
  teal: "#0b7068",
  pink: "#b02a68",
  brown: "#7a5230",
};

/** 「2026年11月28日（土）」から「2026.11.28（土）」と「11/28（土）」を作る（日付は venue.ts の EVENT だけを直せばよい） */
const ymd = EVENT.date.match(/(\d+)年(\d+)月(\d+)日(.*)$/);
export const DOT_DATE = ymd ? `${ymd[1]}.${ymd[2]}.${ymd[3]}${ymd[4]}` : EVENT.date;
export const SHORT_DATE = ymd ? `${Number(ymd[2])}/${Number(ymd[3])}${ymd[4]}` : EVENT.date;

/** 「10月31日 1:05 時点」（日本時間。time=false なら「10月31日 時点」） */
export function asOfText(time = true) {
  const t = new Date(Date.now() + 9 * 3600_000);
  const day = `${t.getUTCMonth() + 1}月${t.getUTCDate()}日`;
  return time ? `${day} ${t.getUTCHours()}:${String(t.getUTCMinutes()).padStart(2, "0")} 時点` : `${day} 時点`;
}

/**
 * お客さんに見せてよい QR（サイトの公開ページだけ）。外に貼る紙は汚れるので、誤り訂正は Q（25%）。
 * まわりの白い余白は 2 マス（紙の上では、さらに QR の白い枠が付いて 4 マス近くになる）
 */
export async function publicQr(url: string) {
  // 念のため：お店の人の入口（かぎ入り）を、お客さん向けの紙に入れない
  if (/\/join\b|[#&?]k=/.test(url)) throw new Error("お店の人の QR は、お客さん向けの紙に入れられません");
  return QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "Q", color: { dark: "#1f2547", light: "#ffffff" } });
}

/** CSS の content: "…" に入れる文字（" と \ と改行を逃がす） */
export function cssString(s: string) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

export type PlaceInfo = {
  /** 「知育館 3階・301 教室」「屋外テント（食べ物）」。未定なら空 */
  label: string;
  /** 部屋・場所の名前だけ（「301 教室」）。未定なら空 */
  room: string;
  /** 場所の補足（「201 または 303 号室（予定）」） */
  note: string;
  /** 外（テントなど）。雨などで場所が変わることがある */
  outside: boolean;
  /** 地図のピンが決まっている（readiness.ts と同じ決め方：ピンが消されていたら未定） */
  set: boolean;
  /** フロアの id（外なら OUTSIDE） */
  area: string;
  place: Place | null;
};

/** お店の場所の書き方を、紙ごとにそろえる道具 */
export function placeReader(places: Place[], areas: Area[]) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  return (shop: Pick<Shop, "placeId" | "placeNote">): PlaceInfo => {
    const p = shop.placeId ? byId.get(shop.placeId) : undefined;
    const note = shop.placeNote.trim();
    if (!p) return { label: "", room: "", note, outside: false, set: false, area: "", place: null };
    const area = areaOf(p);
    const a = areaById.get(area);
    return { label: a ? `${areaName(a)}・${p.name}` : p.name, room: p.name, note, outside: area === OUTSIDE || !a, set: true, area: a ? a.id : OUTSIDE, place: p };
  };
}

/** 設備（トイレ・受付・救護・休憩所・入口）のピンか */
export const isFacility = (p: Place) => placeKindOf(p) !== "spot" && placeKindOf(p) !== "building";
