# 智库雷达 ThinkTank Radar

汇总全球智库研究报告（地缘政治经济、科技、宏观经济与金融、能源与气候等领域），并提供议题级多信源交叉验证检索的研究情报站点。

## 公开访问

- 公开版（GitHub Pages，浏览器直连数据源，无需后端）：<https://zhongnan1991.github.io/thinktank-radar/>
- 本地版（完整五引擎协同检索）：`npm install && npm run dev` 后打开 <http://localhost:5173>

## 功能

- **智库报告流**：51 个全球智库与行业分析源（CFR、Brookings、CSIS、Bruegel、PIIE、OilPrice、Carbon Brief 等）的 RSS 聚合，按领域分类、关键词筛选、能源子筛选（油气市场 / 清洁能源 / 气候政策 / 公用事业）、手动更新。
- **议题验证台**：输入议题关键词，经 GDELT 全球媒体库 + Hacker News 多引擎检索，按独立信源自动聚合，展示信源覆盖、报道时间线与交叉验证等级（单一信源会明确警示）。
- **热榜**：Hacker News 热门条目。

## 公开版与本地版差异

| 能力 | 本地版 | 公开版（Pages） |
| --- | --- | --- |
| 智库 RSS 聚合 | 服务端抓取 | 浏览器经免费跨域代理链抓取 |
| 议题验证台 | GDELT + Google/Yandex/Bing + HN | GDELT + HN（网页搜索引擎受跨域限制不可用） |
| 全网协同检索 | 五引擎 | 不可用（如实提示） |

公开版数据缓存在浏览器 localStorage（报告 10 分钟 / 热榜 3 分钟 / 检索 15 分钟）。

## 数据源

- 智库 RSS 源：见 `server/sources.ts`
- GDELT Project API（<https://api.gdeltproject.org>）
- Hacker News Algolia API（<https://hn.algolia.com>）

## 技术栈

Vite + React + TypeScript + Tailwind CSS。`npm run build` 产出纯静态站点；`server/` 下的本地 API 仅用于本地开发模式。
