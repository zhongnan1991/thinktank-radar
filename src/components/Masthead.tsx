import { useEffect, useState } from "react";
import { fmtClock, fmtDay } from "@/lib/format";

export default function Masthead({ tab, onTabChange }: { tab: "reports" | "intel"; onTabChange: (t: "reports" | "intel") => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dayOfYear = Math.floor((+now - +new Date(now.getFullYear(), 0, 0)) / 864e5);

  return (
    <header className="select-none">
      {/* utility line */}
      <div className="flex items-baseline justify-between hairline-b px-4 sm:px-8 py-1.5">
        <span className="caps font-mono2 text-[10px] text-muted-foreground">
          Global Thinktank &amp; Media Intelligence
        </span>
        <span className="font-mono2 text-[10px] text-muted-foreground tabular-nums hidden sm:block">
          {fmtDay(now)} · <span className="text-foreground">{fmtClock(now)}</span>
        </span>
        <span className="caps font-mono2 text-[10px] text-muted-foreground">
          No. {dayOfYear} · 实时监测
        </span>
      </div>

      {/* wordmark */}
      <div className="px-4 sm:px-8 pt-8 pb-6 text-center">
        <div className="caps font-mono2 text-[11px] tracking-[0.3em] text-primary mb-3">
          ThinkTank Radar · Est. 2026
        </div>
        <h1 className="font-display font-bold leading-none text-5xl sm:text-7xl tracking-tight">
          智库雷达
        </h1>
        <p className="mt-4 text-[13px] text-muted-foreground font-ui">
          汇总全球智库最新研究 · 检索权威媒体动态 · 交叉验证独立信源
        </p>
      </div>

      <div className="rule-double mx-4 sm:mx-8" />

      {/* nav */}
      <nav className="flex items-center justify-between px-4 sm:px-8">
        <div className="flex">
          {(
            [
              { id: "reports", label: "智库报告流" },
              { id: "intel", label: "议题验证台" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`relative px-5 py-3 text-[13px] font-medium tracking-wide transition-colors ${
                tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-4 bottom-0 h-[2px] bg-primary" />}
            </button>
          ))}
        </div>
        <span className="caps font-mono2 text-[10px] text-muted-foreground hidden md:block">
          Geopolitics · Technology · Macro &amp; Finance
        </span>
      </nav>
      <div className="hairline-b" />
    </header>
  );
}
