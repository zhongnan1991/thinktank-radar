import { useMemo, useState } from "react";
import { fetchIntel } from "@/lib/api";
import { clusterArticles, TIER_META, type ArticleCluster } from "@/lib/cluster";
import { countryZh, fmtTime, langZh, timeAgo } from "@/lib/format";
import { LANG_OPTIONS, TIMESPAN_OPTIONS, type IntelResponse } from "@/types";
import { ChevronDown } from "lucide-react";

const EXAMPLES = ["红海航运危机", "AI 芯片出口管制", "日本央行加息", "Gaza ceasefire", "carbon border tax"];

const ENGINE_LABELS: Record<string, string> = {
  gdelt: "GDELT 全球媒体库",
  google: "Google",
  yandex: "Yandex",
  bing: "必应",
  hn: "Hacker News",
};

function TierBadge({ cluster }: { cluster: ArticleCluster }) {
  const meta = TIER_META[cluster.tier];
  const toneClass = {
    strong: "bg-primary text-primary-foreground",
    mid: "bg-primary/15 text-primary border border-primary/40",
    weak: "bg-transparent text-muted-foreground border border-border",
    warn: "bg-destructive/10 text-destructive border border-destructive/40",
  }[meta.tone];
  return (
    <span className={`inline-flex items-baseline gap-1.5 px-2 py-[3px] text-[11px] font-medium ${toneClass}`}>
      {cluster.tier === "single" ? "⚠" : "✓"}
      {meta.label}
      <span className="font-mono2 text-[10px] tabular-nums opacity-80">{cluster.validation}</span>
    </span>
  );
}

function ClusterCard({ cluster, defaultOpen }: { cluster: ArticleCluster; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const newest = cluster.articles[0];
  const outletCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of cluster.articles) m.set(a.domain, (m.get(a.domain) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [cluster]);

  return (
    <article className="border-b border-border/70 py-5">
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-start">
        <div>
          <a href={newest.url} target="_blank" rel="noreferrer" className="group block">
            <h3 className="font-display font-semibold text-[18px] sm:text-[20px] leading-snug group-hover:text-primary transition-colors">
              {cluster.title}
            </h3>
          </a>
          <p className="font-mono2 text-[11px] text-muted-foreground mt-1.5 tabular-nums">
            {cluster.articles.length} 条相关报道 · {cluster.domains.length} 家媒体
            {cluster.countries.length > 0 && <> · 覆盖 {cluster.countries.map(countryZh).filter(Boolean).slice(0, 4).join("、")}</>}
            {" · "}{timeAgo(cluster.lastSeen)}更新
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {outletCounts.slice(0, 5).map(([d]) => (
              <span key={d} className="caps font-mono2 text-[10px] text-primary/80">{d}</span>
            ))}
            {outletCounts.length > 5 && (
              <span className="font-mono2 text-[10px] text-muted-foreground">+{outletCounts.length - 5}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TierBadge cluster={cluster} />
          <button
            onClick={() => setOpen((o) => !o)}
            className="caps font-mono2 text-[10px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            交叉验证
            <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* expandable validation dossier */}
      <div className={`cluster-body ${open ? "open" : ""}`}>
        <div>
          <div className="mt-4 pt-4 border-t border-dashed border-border grid sm:grid-cols-2 gap-6">
            {/* coverage by outlet */}
            <div>
              <h4 className="caps font-mono2 text-[10px] text-muted-foreground mb-3">独立信源覆盖</h4>
              <ul className="space-y-[7px]">
                {outletCounts.map(([domain, n]) => {
                  const art = cluster.articles.find((a) => a.domain === domain)!;
                  return (
                    <li key={domain} className="flex items-baseline gap-2 text-[12px]">
                      <span className="text-primary/70 font-mono2 text-[10px] w-[74px] shrink-0 text-right tabular-nums">
                        {n} 条
                      </span>
                      <span className="h-[7px] bg-primary/75" style={{ width: `${Math.max(8, Math.min(100, (n / cluster.articles.length) * 200))}%` }} />
                      <a
                        href={art.url}
                        target="_blank"
                        rel="noreferrer"
                        className="caps font-mono2 text-[10.5px] text-foreground hover:text-primary truncate"
                        title={domain}
                      >
                        {domain}
                      </a>
                      <span className="text-muted-foreground text-[11px] shrink-0">
                        {art.sourceCountry ? countryZh(art.sourceCountry) : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* timeline + variants + notes */}
            <div className="space-y-4">
              <div>
                <h4 className="caps font-mono2 text-[10px] text-muted-foreground mb-2">报道时间线</h4>
                <p className="font-mono2 text-[11.5px] tabular-nums">
                  {fmtTime(cluster.firstSeen)} 首发 → {fmtTime(cluster.lastSeen)} 最新
                  <span className="text-muted-foreground ml-2">跨度 {cluster.hoursSpan < 24 ? `${Math.round(cluster.hoursSpan)} 小时` : `${Math.round(cluster.hoursSpan / 24)} 天`}</span>
                </p>
                {cluster.languages.length > 0 && (
                  <p className="text-[11.5px] text-muted-foreground mt-1">
                    语种：{cluster.languages.map(langZh).filter(Boolean).join("、")}
                  </p>
                )}
              </div>
              {cluster.variants.length > 0 && (
                <div>
                  <h4 className="caps font-mono2 text-[10px] text-muted-foreground mb-2">不同表述 / 关注点</h4>
                  <ul className="space-y-1.5">
                    {cluster.variants.map((v) => (
                      <li key={v.title} className="text-[12px] leading-snug text-muted-foreground">
                        · {v.title}
                        {v.count > 1 && <span className="font-mono2 text-[10px] ml-1">×{v.count}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cluster.tier === "single" && (
                <p className="text-[12px] leading-relaxed text-destructive/90 border-l-2 border-destructive/50 pl-3">
                  仅有一家媒体报道此事，尚未获得独立信源印证 — 建议谨慎采信，并关注后续是否有更多信源跟进。
                </p>
              )}
              {cluster.articles.some((a) => a.engine !== "gdelt") && (
                <p className="text-[11px] text-muted-foreground">
                  信源构成：{[...new Set(cluster.articles.map((a) => ENGINE_LABELS[a.engine]))].join(" + ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function IntelView() {
  const [q, setQ] = useState("");
  const [timespan, setTimespan] = useState("1w");
  const [lang, setLang] = useState("all");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<IntelResponse | null>(null);

  const clusters = useMemo(
    () => (result?.ok ? clusterArticles(result.articles) : []),
    [result]
  );

  const search = async (query: string, refresh = false) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setQ(trimmed);
    setState("loading");
    try {
      const data = await fetchIntel(trimmed, timespan, lang, refresh);
      setResult(data);
      setState(data.ok ? "done" : "error");
    } catch (e) {
      setResult({
        ok: false, query: trimmed, timespan, articles: [], domains: [], engines: [],
        fetchedAt: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      });
      setState("error");
    }
  };

  const allDomains = result?.ok ? new Set(result.articles.map((a) => a.domain)).size : 0;
  const allCountries = result?.ok
    ? new Set(result.articles.map((a) => a.sourceCountry).filter(Boolean)).size
    : 0;
  const allLangs = result?.ok
    ? new Set(result.articles.map((a) => a.language).filter(Boolean)).size
    : 0;

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      {/* search block */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
        className="mb-3"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入议题关键词，如：红海航运危机 / AI chip export controls"
            className="flex-1 bg-transparent border border-border px-4 py-3 font-display text-[17px] placeholder:text-muted-foreground/60 placeholder:font-ui placeholder:text-[13.5px] focus:outline-none focus:border-primary transition-colors"
          />
          <div className="flex gap-3">
            <select
              value={timespan}
              onChange={(e) => setTimespan(e.target.value)}
              className="bg-transparent border border-border px-3 py-3 text-[13px] focus:outline-none focus:border-primary cursor-pointer"
            >
              {TIMESPAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-transparent border border-border px-3 py-3 text-[13px] focus:outline-none focus:border-primary cursor-pointer"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={state === "loading"}
              className="bg-primary text-primary-foreground px-6 py-3 text-[13.5px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {state === "loading" ? "检索中…" : "检索验证"}
            </button>
          </div>
        </div>
      </form>
      <p className="text-[12px] text-muted-foreground mb-8">
        示例：
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => search(ex)}
            className="font-mono2 text-[11px] text-primary/80 hover:text-primary underline decoration-primary/30 underline-offset-4 mx-1.5"
          >
            {ex}
          </button>
        ))}
        <span className="ml-2 opacity-70">· 英文关键词覆盖更全；多引擎检索约需 10–25 秒</span>
      </p>

      {/* status */}
      {state === "loading" && (
        <div className="py-16 text-center">
          <p className="font-mono2 text-[12px] text-muted-foreground caps mb-4">正在多引擎交叉检索</p>
          <div className="space-y-2 max-w-md mx-auto">
            {[80, 60, 40, 70].map((w, i) => (
              <div key={i} className="skeleton h-3 mx-auto" style={{ width: `${w}%` }} />
            ))}
          </div>
          <p className="text-[12px] text-muted-foreground mt-4">
            GDELT 全球媒体库 → Google → Yandex → 必应 → Hacker News，结果按独立信源自动聚合…
          </p>
        </div>
      )}

      {state === "error" && result && (
        <div className="border border-destructive/40 text-destructive px-5 py-4 text-[13px]">
          检索失败：{result.error}
          <button className="underline ml-3" onClick={() => search(result.query)}>重试</button>
        </div>
      )}

      {state === "done" && result?.ok && (
        <>
          {/* summary strip */}
          <div className="hairline-t hairline-b py-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 mb-2">
            <span className="font-mono2 text-[12px] tabular-nums">
              <strong className="text-primary text-[16px]">{result.articles.length}</strong> 条报道
            </span>
            <span className="font-mono2 text-[12px] tabular-nums">
              <strong className="text-primary text-[16px]">{allDomains}</strong> 个独立信源
            </span>
            {allCountries > 0 && (
              <span className="font-mono2 text-[12px] tabular-nums">
                <strong className="text-primary text-[16px]">{allCountries}</strong> 个国家/地区
              </span>
            )}
            {allLangs > 0 && (
              <span className="font-mono2 text-[12px] tabular-nums">
                <strong className="text-primary text-[16px]">{allLangs}</strong> 种语言
              </span>
            )}
            <span className="caps font-mono2 text-[10px] text-muted-foreground ml-auto hidden md:inline">
              {result.engines
                .map((e) => `${ENGINE_LABELS[e.engine]} ${e.status === "ok" ? "✓" : "✗"}`)
                .join(" · ")}
            </span>
            <button
              onClick={() => search(result.query, true)}
              className="caps font-mono2 text-[10px] text-primary border border-primary/50 px-2.5 py-1 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              ↻ 手动更新
            </button>
          </div>
          <p className="caps font-mono2 text-[9.5px] text-muted-foreground/80 mt-2 md:hidden">
            {result.engines
              .map((e) => `${ENGINE_LABELS[e.engine]} ${e.status === "ok" ? "✓" : "✗"}`)
              .join(" · ")}
          </p>

          {clusters.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-muted-foreground">
              未找到相关报道，试试更换关键词、放宽时间范围或改用英文。
            </p>
          ) : (
            <div>
              <p className="caps font-mono2 text-[10px] text-muted-foreground py-3">
                按独立信源强度排序 · 点击「交叉验证」查看信源构成与时间线
              </p>
              {clusters.map((c, i) => (
                <ClusterCard key={c.id} cluster={c} defaultOpen={i === 0 && c.tier === "confirmed"} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
