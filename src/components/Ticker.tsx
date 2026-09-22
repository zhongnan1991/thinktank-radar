import type { ReportItem } from "@/types";

/** Newsroom headline ticker — pauses on hover. */
export default function Ticker({ items }: { items: ReportItem[] }) {
  if (!items.length) return null;
  const top = items.slice(0, 18);
  const loop = [...top, ...top];
  return (
    <div className="hairline-b bg-secondary/40 overflow-hidden" aria-label="最新头条滚动条">
      <div className="ticker-track py-1.5">
        {loop.map((it, i) => (
          <a
            key={`${it.id}-${i}`}
            href={it.link}
            target="_blank"
            rel="noreferrer"
            className="mx-6 whitespace-nowrap text-[12px] text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="caps font-mono2 text-[10px] text-primary/70 mr-2">{it.org}</span>
            <span className="font-ui">{it.title}</span>
            <span className="mx-4 text-border">✦</span>
          </a>
        ))}
      </div>
    </div>
  );
}
