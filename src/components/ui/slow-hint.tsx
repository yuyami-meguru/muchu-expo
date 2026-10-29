"use client";

import { useEffect, useState } from "react";

/** 読み込みが after ミリ秒をこえたら、ひとこと出す */
export function SlowHint({ after = 3000, text = "少し時間がかかっています。このままお待ちください。" }: { after?: number; text?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), after);
    return () => clearTimeout(t);
  }, [after]);
  return (
    <p className="ui-slow" role="status" aria-live="polite">
      {slow ? text : null}
    </p>
  );
}
