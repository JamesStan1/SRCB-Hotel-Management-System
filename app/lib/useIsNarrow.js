"use client";

import { useState, useEffect } from "react";

// Returns true when viewport width is less than or equal to 720px.
// Uses matchMedia where available and keeps the listener lean.
export default function useIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 720px)");
    const handle = (e) => setIsNarrow(e.matches);
    // initialize
    setIsNarrow(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", handle);
    } else if (mql.addListener) {
      mql.addListener(handle);
    }
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener("change", handle);
      } else if (mql.removeListener) {
        mql.removeListener(handle);
      }
    };
  }, []);

  return isNarrow;
}
