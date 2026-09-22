import { useEffect, useState } from "react";
import { fetchFeeds, isShareMode } from "@/lib/api";
import Masthead from "@/components/Masthead";
import Ticker from "@/components/Ticker";
import ReportsView from "@/components/ReportsView";
import IntelView from "@/components/IntelView";
import type { ReportItem } from "@/types";

function readHash(): "reports" | "intel" {
  return window.location.hash === "#intel" ? "intel" : "reports";
}

export default function Home() {
  const [tab, setTab] = useState<"reports" | "intel">(readHash);
  const [tickerItems, setTickerItems] = useState<ReportItem[]>([]);
  const [share, setShare] = useState(false);

  useEffect(() => {
    isShareMode().then(setShare);
  }, []);

  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetchFeeds("all")
      .then((d) => setTickerItems(d.items.slice(0, 18)))
      .catch(() => setTickerItems([]));
  }, []);

  const changeTab = (t: "reports" | "intel") => {
    setTab(t);
    window.location.hash = t === "intel" ? "#intel" : "#reports";
  };

  return (
    <div className="min-h-screen">
      <Masthead tab={tab} onTabChange={changeTab} />
      {tab === "reports" && <Ticker items={tickerItems} />}
      <main>{tab === "reports" ? <ReportsView /> : <IntelView />}</main>
      <footer className="hairline-t mt-10 px-4 sm:px-8 py-6 flex flex-col sm:flex-row gap-2 items-baseline justify-between">
        <span className="caps font-mono2 text-[10px] text-muted-foreground">
          ThinkTank Radar · 智库雷达
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          报告流来自全球 45+ 家智库、研究机构与行业分析媒体的官方 RSS · 新闻检索由 GDELT / Google / Yandex / 必应 / Hacker News 多引擎协同驱动 ·
          交叉验证基于独立信源聚合算法，仅供参考；部分国际源在当前网络环境下可能不可达，恢复后自动收录
          {share && (
            <span className="text-primary/80"> · 当前为公开分享版：数据由浏览器实时直连抓取，Google / Yandex / 必应网页检索仅在本地服务版可用</span>
          )}
        </span>
      </footer>
    </div>
  );
}
