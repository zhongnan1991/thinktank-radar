// Trending proxy — NewsNow public instance aggregates hot items from many
// preset sources. Tolerant per-source failure, cached 15 min.

export interface TrendingItem {
  title: string;
  url: string;
  pubDate: string;
  info: string;
  source: string;
  sourceLabel: string;
}

export interface TrendingResponse {
  ok: boolean;
  items: TrendingItem[];
  sources: { id: string; label: string; ok: boolean }[];
  fetchedAt: string;
}

const INSTANCE = "https://newsnow.busiyi.world";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const CHANNELS: { id: string; label: string }[] = [
  { id: "hackernews", label: "Hacker News" },
  { id: "github-trending", label: "GitHub Trending" },
  { id: "zhihu", label: "知乎热榜" },
  { id: "36kr", label: "36氪" },
  { id: "weibo", label: "微博热搜" },
  { id: "thepaper", label: "澎湃新闻" },
];

const cache = new Map<string, { at: number; data: TrendingResponse }>();
const CACHE_TTL = 15 * 60 * 1000;

export async function collectTrending(): Promise<TrendingResponse> {
  const hit = cache.get("all");
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  const results = await Promise.allSettled(
    CHANNELS.map(async (ch) => {
      const res = await fetch(`${INSTANCE}/api/s?id=${ch.id}`, {
        signal: AbortSignal.timeout(12000),
        headers: { "User-Agent": BROWSER_UA },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        status?: string;
        items?: { title?: string; url?: string; pubDate?: string; extra?: { info?: string } }[];
      };
      if (data.status !== "success" || !Array.isArray(data.items)) throw new Error("bad payload");
      return {
        ch,
        items: (data.items ?? [])
          .filter((it) => it.title && it.url)
          .slice(0, 8)
          .map((it) => ({
            title: String(it.title),
            url: String(it.url),
            pubDate: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
            info: String(it.extra?.info ?? ""),
            source: ch.id,
            sourceLabel: ch.label,
          })),
      };
    })
  );

  const items: TrendingItem[] = [];
  const sources: TrendingResponse["sources"] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      items.push(...r.value.items);
      sources.push({ id: r.value.ch.id, label: r.value.ch.label, ok: true });
    } else {
      const idx = results.indexOf(r);
      sources.push({ id: CHANNELS[idx]?.id ?? "", label: CHANNELS[idx]?.label ?? "", ok: false });
    }
  }
  items.sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate));

  const data: TrendingResponse = {
    ok: sources.some((s) => s.ok),
    items: items.slice(0, 60),
    sources,
    fetchedAt: new Date().toISOString(),
  };
  cache.set("all", { at: Date.now(), data });
  return data;
}
