"use client";

import { useEffect } from "react";

/** ⌘K（Windows は Ctrl+K）で、さがす欄に移る */
export function SearchShortcut({ inputId }: { inputId: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const el = document.getElementById(inputId) as HTMLInputElement | null;
        if (!el) return;
        e.preventDefault();
        el.focus();
        el.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputId]);
  return null;
}
