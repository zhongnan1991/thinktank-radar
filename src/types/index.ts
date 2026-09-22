export type Category = "geo" | "security" | "tech" | "macro" | "energy";

export interface ReportItem {
  id: string;
  org: string;
  orgId: string;
  category: Category;
  title: string;
  link: string;
  summary: string;
  pubDate: string;
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

export interface IntelArticle {
  url: string;
  title: string;
  seenAt: string;
  domain: string;
  language: string;
  sourceCountry: string;
  engine: "gdelt" | "bing" | "hn";
  snippet?: string;
}

export interface EngineStatus {
  engine: "gdelt" | "google" | "yandex" | "bing" | "hn";
  status: "ok" | "error";
  detail?: string;
}

export interface IntelResponse {
  ok: boolean;
  query: string;
  timespan: string;
  articles: IntelArticle[];
  domains: { domain: string; count: number }[];
  engines: EngineStatus[];
  fetchedAt: string;
  error?: string;
}

export interface WebSearchResponse {
  ok: boolean;
  query: string;
  articles: IntelArticle[];
  engines: EngineStatus[];
  fetchedAt: string;
  cached: boolean;
  error?: string;
}

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

export const CATEGORY_LABELS: Record<Category, string> = {
  geo: "地缘经济",
  security: "安全与外交",
  tech: "科技与产业",
  macro: "宏观与金融",
  energy: "能源与气候",
};

export const CATEGORY_ORDER: Category[] = ["geo", "security", "tech", "macro", "energy"];

export const TIMESPAN_OPTIONS = [
  { value: "24h", label: "24 小时" },
  { value: "3d", label: "3 天" },
  { value: "1w", label: "1 周" },
  { value: "2w", label: "2 周" },
  { value: "1m", label: "1 个月" },
] as const;

export const LANG_OPTIONS = [
  { value: "all", label: "全部语言" },
  { value: "chinese", label: "中文" },
  { value: "english", label: "English" },
  { value: "arabic", label: "العربية" },
  { value: "spanish", label: "Español" },
  { value: "french", label: "Français" },
  { value: "german", label: "Deutsch" },
  { value: "japanese", label: "日本語" },
  { value: "russian", label: "Русский" },
] as const;
