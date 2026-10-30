import "server-only";
import { getSetting, readList } from "./store";
import { parseMsgs, parseRadio, type RadioState } from "./radio";

/** ラジオの状態を読む（保存先がまだなら、はじめの状態） */
export async function loadRadio(): Promise<RadioState> {
  return parseRadio(await getSetting("radio"));
}

export const MSG_MAX = 2000;

/** 届いたメッセージ（新しい順）と、読んだ印の id */
export async function loadRadioMsgs() {
  const [list, read] = await Promise.all([readList("radio-msg", MSG_MAX), getSetting("radio-read")]);
  let readIds: string[] = [];
  try {
    readIds = read ? (JSON.parse(read) as string[]) : [];
  } catch {
    readIds = [];
  }
  return { messages: parseMsgs(list), readIds };
}
