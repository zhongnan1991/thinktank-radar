// Browser-direct data layer for the public share build (no Node backend).
// Strategy per endpoint:
//   · RSS feeds  — most origins block cross-origin fetch, so go through a
//     chain of keyless public CORS proxies (direct fetch tried first for the
//     few ACAO-friendly origins).
//   · GDELT      — serves Access-Control-Allow-Origin: *, browser-direct with
//     the same 1-request / 5.3s throttle the backend uses.
//   · Hacker News Algolia — CORS-open, direct.
//   · Google / Yandex / Bing HTML scraping — impossible from a browser
//     (CORS); reported honestly as unavailable in engine status.
// Results are cached in localStorage to spare the public proxies.

import { XMLParser } from "fast-xml-parser";
import { FEED_SOURCES, type Category, type FeedSource } from "./sources";
import type {
  EngineStatus,
  FeedsResponse,
  IntelArticle,
  IntelResponse,
  ReportItem,
  SourceStatus,
  TrendingResponse,
  TrendingItem,
  WebSearchResponse,
} from "@/types";

// ── public CORS proxy chain (keyless) ────────────────────────────────────
const PROXY_WRAPPERS: ((u: string) => string)[] = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
];

async function fetchText(url: string, timeoutMs = 16000): Promise<string> {
  // 1) direct — a few origins (e.g. federalreserve.gov) send ACAO:*.
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(timeoutMs, 8000)) });
    if (res.ok) return await res.text();
  } catch {
    /* CORS block or timeout — fall through to proxies */
  }
  // 2) proxy chain
  let lastErr = "直连被浏览器跨域策略阻止";
  for (const wrap of PROXY_WRAPPERS) {
    try {
      const res = await fetch(wrap(url), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        lastErr = `代理 HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      if (!text || /^error code:/i.test(text.trim())) {
        lastErr = "代理上游错误（源站或代理不可达）";
        continue;
      }
      return text;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

/** minimal concurrency pool */
async function runPool<T>(items: T[], width: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// ── localStorage cache ───────────────────────────────────────────────────
function lsGet<T>(key: string): { at: number; data: T } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { at: number; data: T };
  } catch {
    return null;
  }
}
function lsSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota exceeded — non-fatal */
  }
}

// ── RSS parsing (ported from server/feed-fetch.ts) ───────────────────────
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ["item", "entry", "link", "category"].includes(name),
});

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return textOf(node[0]);
  const obj = node as Record<string, unknown>;
  if ("#text" in obj) return textOf(obj["#text"]);
  if ("@_href" in obj) return textOf(obj["@_href"]);
  return "";
}

function linkOf(raw: Record<string, unknown>): string {
  const link = raw["link"];
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const arr = link as Record<string, unknown>[];
    const alt = arr.find((l) => l["@_rel"] === "alternate") ?? arr[0];
    return textOf(alt?.["@_href"] ?? alt);
  }
  return textOf(link);
}

function parseFeed(xml: string, source: FeedSource): ReportItem[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const root = doc as Record<string, unknown>;
  const rss = root?.["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  const atomFeed = root?.["feed"] as Record<string, unknown> | undefined;
  const rawItems: Record<string, unknown>[] = channel?.["item"] as Record<string, unknown>[] | undefined
    ?? atomFeed?.["entry"] as Record<string, unknown>[] | undefined
    ?? [];

  const items: ReportItem[] = [];
  for (const raw of rawItems) {
    const title = stripHtml(textOf(raw["title"]));
    const link = linkOf(raw);
    if (!title || !link) continue;
    const dateRaw = textOf(raw["pubDate"] ?? raw["published"] ?? raw["updated"] ?? raw["dc:date"]);
    const date = dateRaw ? new Date(dateRaw) : null;
    if (date && Number.isNaN(date.getTime())) continue;
    const summaryRaw = textOf(raw["description"] ?? raw["summary"] ?? raw["content"]);
    items.push({
      id: `${source.id}::${link}`,
      org: source.org,
      orgId: source.id,
      category: source.category,
      title,
      link,
      summary: stripHtml(summaryRaw).slice(0, 420),
      pubDate: (date ?? new Date()).toISOString(),
      lang: source.lang,
    });
  }
  return items;
}

// ── feeds ────────────────────────────────────────────────────────────────
export async function fetchFeedsBrowser(category: Category | "all", refresh = false): Promise<FeedsResponse> {
  const key = `tt:feeds:${category}`;
  if (!refresh) {
    const hit = lsGet<FeedsResponse>(key);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return { ...hit.data, cached: true };
  }

  const sources = FEED_SOURCES.filter((s) => category === "all" || s.category === category);
  const statuses: SourceStatus[] = [];
  const items: ReportItem[] = [];

  await runPool(sources, 5, async (source) => {
    const t0 = Date.now();
    try {
      const xml = await fetchText(source.url);
      if (!xml.trimStart().startsWith("<")) throw new Error("返回内容不是 XML");
      const parsed = parseFeed(xml, source).slice(0, 12);
      if (!parsed.length) throw new Error("未解析到条目");
      statuses.push({ id: source.id, org: source.org, category: source.category, ok: true, count: parsed.length, ms: Date.now() - t0 });
      items.push(...parsed);
    } catch (e) {
      statuses.push({
        id: source.id, org: source.org, category: source.category, ok: false, count: 0,
        ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  const data: FeedsResponse = {
    items: items.sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate)).slice(0, 160),
    sources: statuses.sort((a, b) => Number(b.ok) - Number(a.ok) || a.org.localeCompare(b.org)),
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
  lsSet(key, data);
  return data;
}

// ── GDELT (browser-direct, CORS-open) ────────────────────────────────────
const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";
let lastGdeltAt = 0;
async function gdeltThrottle(minGapMs = 5300) {
  const wait = lastGdeltAt + minGapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGdeltAt = Date.now();
}

function sanitizeQuery(q: string): string {
  const cleaned = q.replace(/["“”]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  return words.map((w) => (/^[一-鿿]/.test(w) ? w : `"${w}"`)).join(" ");
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSeenDate(s: string): string {
  if (!s || s.length < 14) return new Date().toISOString();
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function gdeltRequest(params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ format: "json", ...params }).toString();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await gdeltThrottle();
    try {
      const res = await fetch(`${GDELT}?${qs}`, { signal: AbortSignal.timeout(20000) });
      if (res.status === 429) {
        lastError = new Error("GDELT 限流（429）");
        await new Promise((r) => setTimeout(r, 6000));
        continue;
      }
      if (!res.ok) throw new Error(`GDELT HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
        throw new Error("GDELT 返回非 JSON（无结果或限流）");
      }
      return JSON.parse(text);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastError ?? new Error("GDELT 请求失败");
}

async function searchGdelt(query: string, timespan: string, lang: string, maxRecords = "75") {
  const fullQuery = lang && lang !== "all" ? `${query} sourcelang:${lang}` : query;
  const base = { query: fullQuery, timespan };
  const artData = await gdeltRequest({ ...base, mode: "artlist", maxrecords: maxRecords, sort: "hybridrel" });
  let domData: unknown = null;
  try {
    domData = await gdeltRequest({ ...base, mode: "domainvol", maxrecords: "12" });
  } catch {
    /* coverage stats are nice-to-have */
  }

  const articles: IntelArticle[] = [];
  const list = (artData as { articles?: Record<string, unknown>[] })?.articles ?? [];
  for (const a of list) {
    const url = String(a["url"] ?? "");
    const title = stripTags(String(a["title"] ?? "")).trim();
    if (!url || !title) continue;
    articles.push({
      url,
      title,
      seenAt: parseSeenDate(String(a["seendate"] ?? "")),
      domain: String(a["domain"] ?? new URL(url).hostname),
      language: String(a["language"] ?? ""),
      sourceCountry: String(a["sourcecountry"] ?? ""),
      engine: "gdelt",
    });
  }

  const domains: { domain: string; count: number }[] = [];
  const dv = (domData as { domains?: unknown } | null)?.domains;
  if (Array.isArray(dv)) {
    for (const d of dv as Record<string, unknown>[]) {
      domains.push({ domain: String(d["domain"] ?? ""), count: Number(d["count"] ?? 0) });
    }
  } else if (dv && typeof dv === "object") {
    for (const [domain, count] of Object.entries(dv as Record<string, number>)) {
      domains.push({ domain, count: Number(count) });
    }
  }
  return { articles, domains };
}

// ── Hacker News Algolia (CORS-open) ──────────────────────────────────────
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function searchHn(rawQuery: string): Promise<IntelArticle[]> {
  const qs = new URLSearchParams({ query: rawQuery, tags: "story", hitsPerPage: "20" }).toString();
  const res = await fetch(`https://hn.algolia.com/api/v1/search?${qs}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HN HTTP ${res.status}`);
  const data = (await res.json()) as {
    hits?: { title?: string; url?: string; created_at_i?: number; points?: number; objectID?: string }[];
  };
  const articles: IntelArticle[] = [];
  for (const h of data.hits ?? []) {
    const title = (h.title ?? "").trim();
    const url = h.url ?? "";
    if (!title) continue;
    articles.push({
      url: url || `https://news.ycombinator.com/item?id=${h.objectID ?? ""}`,
      title,
      seenAt: h.created_at_i ? new Date(h.created_at_i * 1000).toISOString() : new Date().toISOString(),
      domain: domainOf(url) || "news.ycombinator.com",
      language: "english",
      sourceCountry: "",
      engine: "hn",
      snippet: h.points != null ? `${h.points} points on Hacker News` : "",
    });
  }
  return articles;
}

/** Engines that only the local Node backend can run (HTML scraping). */
const SCRAPER_UNAVAILABLE: EngineStatus[] = [
  { engine: "google", status: "error", detail: "公开分享版运行于浏览器环境，该引擎仅在本地服务版可用" },
  { engine: "yandex", status: "error", detail: "公开分享版运行于浏览器环境，该引擎仅在本地服务版可用" },
  { engine: "bing", status: "error", detail: "公开分享版运行于浏览器环境，该引擎仅在本地服务版可用" },
];

// ── intel (议题验证台) ──────────────────────────────────────────────────
export async function fetchIntelBrowser(q: string, timespan: string, lang: string, refresh = false): Promise<IntelResponse> {
  const key = `tt:intel:${q}::${timespan}::${lang}`;
  if (!refresh) {
    const hit = lsGet<IntelResponse>(key);
    if (hit && Date.now() - hit.at < 3 * 60 * 1000) return hit.data;
  }

  const engines: EngineStatus[] = [];
  let articles: IntelArticle[] = [];
  let domains: { domain: string; count: number }[] = [];

  try {
    const g = await searchGdelt(sanitizeQuery(q), timespan, lang);
    articles = g.articles;
    domains = g.domains;
    engines.push({ engine: "gdelt", status: "ok", detail: `${g.articles.length} 条` });
  } catch (e) {
    engines.push({ engine: "gdelt", status: "error", detail: e instanceof Error ? e.message : String(e) });
  }

  engines.push(...SCRAPER_UNAVAILABLE);

  try {
    const hn = await searchHn(q.trim());
    articles = [...articles, ...hn];
    engines.push({ engine: "hn", status: "ok", detail: `${hn.length} 条` });
  } catch (e) {
    engines.push({ engine: "hn", status: "error", detail: e instanceof Error ? e.message : String(e) });
  }

  const result: IntelResponse = {
    ok: articles.length > 0,
    query: q,
    timespan,
    articles,
    domains,
    engines,
    fetchedAt: new Date().toISOString(),
    error: articles.length ? undefined : "所有可用引擎均无结果（GDELT 可能正限流，请稍后重试）",
  };
  if (articles.length) lsSet(key, result);
  return result;
}

// ── web-wide supplementary search (报告流关键词协同检索) ───────────────
export async function fetchWebSearchBrowser(q: string, refresh = false): Promise<WebSearchResponse> {
  const key = `tt:web:${q}`;
  if (!refresh) {
    const hit = lsGet<WebSearchResponse>(key);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return { ...hit.data, cached: true };
  }

  const engines: EngineStatus[] = [];
  let articles: IntelArticle[] = [];

  try {
    const g = await searchGdelt(sanitizeQuery(q), "1w", "all", "40");
    articles = g.articles;
    engines.push({ engine: "gdelt", status: "ok", detail: `${g.articles.length} 条` });
  } catch (e) {
    engines.push({ engine: "gdelt", status: "error", detail: e instanceof Error ? e.message : String(e) });
  }

  engines.push(...SCRAPER_UNAVAILABLE);

  try {
    const hn = await searchHn(q.trim());
    articles = [...articles, ...hn];
    engines.push({ engine: "hn", status: "ok", detail: `${hn.length} 条` });
  } catch (e) {
    engines.push({ engine: "hn", status: "error", detail: e instanceof Error ? e.message : String(e) });
  }

  const data: WebSearchResponse = {
    ok: articles.length > 0,
    query: q,
    articles,
    engines,
    fetchedAt: new Date().toISOString(),
    cached: false,
    error: articles.length ? undefined : "可用引擎均无结果（GDELT 可能正限流，请稍后重试）",
  };
  if (articles.length) lsSet(key, data);
  return data;
}

// ── trending (公开热榜) ─────────────────────────────────────────────────
const TRENDING_CHANNELS: { id: string; label: string }[] = [
  { id: "hackernews", label: "Hacker News" },
  { id: "github-trending", label: "GitHub Trending" },
  { id: "zhihu", label: "知乎热榜" },
  { id: "36kr", label: "36氪" },
  { id: "weibo", label: "微博热搜" },
  { id: "thepaper", label: "澎湃新闻" },
];
const TRENDING_INSTANCE = "https://newsnow.busiyi.world";

export async function fetchTrendingBrowser(): Promise<TrendingResponse> {
  const key = "tt:trending";
  const hit = lsGet<TrendingResponse>(key);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.data;

  const items: TrendingItem[] = [];
  const sources: { id: string; label: string; ok: boolean }[] = [];

  await runPool(TRENDING_CHANNELS, 3, async (ch) => {
    try {
      const text = await fetchText(`${TRENDING_INSTANCE}/api/s?id=${ch.id}`, 12000);
      const data = JSON.parse(text) as {
        status?: string;
        items?: { title?: string; url?: string; pubDate?: string; extra?: { info?: string } }[];
      };
      if (data.status !== "success" || !Array.isArray(data.items)) throw new Error("bad payload");
      items.push(
        ...data.items
          .filter((it) => it.title && it.url)
          .slice(0, 8)
          .map((it) => ({
            title: String(it.title),
            url: String(it.url),
            pubDate: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
            info: String(it.extra?.info ?? ""),
            source: ch.id,
            sourceLabel: ch.label,
          }))
      );
      sources.push({ id: ch.id, label: ch.label, ok: true });
    } catch {
      sources.push({ id: ch.id, label: ch.label, ok: false });
    }
  });

  const data: TrendingResponse = {
    ok: sources.some((s) => s.ok),
    items: items.sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate)).slice(0, 60),
    sources,
    fetchedAt: new Date().toISOString(),
  };
  lsSet(key, data);
  return data;
}
