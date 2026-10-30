"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { appleMapsUrl, embedMapUrl, googleMapsUrl, VENUE } from "@/lib/venue";
import "./access.css";

/**
 * 会場への地図。Apple マップをいちばん上に、Google マップも（どちらも地図アプリ・別の画面で開く）。
 * 正確な位置が入っていれば、地図（OpenStreetMap）も出せる。通信を減らすため、地図は「地図を表示」を押してから読み込む
 */
export function AccessMap() {
  const embed = embedMapUrl();
  const [show, setShow] = useState(false);
  return (
    <div className="ac">
      <div className="ac-btns">
        <a className="ac-btn ac-btn--apple" href={appleMapsUrl()} target="_blank" rel="noopener noreferrer">
          <Icon name="地図" size={20} />
          <span>
            Apple マップで開く
            <small>別の画面で開きます</small>
          </span>
        </a>
        <a className="ac-btn" href={googleMapsUrl()} target="_blank" rel="noopener noreferrer">
          <Icon name="道案内" size={20} />
          <span>
            Google マップで開く
            <small>別の画面で開きます</small>
          </span>
        </a>
      </div>
      {embed &&
        (show ? (
          <>
            <div className="ac-embed">
              <iframe src={embed} title={`${VENUE.name}の地図`} loading="lazy" />
            </div>
            <p className="ac-note">地図の印はだいたいの位置です。くわしくは上のボタンで地図アプリを開いてください。</p>
          </>
        ) : (
          <button type="button" className="ac-show" onClick={() => setShow(true)}>
            <Icon name="地図" size={20} />
            ここに地図を表示（OpenStreetMap）
          </button>
        ))}
    </div>
  );
}
