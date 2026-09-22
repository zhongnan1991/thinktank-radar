import type { FeedsResponse, IntelResponse, TrendingResponse, WebSearchResponse } from "@/types";
import {
  fetchFeedsBrowser,
  fetchIntelBrowser,
  fetchTrendingBrowser,
  fetchWebSearchBrowser,
} from "./shareApi";

// ── runtime mode detection ───────────────────────────────────────────────
// The same bundle powers two deployments:
//   · local dev server (Node backend present → /api/* returns JSON)
//   · public static share build (no backend → fall back to browser-direct
//     fetch through public CORS proxies)
let modePromise: Promise<"backend" | "browser"> | null = null;

export function detectMode(): Promise<"backend" | "browser"> {
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const res = await fetch("/api/feeds?category=all", { signal: AbortSignal.timeout(6000) });
        const ct = res.headers.get("content-type") ?? "";
        // static hosts answer with index.html (text/html) or a 404
        if (res.ok && ct.includes("application/json")) return "backend";
      } catch {
        /* network error → no local backend */
      }
      return "browser";
    })();
  }
  return modePromise;
}

export async function isShareMode(): Promise<boolean> {
  return (await detectMode()) === "browser";
}

// ── API surface used by the views ────────────────────────────────────────
export async function fetchFeeds(category: string, refresh = false): Promise<FeedsResponse> {
  if (await detectMode() === "backend") {
    const res = await fetch(`/api/feeds?category=${encodeURIComponent(category)}${refresh ? "&refresh=1" : ""}`);
    if (!res.ok) throw new Error(`feeds HTTP ${res.status}`);
    return res.json();
  }
  return fetchFeedsBrowser(category as Parameters<typeof fetchFeedsBrowser>[0], refresh);
}

export async function fetchIntel(q: string, timespan: string, lang: string, refresh = false): Promise<IntelResponse> {
  if (await detectMode() === "backend") {
    const res = await fetch(
      `/api/intel?q=${encodeURIComponent(q)}&timespan=${encodeURIComponent(timespan)}&lang=${encodeURIComponent(lang)}${refresh ? "&refresh=1" : ""}`
    );
    const data: IntelResponse = await res.json();
    if (!res.ok && !data.error) throw new Error(`intel HTTP ${res.status}`);
    return data;
  }
  return fetchIntelBrowser(q, timespan, lang, refresh);
}

export async function fetchWebSearch(q: string, refresh = false): Promise<WebSearchResponse> {
  if (await detectMode() === "backend") {
    const res = await fetch(`/api/websearch?q=${encodeURIComponent(q)}${refresh ? "&refresh=1" : ""}`);
    const data: WebSearchResponse = await res.json();
    if (!res.ok && !data.error) throw new Error(`websearch HTTP ${res.status}`);
    return data;
  }
  return fetchWebSearchBrowser(q, refresh);
}

export async function fetchTrending(): Promise<TrendingResponse> {
  if (await detectMode() === "backend") {
    const res = await fetch("/api/trending");
    if (!res.ok) throw new Error(`trending HTTP ${res.status}`);
    return res.json();
  }
  return fetchTrendingBrowser();
}
