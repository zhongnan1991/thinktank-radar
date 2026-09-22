// Multi-engine global news search:
//   A. GDELT DOC 2.0     — primary; multilingual, rich source metadata (ideal for cross-validation)
//   B. Google / Yandex   — web search scrapers; activate on networks where they are reachable
//   C. Bing web search   — fallback / augmentation, keyless
//   D. Hacker News Algolia — tech-community discussion layer (always on, keyless)
// The response carries per-engine status so the UI can show provenance honestly.

export type EngineId = "gdelt" | "google" | "yandex" | "bing" | "hn";

export interface IntelArticle {
  url: string;
  title: string;
  seenAt: string; // ISO
  domain: string;
  language: string;
  sourceCountry: string;
  engine: EngineId;
  snippet?: string;
}

export interface EngineStatus {
  engine: EngineId;
  status: "ok" | "error";
  detail?: string;
}

export interface IntelResponse {
  ok: boolean;
  query: string;
  timespan: string;
  articles: IntelArticle[];
  domains: { domain: string; count: number }[];
  engines: EngineStatus[];
  fetchedAt: string;
  error?: string;
}

const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const TIMESPANS: Record<string, string> = {
  "24h": "过去 24 小时",
  "3d": "过去 3 天",
  "1w": "过去 1 周",
  "2w": "过去 2 周",
  "1m": "过去 1 个月",
};

/** GDELT rejects unbalanced quotes — neutralise them. */
function sanitizeQuery(q: string): string {
  const cleaned = q.replace(/["“”]/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  return words
    .map((w) => (/^[\u4e00-\u9fff]/.test(w) ? w : `"${w}"`))
    .join(" ");
}

// GDELT enforces ~1 request / 5 s per IP — serialise and back off on 429.
let lastRequestAt = 0;
async function throttle(minGapMs = 5300) {
  const wait = lastRequestAt + minGapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
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

// ── Engine A: GDELT ──────────────────────────────────────────────────────
async function gdeltRequest(params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ format: "json", ...params }).toString();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await throttle();
    try {
      const res = await fetch(`${GDELT}?${qs}`, {
        signal: AbortSignal.timeout(20000),
        headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      });
      if (res.status === 429) {
        lastError = new Error("GDELT 对该出口 IP 限流（429）");
        await new Promise((r) => setTimeout(r, 6000));
        continue;
      }
      if (!res.ok) throw new Error(`GDELT HTTP ${res.status}`);
      const text = await res.text();
      const trimmed = text.trimStart();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        throw new Error("GDELT 返回了非 JSON 内容（无结果或被限流）");
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("GDELT 返回了畸形 JSON");
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastError ?? new Error("GDELT 请求失败");
}

async function searchGdelt(query: string, timespan: string, lang: string) {
  const fullQuery = lang && lang !== "all" ? `${query} sourcelang:${lang}` : query;
  const base = { query: fullQuery, timespan };
  const artData = await gdeltRequest({ ...base, mode: "artlist", maxrecords: "75", sort: "hybridrel" });
  let domData: unknown = null;
  try {
    domData = await gdeltRequest({ ...base, mode: "domainvol", maxrecords: "12" });
  } catch { /* coverage stats are nice-to-have */ }

  const articles: IntelArticle[] = [];
  const list = (artData as { articles?: Record<string, unknown>[] })?.articles ?? [];
  for (const a of list) {
    const url = String(a["url"] ?? "");
    const title = String(a["title"] ?? "").trim();
    if (!url || !title) continue;
    articles.push({
      url, title,
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

// ── Engine B: Bing web search (HTML scrape, keyless) ─────────────────────
function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function searchBing(rawQuery: string): Promise<IntelArticle[]> {
  const qs = new URLSearchParams({ q: rawQuery, setlang: "zh-hans", count: "30" }).toString();
  await throttle(1500);
  const res = await fetch(`https://cn.bing.com/search?${qs}`, {
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes("b_algo")) throw new Error("Bing 返回了非结果页（可能被拦截）");

  const articles: IntelArticle[] = [];
  const blocks = html.split('<li class="b_algo"').slice(1);
  for (const block of blocks) {
    const mLink = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!mLink) continue;
    const url = mLink[1];
    const title = stripTags(mLink[2]);
    if (!url.startsWith("http") || !title) continue;
    const snippetMatch = block.match(/<div class="b_caption"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
    articles.push({
      url, title,
      seenAt: new Date().toISOString(),
      domain: domainOf(url),
      language: "",
      sourceCountry: "",
      engine: "bing",
      snippet: snippetMatch ? stripTags(snippetMatch[1]).slice(0, 240) : "",
    });
    if (articles.length >= 30) break;
  }
  if (!articles.length) throw new Error("Bing 结果页解析为空");
  return articles;
}

// ── Engine B2: Google web search (HTML scrape, keyless) ──────────────────
async function searchGoogle(rawQuery: string): Promise<IntelArticle[]> {
  const qs = new URLSearchParams({ q: rawQuery, num: "20", hl: "zh-CN" }).toString();
  await throttle(1500);
  const res = await fetch(`https://www.google.com/search?${qs}`, {
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const html = await res.text();
  if (/consent\.google|unusual traffic|recaptcha/i.test(html)) {
    throw new Error("Google 要求人机验证（当前网络环境不可用）");
  }
  const articles: IntelArticle[] = [];
  // modern result markup: <a href="URL" ...><h3 ...>Title</h3>
  const re = /<a href="(https?:\/\/[^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && articles.length < 20) {
    const url = m[1];
    const title = stripTags(m[2]);
    const host = domainOf(url);
    if (!title || !host || host.endsWith("google.com")) continue;
    articles.push({
      url, title,
      seenAt: new Date().toISOString(),
      domain: host,
      language: "",
      sourceCountry: "",
      engine: "google",
    });
  }
  if (!articles.length) throw new Error("Google 结果页解析为空（当前网络可能无法访问）");
  return articles;
}

// ── Engine B3: Yandex web search (HTML scrape, keyless) ──────────────────
async function searchYandex(rawQuery: string): Promise<IntelArticle[]> {
  const qs = new URLSearchParams({ text: rawQuery, lang: "en" }).toString();
  await throttle(1500);
  const res = await fetch(`https://yandex.com/search/?${qs}`, {
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Yandex HTTP ${res.status}`);
  const html = await res.text();
  if (/showcaptchafast|Верификация|smartcaptcha/i.test(html)) {
    throw new Error("Yandex 触发了人机验证（当前网络环境不可用）");
  }
  const articles: IntelArticle[] = [];
  const blocks = html.split('serp-item').slice(1);
  for (const block of blocks) {
    const mLink = block.match(/href="(https?:\/\/[^"]+)"[^>]*>(?:\s*<[^>]+>)*\s*([^<]{8,200})<\/a>/);
    if (!mLink) continue;
    const url = mLink[1];
    const title = mLink[2].trim();
    const host = domainOf(url);
    if (!title || !host || host.includes("yandex.")) continue;
    articles.push({
      url, title,
      seenAt: new Date().toISOString(),
      domain: host,
      language: "",
      sourceCountry: "",
      engine: "yandex",
    });
    if (articles.length >= 20) break;
  }
  if (!articles.length) throw new Error("Yandex 结果页解析为空（当前网络可能无法访问）");
  return articles;
}

/** Run the three web-search engines (Google / Yandex / Bing) independently. */
export async function searchWebEngines(rawQuery: string): Promise<{ articles: IntelArticle[]; engines: EngineStatus[] }> {
  const engines: EngineStatus[] = [];
  const articles: IntelArticle[] = [];
  const runners: { id: EngineId; run: () => Promise<IntelArticle[]> }[] = [
    { id: "google", run: () => searchGoogle(rawQuery) },
    { id: "yandex", run: () => searchYandex(rawQuery) },
    { id: "bing", run: () => searchBing(rawQuery) },
  ];
  const results = await Promise.allSettled(runners.map((r) => r.run()));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      articles.push(...r.value);
      engines.push({ engine: runners[i].id, status: "ok", detail: `${r.value.length} 条` });
    } else {
      engines.push({
        engine: runners[i].id,
        status: "error",
        detail: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  return { articles, engines };
}

// ── Engine C: Hacker News Algolia ────────────────────────────────────────
async function searchHn(rawQuery: string): Promise<IntelArticle[]> {
  const qs = new URLSearchParams({ query: rawQuery, tags: "story", hitsPerPage: "20" }).toString();
  const res = await fetch(`https://hn.algolia.com/api/v1/search?${qs}`, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!res.ok) throw new Error(`HN HTTP ${res.status}`);
  const data = (await res.json()) as { hits?: { title?: string; url?: string; created_at_i?: number; points?: number }[] };
  const articles: IntelArticle[] = [];
  for (const h of data.hits ?? []) {
    const title = (h.title ?? "").trim();
    const url = h.url ?? "";
    if (!title) continue;
    articles.push({
      url: url || `https://news.ycombinator.com/item?id=${(h as { objectID?: string }).objectID ?? ""}`,
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

// short-lived result cache (3 min)
const cache = new Map<string, { at: number; data: IntelResponse }>();
const CACHE_TTL = 3 * 60 * 1000;

export async function searchIntel(rawQuery: string, timespan: string, lang: string, refresh = false): Promise<IntelResponse> {
  const query = sanitizeQuery(rawQuery);
  const span = TIMESPANS[timespan] ? timespan : "1w";
  const cacheKey = `${query}::${span}::${lang}`;
  const hit = cache.get(cacheKey);
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL) return { ...hit.data, fetchedAt: hit.data.fetchedAt };

  const empty: IntelResponse = {
    ok: false, query: rawQuery, timespan: span, articles: [], domains: [],
    engines: [], fetchedAt: new Date().toISOString(),
  };

  const engines: EngineStatus[] = [];
  let gdeltArticles: IntelArticle[] = [];
  let domains: { domain: string; count: number }[] = [];

  // Engine A first — best metadata for cross-validation
  try {
    const g = await searchGdelt(query, span, lang);
    gdeltArticles = g.articles;
    domains = g.domains;
    engines.push({ engine: "gdelt", status: "ok", detail: `${g.articles.length} 条` });
  } catch (e) {
    engines.push({ engine: "gdelt", status: "error", detail: e instanceof Error ? e.message : String(e) });
  }

  const articles: IntelArticle[] = [...gdeltArticles];

  // Engines B: Google + Yandex + Bing (independent, status reported honestly)
  try {
    const web = await searchWebEngines(rawQuery.trim());
    articles.push(...web.articles);
    engines.push(...web.engines);
  } catch (e) {
    engines.push({ engine: "bing", status: "error", detail: e instanceof Error ? e.message : String(e) });
  }

  // Engine C — cheap, keyless, always attempted (adds a discussion layer)
  try {
    const hn = await searchHn(rawQuery.trim());
    articles.push(...hn);
    engines.push({ engine: "hn", status: "ok", detail: `${hn.length} 条` });
  } catch (e) {
    engines.push({ engine: "hn", status: "error", detail: e instanceof Error ? e.message : String(e) });
  }

  if (!articles.length) {
    const worst = engines.find((e) => e.status === "error");
    return { ...empty, engines, error: worst?.detail ?? "所有检索引擎均无结果" };
  }

  const result: IntelResponse = {
    ok: true, query: rawQuery, timespan: span, articles, domains, engines,
    fetchedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}
