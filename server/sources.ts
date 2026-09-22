// Curated global think-tank / research-institute / multilateral RSS sources.
// Every source is fetched with failure tolerance: unreachable feeds are
// reported in `sources` meta and simply contribute no items, so the stream
// degrades gracefully across different network environments.

export type Category = "geo" | "security" | "tech" | "macro" | "energy";

export const CATEGORY_LABELS: Record<Category, string> = {
  geo: "地缘经济",
  security: "安全与外交",
  tech: "科技与产业",
  macro: "宏观与金融",
  energy: "能源与气候",
};

export interface FeedSource {
  id: string;
  org: string;
  feed: string; // feed flavour, e.g. "Analysis" / "All research"
  category: Category;
  url: string;
  lang: "en" | "zh" | "multi";
}

export const FEED_SOURCES: FeedSource[] = [
  // ── 地缘经济 Geoeconomics ─────────────────────────────────────────────
  { id: "bruegel", org: "Bruegel", feed: "Publications", category: "geo", url: "https://www.bruegel.org/rss.xml", lang: "en" },
  { id: "chatham", org: "Chatham House", feed: "Research & Analysis", category: "geo", url: "https://www.chathamhouse.org/rss.xml", lang: "en" },
  { id: "ecfr", org: "ECFR", feed: "Latest", category: "geo", url: "https://ecfr.eu/feed/", lang: "en" },
  { id: "atlantic", org: "Atlantic Council", feed: "Research & Commentary", category: "geo", url: "https://www.atlanticcouncil.org/feed/", lang: "en" },
  { id: "brookings", org: "Brookings", feed: "All research", category: "geo", url: "https://www.brookings.edu/feed/", lang: "en" },
  { id: "csis", org: "CSIS", feed: "Analysis", category: "geo", url: "https://www.csis.org/rss.xml", lang: "en" },
  { id: "cfr", org: "CFR", feed: "All content", category: "geo", url: "https://www.cfr.org/rss.xml", lang: "en" },
  { id: "lowy", org: "Lowy Institute", feed: "Analysis", category: "geo", url: "https://www.lowyinstitute.org/rss.xml", lang: "en" },
  { id: "eaf", org: "East Asia Forum", feed: "Latest", category: "geo", url: "https://www.eastasiaforum.org/feed/", lang: "en" },
  { id: "merics", org: "MERICS", feed: "Analysis", category: "geo", url: "https://merics.org/en/rss.xml", lang: "en" },
  { id: "cigi", org: "CIGI", feed: "Publications", category: "geo", url: "https://www.cigionline.org/rss.xml", lang: "en" },

  // ── 安全与外交 Security & Foreign Affairs ────────────────────────────
  { id: "stimson", org: "Stimson Center", feed: "All content", category: "security", url: "https://www.stimson.org/feed/", lang: "en" },
  { id: "respstate", org: "Responsible Statecraft", feed: "All content", category: "security", url: "https://responsiblestatecraft.org/feed/", lang: "en" },
  { id: "unnews", org: "联合国新闻", feed: "UN News", category: "security", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", lang: "en" },
  { id: "crisisgroup", org: "International Crisis Group", feed: "All content", category: "security", url: "https://www.crisisgroup.org/rss", lang: "en" },
  { id: "mwi", org: "Modern War Institute", feed: "All content", category: "security", url: "https://mwi.westpoint.edu/feed/", lang: "en" },
  { id: "foreignaffairs", org: "Foreign Affairs", feed: "Latest", category: "security", url: "https://www.foreignaffairs.com/rss.xml", lang: "en" },
  { id: "foreignpolicy", org: "Foreign Policy", feed: "Latest", category: "security", url: "https://foreignpolicy.com/feed/", lang: "en" },
  { id: "wotr", org: "War on the Rocks", feed: "Essays", category: "security", url: "https://warontherocks.com/feed/", lang: "en" },
  { id: "lawfare", org: "Lawfare", feed: "All content", category: "security", url: "https://www.lawfaremedia.org/rss.xml", lang: "en" },
  { id: "sipri", org: "SIPRI", feed: "News & Insights", category: "security", url: "https://www.sipri.org/rss.xml", lang: "en" },
  { id: "iiss", org: "IISS", feed: "Analysis", category: "security", url: "https://www.iiss.org/rss/", lang: "en" },

  // ── 科技与产业 Technology & Industry ─────────────────────────────────
  { id: "itif", org: "ITIF", feed: "Publications", category: "tech", url: "https://itif.org/feed/", lang: "en" },
  { id: "cset", org: "CSET Georgetown", feed: "All content", category: "tech", url: "https://cset.georgetown.edu/feed/", lang: "en" },
  { id: "cnas", org: "CNAS", feed: "Reports & Commentary", category: "tech", url: "https://www.cnas.org/rss.xml", lang: "en" },
  { id: "datasociety", org: "Data & Society", feed: "Latest", category: "tech", url: "https://datasociety.net/feed/", lang: "en" },

  // ── 宏观与金融 Macro & Finance ───────────────────────────────────────
  { id: "voxeu", org: "VoxEU / CEPR", feed: "Columns", category: "macro", url: "https://voxeu.org/rss.xml", lang: "en" },
  { id: "nber", org: "NBER", feed: "New working papers", category: "macro", url: "https://www.nber.org/rss/new.xml", lang: "en" },
  { id: "fed", org: "Federal Reserve", feed: "Press releases", category: "macro", url: "https://www.federalreserve.gov/feeds/press_all.xml", lang: "en" },
  { id: "bis", org: "BIS", feed: "All BIS", category: "macro", url: "https://www.bis.org/rss.xml", lang: "en" },
  { id: "ecb", org: "ECB", feed: "Press releases", category: "macro", url: "https://www.ecb.europa.eu/rss/press.html", lang: "en" },
  { id: "omfif", org: "OMFIF", feed: "All content", category: "macro", url: "https://www.omfif.org/feed/", lang: "en" },
  { id: "epi", org: "Economic Policy Institute", feed: "All content", category: "macro", url: "https://www.epi.org/feed/", lang: "en" },
  { id: "libertystreet", org: "Liberty Street Economics", feed: "NY Fed blog", category: "macro", url: "https://libertystreeteconomics.newyorkfed.org/rss/", lang: "en" },
  { id: "fredblog", org: "FRED Blog", feed: "St. Louis Fed", category: "macro", url: "https://fredblog.stlouisfed.org/feed/", lang: "en" },
  { id: "bankunderground", org: "Bank Underground", feed: "BoE blog", category: "macro", url: "https://bankunderground.co.uk/feed", lang: "en" },
  { id: "econofact", org: "EconoFact", feed: "All content", category: "macro", url: "https://econofact.org/feed", lang: "en" },
  { id: "promarket", org: "ProMarket", feed: "Stigler Center", category: "macro", url: "https://www.promarket.org/feed/", lang: "en" },
  { id: "piie", org: "PIIE", feed: "All content", category: "macro", url: "https://www.piie.com/rss.xml", lang: "en" },
  { id: "imf", org: "IMF Blog", feed: "Blog", category: "macro", url: "https://blogs.imf.org/feed/", lang: "en" },
  { id: "ps", org: "Project Syndicate", feed: "Latest", category: "macro", url: "https://www.project-syndicate.org/rss", lang: "en" },

  // ── 能源与气候 Energy & Climate ──────────────────────────────────────
  { id: "carbonbrief", org: "Carbon Brief", feed: "All content", category: "energy", url: "https://www.carbonbrief.org/feed/", lang: "en" },
  { id: "rff", org: "Resources for the Future", feed: "All content", category: "energy", url: "https://www.rff.org/rss.xml", lang: "en" },
  { id: "oilprice", org: "OilPrice.com", feed: "Main", category: "energy", url: "https://www.oilprice.com/rss/main", lang: "en" },
  { id: "utilitydive", org: "Utility Dive", feed: "News", category: "energy", url: "https://www.utilitydive.com/feeds/news/", lang: "en" },
  { id: "canarymedia", org: "Canary Media", feed: "All content", category: "energy", url: "https://www.canarymedia.com/feed", lang: "en" },
  { id: "electrek", org: "Electrek", feed: "All content", category: "energy", url: "https://electrek.co/feed/", lang: "en" },

  // ── 行业深度分析媒体 Industry Analysis ────────────────────────────────
  { id: "arstechnica", org: "Ars Technica", feed: "All content", category: "tech", url: "https://feeds.arstechnica.com/arstechnica/index", lang: "en" },
  { id: "mittr", org: "MIT Tech Review", feed: "All content", category: "tech", url: "https://www.technologyreview.com/feed/", lang: "en" },
  { id: "semieng", org: "Semiconductor Engineering", feed: "All content", category: "tech", url: "https://semiengineering.com/feed/", lang: "en" },
  { id: "taskandpurpose", org: "Task & Purpose", feed: "All content", category: "security", url: "https://taskandpurpose.com/feed/", lang: "en" },
];
