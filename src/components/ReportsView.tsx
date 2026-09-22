import { useEffect, useMemo, useState } from "react";
import { fetchFeeds, fetchTrending, fetchWebSearch } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Category,
  type FeedsResponse,
  type TrendingResponse,
  type WebSearchResponse,
} from "@/types";
import SourceRail from "./SourceRail";

const AUTO_REFRESH_MS = 15 * 60 * 1000;

const WEB_ENGINE_LABELS: Record<string, string> = { google: "Google", yandex: "Yandex", bing: "必应" };

// 能源与气候子筛选：按来源机构细分
const ENERGY_SUBS: { id: string; label: string; orgIds: string[] }[] = [
  { id: "all", label: "全部能源", orgIds: [] },
  { id: "oil", label: "油气市场", orgIds: ["oilprice"] },
  { id: "clean", label: "清洁能源与电动化", orgIds: ["canarymedia", "electrek"] },
  { id: "climate", label: "气候政策与研究", orgIds: ["carbonbrief", "rff"] },
  { id: "utility", label: "公用事业", orgIds: ["utilitydive"] },
];

export default function ReportsView() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [energySub, setEnergySub] = useState("all");
  const [data, setData] = useState<FeedsResponse | null>(null);
  const [trending, setTrending] = useState<TrendingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [web, setWeb] = useState<WebSearchResponse | null>(null);
  const [webLoading, setWebLoading] = useState(false);

  const load = async (cat: Category | "all", refresh = false) => {
    try {
      setError(null);
      const d = await fetchFeeds(cat, refresh);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    const t = setInterval(() => load(category, true), AUTO_REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    fetchTrending().then(setTrending).catch(() => setTrending(null));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const item of data?.items ?? []) {
      c[item.category] = (c[item.category] ?? 0) + 1;
      c.all++;
    }
    return c;
    // count across current payload (category-filtered server side), so only "all" is meaningful
  }, [data]);

  const items = useMemo(() => {
    let all = data?.items ?? [];
    if (category === "energy" && energySub !== "all") {
      const sub = ENERGY_SUBS.find((s) => s.id === energySub);
      if (sub) all = all.filter((it) => sub.orgIds.includes(it.orgId));
    }
    const kw = keyword.trim().toLowerCase();
    if (!kw) return all;
    return all.filter(
      (it) =>
        it.title.toLowerCase().includes(kw) ||
        it.summary.toLowerCase().includes(kw) ||
        it.org.toLowerCase().includes(kw)
    );
  }, [data, keyword, category, energySub]);

  const runWebSearch = async (kw: string, refresh = false) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    setWebLoading(true);
    try {
      const r = await fetchWebSearch(trimmed, refresh);
      setWeb(r.ok ? r : null);
      if (!r.ok) setError(`协同检索未获得结果：${r.error ?? "无结果"}`);
    } catch (e) {
      setWeb(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWebLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 px-4 sm:px-8 py-8">
      <div>
        {/* category chips */}
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-2 mb-6">
          {(["all", ...CATEGORY_ORDER] as const).map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  setEnergySub("all");
                }}
                className={`px-3 py-1 text-[12.5px] font-medium border transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {c === "all" ? "全部" : CATEGORY_LABELS[c as Category]}
                {c === "all" && data ? (
                  <span className="font-mono2 text-[10px] ml-1.5 opacity-70">{counts.all}</span>
                ) : null}
              </button>
            );
          })}
          <span className="caps font-mono2 text-[10px] text-muted-foreground ml-auto">
            {loading ? "同步中…" : data ? `更新于 ${timeAgo(data.fetchedAt)}${data.cached ? " · 缓存" : ""}` : ""}
          </span>
        </div>

        {/* energy sub-filters */}
        {category === "energy" && (
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-2 mb-6 -mt-3">
            <span className="caps font-mono2 text-[9.5px] text-muted-foreground mr-1">子筛选</span>
            {ENERGY_SUBS.map((s) => {
              const active = energySub === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setEnergySub(s.id)}
                  className={`px-2.5 py-0.5 text-[11.5px] border transition-colors ${
                    active
                      ? "border-primary/70 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {/* keyword search + manual refresh */}
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runWebSearch(keyword);
            }}
            placeholder="输入关键词筛选已收录报告；按回车另启全网协同检索"
            className="flex-1 bg-transparent border border-border px-4 py-2.5 text-[13.5px] placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={() => runWebSearch(keyword, true)}
              disabled={webLoading || !keyword.trim()}
              className="border border-primary/50 text-primary px-4 py-2.5 text-[12.5px] font-medium hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-primary"
            >
              {webLoading ? "检索中…" : "全网协同检索"}
            </button>
            <button
              onClick={() => {
                setRefreshing(true);
                load(category, true);
              }}
              disabled={refreshing}
              className="bg-primary text-primary-foreground px-4 py-2.5 text-[12.5px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {refreshing ? "更新中…" : "↻ 手动更新"}
            </button>
          </div>
        </div>

        {/* web-wide supplementary results */}
        {web && (
          <section className="mb-8 border border-primary/30 bg-primary/[0.03]">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 border-b border-primary/20">
              <h3 className="caps font-mono2 text-[10px] text-primary">
                全网协同检索 · “{web.query}”
              </h3>
              <span className="caps font-mono2 text-[9.5px] text-muted-foreground">
                {web.engines
                  .map((e) => `${WEB_ENGINE_LABELS[e.engine] ?? e.engine} ${e.status === "ok" ? "✓" : "✗"}`)
                  .join(" · ")}
                <button
                  className="ml-3 text-primary hover:underline"
                  onClick={() => runWebSearch(web.query, true)}
                >
                  刷新
                </button>
                <button className="ml-2 text-muted-foreground hover:underline" onClick={() => setWeb(null)}>
                  关闭
                </button>
              </span>
            </div>
            <ul>
              {web.articles.slice(0, 15).map((a, i) => (
                <li key={`${a.url}-${i}`} className="border-b border-border/40 last:border-0">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-baseline gap-3 px-4 py-2.5 hover:bg-primary/[0.06] transition-colors"
                  >
                    <span className="caps font-mono2 text-[9px] text-primary/70 w-14 shrink-0">
                      {WEB_ENGINE_LABELS[a.engine] ?? a.engine}
                    </span>
                    <span className="text-[13px] font-medium leading-snug group-hover:text-primary transition-colors">
                      {a.title}
                    </span>
                    <span className="caps font-mono2 text-[9px] text-muted-foreground ml-auto shrink-0 hidden sm:block">
                      {a.domain}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <div className="border border-destructive/40 text-destructive text-[13px] px-4 py-3 mb-6">
            提示：{error}
            <button className="underline ml-3" onClick={() => { setError(null); load(category, true); }}>重试同步</button>
          </div>
        )}

        {/* report index list */}
        <div className="hairline-t">
          {loading && !items.length && (
            <div className="space-y-0">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="py-4 border-b border-border/60">
                  <div className="skeleton h-3 w-40 mb-2" />
                  <div className="skeleton h-5 w-3/4 mb-2" />
                  <div className="skeleton h-3 w-full" />
                </div>
              ))}
            </div>
          )}
          {!loading && !items.length && !error && (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              {keyword.trim()
                ? `没有匹配「${keyword.trim()}」的报告 — 可尝试上方「全网协同检索」。`
                : energySub !== "all"
                  ? "该子筛选下暂无条目 — 对应来源可能暂时不可达，试试「手动更新」。"
                  : "该分类暂无可用条目 — 可能是相关智库源暂时不可达。"}
            </p>
          )}
          {items.map((it, i) => (
            <a
              key={it.id}
              href={it.link}
              target="_blank"
              rel="noreferrer"
              className="report-row group grid grid-cols-[34px_1fr] gap-x-3 sm:gap-x-5 py-4 border-b border-border/60"
            >
              <span className="row-index font-mono2 text-[12px] text-muted-foreground pt-[3px] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-1.5">
                  <span className="caps font-mono2 text-[10px] font-medium text-primary">{it.org}</span>
                  <span className="caps font-mono2 text-[10px] text-muted-foreground">
                    {CATEGORY_LABELS[it.category]}
                  </span>
                  <span className="font-mono2 text-[10px] text-muted-foreground tabular-nums ml-auto">
                    {timeAgo(it.pubDate)}
                  </span>
                </span>
                <span className="font-display font-semibold text-[17px] sm:text-[19px] leading-snug group-hover:text-primary transition-colors">
                  {it.title}
                </span>
                {it.summary && (
                  <span className="block text-[13px] text-muted-foreground leading-relaxed clamp-2 mt-1.5">
                    {it.summary}
                  </span>
                )}
              </span>
            </a>
          ))}
        </div>
      </div>

      <SourceRail
        sources={data?.sources ?? []}
        trending={trending}
        fetchedAt={data?.fetchedAt ?? new Date().toISOString()}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          load(category, true);
        }}
      />
    </div>
  );
}
