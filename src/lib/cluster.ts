import type { IntelArticle } from "@/types";

// ── text tokenisation (latin words + CJK bigrams/unigrams) ────────────────
const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "have", "has", "was", "were", "are",
  "will", "after", "over", "under", "into", "about", "their", "them", "they", "said", "says",
  "new", "news", "how", "why", "what", "when", "who", "its", "his", "her", "but", "not", "all",
  "can", "may", "thea", "you", "your", "more", "than", "then", "out", "our", "are", "been",
  "的", "了", "在", "是", "与", "和", "为", "对", "将", "被", "让", "向", "就", "都", "而", "及",
  "或", "等", "把", "这", "那", "有", "无", "不", "也", "还", "又", "之", "其", "于", "以",
  "一", "个", "上", "下", "中", "后", "前", "大", "小", "新", "旧", "最", "再", "该", "各",
]);

export function tokenize(title: string): Set<string> {
  const tokens = new Set<string>();
  const latin = title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  for (const w of latin) if (!STOP.has(w)) tokens.add(w);
  const cjkRuns = title.match(/[぀-ヿ一-鿿가-힯]+/g) ?? [];
  for (const run of cjkRuns) {
    for (let i = 0; i < run.length; i++) {
      const ch = run[i];
      if (!STOP.has(ch)) tokens.add(ch);
      if (i < run.length - 1) {
        const bigram = run.slice(i, i + 2);
        if (!STOP.has(bigram)) tokens.add(bigram);
      }
    }
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// ── clustering ────────────────────────────────────────────────────────────
export interface ArticleCluster {
  id: string;
  title: string; // medoid headline (majority framing)
  articles: IntelArticle[]; // sorted newest first
  domains: string[];
  countries: string[];
  languages: string[];
  firstSeen: string;
  lastSeen: string;
  hoursSpan: number;
  /** 0-100 independent-source validation strength */
  validation: number;
  tier: "confirmed" | "corroborated" | "emerging" | "single";
  variants: { title: string; count: number }[];
  gdeltOnly: boolean;
}

export const TIER_META: Record<ArticleCluster["tier"], { label: string; tone: "strong" | "mid" | "weak" | "warn" }> = {
  confirmed: { label: "多方印证", tone: "strong" },
  corroborated: { label: "多源报道", tone: "mid" },
  emerging: { label: "发展中", tone: "weak" },
  single: { label: "单一来源", tone: "warn" },
};

const SIM_THRESHOLD = 0.28;

export function clusterArticles(articles: IntelArticle[]): ArticleCluster[] {
  const sorted = [...articles].sort((a, b) => +new Date(b.seenAt) - +new Date(a.seenAt));
  const clusters: { members: IntelArticle[]; tokens: Set<string>[] }[] = [];

  for (const a of sorted) {
    const t = tokenize(a.title);
    let best: { idx: number; sim: number } = { idx: -1, sim: 0 };
    clusters.forEach((c, idx) => {
      // compare against up to 3 representatives
      const reps = c.tokens.slice(0, 3);
      for (const rt of reps) {
        const sim = jaccard(t, rt);
        if (sim > best.sim) best = { idx, sim };
      }
    });
    if (best.idx >= 0 && best.sim >= SIM_THRESHOLD) {
      clusters[best.idx].members.push(a);
      if (clusters[best.idx].tokens.length < 6) clusters[best.idx].tokens.push(t);
    } else {
      clusters.push({ members: [a], tokens: [t] });
    }
  }

  return clusters.map((c, i) => {
    const members = c.members;
    const domains = [...new Set(members.map((m) => m.domain).filter(Boolean))];
    const countries = [...new Set(members.map((m) => m.sourceCountry).filter(Boolean))];
    const languages = [...new Set(members.map((m) => m.language).filter(Boolean))];
    const times = members.map((m) => +new Date(m.seenAt)).sort((x, y) => x - y);
    const firstSeen = new Date(times[0]).toISOString();
    const lastSeen = new Date(times[times.length - 1]).toISOString();
    const hoursSpan = Math.max(0, (times[times.length - 1] - times[0]) / 36e5);

    // majority framing = most common normalised title; fallback to first
    const titleCounts = new Map<string, number>();
    for (const m of members) {
      const key = m.title.trim().toLowerCase().replace(/\s+/g, " ");
      titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
    }
    const variants = [...titleCounts.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
    const title = variants[0]?.title ?? members[0].title;

    const validation = Math.min(
      100,
      Math.round(
        domains.length * 13 +
          countries.length * 9 +
          Math.min(members.length, 12) * 3 +
          Math.min(languages.length, 3) * 4
      )
    );

    let tier: ArticleCluster["tier"];
    if (domains.length >= 5 || countries.length >= 3) tier = "confirmed";
    else if (domains.length >= 3) tier = "corroborated";
    else if (domains.length === 1) tier = "single";
    else tier = "emerging";

    return {
      id: `c${i}`,
      title,
      articles: members,
      domains,
      countries,
      languages,
      firstSeen,
      lastSeen,
      hoursSpan: Math.round(hoursSpan * 10) / 10,
      validation,
      tier,
      variants: variants.filter((v) => v.title !== title),
      gdeltOnly: members.every((m) => m.engine === "gdelt"),
    };
  }).sort((a, b) => b.validation - a.validation || b.articles.length - a.articles.length);
}
