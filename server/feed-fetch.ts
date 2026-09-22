import { XMLParser } from "fast-xml-parser";
import { FEED_SOURCES, type Category, type FeedSource } from "./sources";

export interface ReportItem {
  id: string;
  org: string;
  orgId: string;
  category: Category;
  title: string;
  link: string;
  summary: string;
  pubDate: string; // ISO
  lang: string;
}

export interface SourceStatus {
  id: string;
  org: string;
  category: Category;
  ok: boolean;
  count: number;
  ms: number;
  error?: string;
}

export interface FeedsResponse {
  items: ReportItem[];
  sources: SourceStatus[];
  fetchedAt: string;
  cached: boolean;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ["item", "entry", "link", "category"].includes(name),
});

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

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

async function fetchSource(source: FeedSource): Promise<{ status: SourceStatus; items: ReportItem[] }> {
  const t0 = Date.now();
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(14000),
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    if (!xml.trimStart().startsWith("<")) throw new Error("not an XML feed");
    const items = parseFeed(xml, source).slice(0, 12);
    if (!items.length) throw new Error("no items parsed");
    return {
      status: { id: source.id, org: source.org, category: source.category, ok: true, count: items.length, ms: Date.now() - t0 },
      items,
    };
  } catch (e) {
    return {
      status: {
        id: source.id, org: source.org, category: source.category, ok: false,
        count: 0, ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      },
      items: [],
    };
  }
}

// ── in-memory cache (10 min) ─────────────────────────────────────────────
const cache = new Map<string, { at: number; data: FeedsResponse }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function collectFeeds(category: Category | "all", refresh: boolean): Promise<FeedsResponse> {
  const key = category;
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL) {
    return { ...hit.data, cached: true };
  }
  const sources = FEED_SOURCES.filter((s) => category === "all" || s.category === category);
  const results = await Promise.all(sources.map(fetchSource));
  const items = results
    .flatMap((r) => r.items)
    .sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate))
    .slice(0, 160);
  const data: FeedsResponse = {
    items,
    sources: results.map((r) => r.status).sort((a, b) => Number(b.ok) - Number(a.ok) || a.org.localeCompare(b.org)),
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
