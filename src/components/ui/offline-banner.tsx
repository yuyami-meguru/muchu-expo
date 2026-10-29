"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * 電波がないときの帯（136:685・136:592）。画面のいちばん上に黄色で出す。
 * 消すボタンは付けない（つながったら自然に消える）。
 */
export function OfflineBanner({
  title = "インターネットにつながっていません。",
  text = "入れた中身は消えません。つながったら自動で保存します。",
}: {
  title?: string;
  text?: string;
}) {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <div className="ui-offline">
          <Icon name="注意" size={20} />
          <p className="ui-offline-text" style={{ margin: 0 }}>
            <b>{title}</b>
            <span className="ui-offline-sub">{text}</span>
          </p>
        </div>
      )}
    </div>
  );
}
