import type { Metadata } from "next";
import { Fragment } from "react";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui/card";
import { ListRow, RowList } from "@/components/ui/list-row";
import { ADMIN_GROUPS } from "@/components/shell";
import { adminOnly } from "../_components/admin-only";
import "./more.css";

export const metadata: Metadata = { title: "その他" };

/**
 * 名前だけでは分かりにくい画面に、ここでだけ分かりやすい名前と説明を付ける（メニューの定義は nav-items.ts）。
 * 狭い画面で「ポスタ／ー」のように言葉の途中で折り返さないよう、ひとまとまりごとに分けておく
 */
const PLAIN: Record<string, { title: string[]; sub: string[] }> = {
  qr: { title: ["お店の人に配る", " QR"], sub: ["売り切れを変える用・", "会場に貼らない"] },
  posters: { title: ["会場に貼る", "ポスター"], sub: ["お客さんが読む", " QR コード"] },
  site: { title: ["お客さんの画面"], sub: ["新しいタブで", "開きます"] },
};
/** 「 QR」のように先頭が空白のまとまりは、空白をまとまりの外に出す（中の先頭の空白は消えてしまうため） */
const phrases = (parts: string[]) =>
  parts.map((p) => (
    <Fragment key={p}>
      {p.startsWith(" ") && " "}
      <span className="st-phrase">{p.trimStart()}</span>
    </Fragment>
  ));

/**
 * スマホの下のメニューに入りきらない画面（AVERIX の「その他」と同じ形）。名前は途中で切らずに折り返す。
 * 「お客さんの画面」（メニューの newTab）は新しいタブで開く（いまの画面はそのまま残す）。版の番号は、どの画面もいちばん下（枠）に出るので、ここには出さない
 */
export default async function StaffMorePage() {
  await adminOnly("/staff/more");
  return (
    <div className="st-page st-stack">
      <PageHeader title="その他" />
      {ADMIN_GROUPS.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h2 className="st-muted" style={{ fontSize: "0.85rem" }}>
            {g.label}
          </h2>
          <RowList className="st-more-rows">
            {g.items.map((i) => (
              <ListRow
                key={i.key}
                title={PLAIN[i.key] ? phrases(PLAIN[i.key].title) : i.label}
                sub={PLAIN[i.key] && phrases(PLAIN[i.key].sub)}
                href={i.href}
                icon={i.icon}
                newTab={i.newTab}
                chevron
              />
            ))}
          </RowList>
        </section>
      ))}
      <p className="st-muted">
        <Icon name="情報" size={16} /> ログアウトは、各画面のいちばん下にあります
      </p>
    </div>
  );
}
