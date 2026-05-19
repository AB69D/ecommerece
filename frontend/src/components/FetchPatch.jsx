"use client";

import { useEffect } from "react";

export default function FetchPatch() {
  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backend) return;
    if (typeof window === "undefined") return;
    if (window.__fetchPatched) return;
    window.__fetchPatched = true;

    const orig = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init) {
      try {
        if (typeof input === "string" && input.startsWith("/api/")) {
          return orig(backend.replace(/\/$/, "") + input, init);
        }
        if (input && typeof input === "object" && input.url && input.url.startsWith("/api/")) {
          return orig(new Request(backend.replace(/\/$/, "") + input.url.replace(window.location.origin, ""), input), init);
        }
      } catch (_) {}
      return orig(input, init);
    };
  }, []);

  return null;
}
