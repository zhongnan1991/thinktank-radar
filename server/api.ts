import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { collectFeeds } from "./feed-fetch";
import { searchIntel, searchWebEngines } from "./gdelt";
import { collectTrending } from "./trending";
import { CATEGORY_LABELS, type Category } from "./sources";

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(data));
  });
}

const VALID_CATEGORIES = new Set(["all", ...Object.keys(CATEGORY_LABELS)]);

const webCache = new Map<string, { at: number; data: Record<string, unknown> }>();
const WEB_CACHE_TTL = 10 * 60 * 1000;

export function thinktankApi(): Plugin {
  return {
    name: "thinktank-api",
    configureServer(server) {
      server.middlewares.use("/api/feeds", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const category = url.searchParams.get("category") ?? "all";
          if (!VALID_CATEGORIES.has(category)) {
            return sendJson(res, 400, { error: "unknown category" });
          }
          const data = await collectFeeds(category as Category | "all", url.searchParams.has("refresh"));
          sendJson(res, 200, data);
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });

      server.middlewares.use("/api/intel", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          let q = url.searchParams.get("q") ?? "";
          let timespan = url.searchParams.get("timespan") ?? "1w";
          let lang = url.searchParams.get("lang") ?? "all";
          if (req.method === "POST") {
            const body = await readBody(req);
            try {
              const parsed = JSON.parse(body || "{}");
              q = parsed.q ?? q;
              timespan = parsed.timespan ?? timespan;
              lang = parsed.lang ?? lang;
            } catch { /* fall through to GET params */ }
          }
          q = q.trim().slice(0, 200);
          if (!q) return sendJson(res, 400, { error: "missing query" });
          const data = await searchIntel(q, timespan, lang, url.searchParams.has("refresh"));
          sendJson(res, data.ok ? 200 : 502, data);
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });

      // web-wide supplementary search for the report stream (Google / Yandex / Bing)
      server.middlewares.use("/api/websearch", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
          const refresh = url.searchParams.has("refresh");
          if (!q) return sendJson(res, 400, { error: "missing query" });
          const cacheKey = `web::${q}`;
          const hit = webCache.get(cacheKey);
          if (!refresh && hit && Date.now() - hit.at < WEB_CACHE_TTL) {
            return sendJson(res, 200, { ...hit.data, cached: true });
          }
          const { articles, engines } = await searchWebEngines(q);
          const data = {
            ok: articles.length > 0,
            query: q,
            articles,
            engines,
            fetchedAt: new Date().toISOString(),
            cached: false,
            error: articles.length ? undefined : "三个网页搜索引擎均不可用或无结果",
          };
          if (articles.length) webCache.set(cacheKey, { at: Date.now(), data });
          sendJson(res, data.ok ? 200 : 502, data);
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
      server.middlewares.use("/api/trending", async (_req, res) => {
        try {
          const data = await collectTrending();
          sendJson(res, data.ok ? 200 : 502, data);
        } catch (e) {
          sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
