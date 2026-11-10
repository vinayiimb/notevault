"use client";

import { useEffect } from "react";
import { initBom } from "./init";

export function BomClient() {
  useEffect(() => {
    const ac = new AbortController();
    // deferred so React strict mode (dev) mounts, cleans up and mounts again without preparing the DOM twice
    const t = setTimeout(() => {
      const root = document.getElementById("bomx");
      if (root) initBom(root, ac.signal);
    }, 0);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, []);
  return null;
}
