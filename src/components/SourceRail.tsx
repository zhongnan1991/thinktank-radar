import type { SourceStatus, TrendingResponse } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { timeAgo } from "@/lib/format";

/** Right rail: source health monitor + global trending items. */
export default function SourceRail({
  sources,
  trending,
  fetchedAt,
  onRefresh,
  refreshing,
}: {
  sources: SourceStatus[];
  trending: TrendingResponse | null;
  fetchedAt: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const ok = sources.filter((s) => s.ok);
  return (
    <aside className="space-y-8">
      {/* source monitor */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="caps font-mono2 text-[11px] text-muted-foreground">源监测 · Source Watch</h3>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="caps font-mono2 text-[10px] text-primary hover:underline disabled:opacity-40"
          >
            {refreshing ? "刷新中…" : "强制刷新"}
          </button>
        </div>
        <div className="hairline-t pt-2">
          <p className="font-mono2 text-[11px] text-muted-foreground py-2">
            {ok.length}/{sources.length} 源在线 · 更新于 {timeAgo(fetchedAt)}
          </p>
          <ul className="max-h-[420px] overflow-y-auto pr-1">
            {sources.map((s) => (
              <li key={s.id} className="flex items-baseline gap-2 py-[5px] border-b border-border/50 last:border-0">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full translate-y-[-1px] shrink-0 ${
                    s.ok ? "bg-primary" : "bg-destructive/70"
                  }`}
                  title={s.ok ? "在线" : s.error}
                />
                <span className="text-[12px] font-medium truncate flex-1">{s.org}</span>
                <span className="caps font-mono2 text-[9px] text-muted-foreground shrink-0">
                  {CATEGORY_LABELS[s.category]}
                </span>
                <span className="font-mono2 text-[10px] text-muted-foreground tabular-nums shrink-0 w-10 text-right">
                  {s.ok ? `${s.count} 条` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* trending */}
      <section>
        <h3 className="caps font-mono2 text-[11px] text-muted-foreground mb-3">全球热点 · Trending</h3>
        <div className="hairline-t pt-1">
          {trending?.items.length ? (
            <ul>
              {trending.items.slice(0, 18).map((it, i) => (
                <li key={`${it.source}-${i}`} className="py-[6px] border-b border-border/50 last:border-0">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex gap-3 items-baseline"
                  >
                    <span className="font-mono2 text-[10px] text-muted-foreground tabular-nums w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[12.5px] leading-snug group-hover:text-primary transition-colors">
                      {it.title}
                    </span>
                    <span className="caps font-mono2 text-[9px] text-muted-foreground ml-auto shrink-0 hidden lg:block">
                      {it.sourceLabel}
                    </span>
                  </a>
                  {it.info && (
                    <span className="font-mono2 text-[10px] text-muted-foreground/70 pl-8">{it.info}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted-foreground py-3">
              {trending ? "热点源暂不可用" : "热点加载中…"}
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}
