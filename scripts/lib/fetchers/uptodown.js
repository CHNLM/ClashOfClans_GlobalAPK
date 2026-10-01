/**
 * Uptodown：老牌 APK 站（冗余源）
 *
 * 解析规则基于开源实现（helium18/u2d）：
 *   - 版本列表页 #versions-items-list 内 div[data-url] → 详情页
 *   - 详情页 div.version（版本号）、div .full 内 64 位文本（SHA-256）、
 *     #detail-download-button 的 href（下载链接）
 * 注意：当前页面已 JS 化且 URL 路径可能随改版变化，因此对版本页 URL 采用
 *       候选自动探测（依次尝试，取第一个可用的），并依赖 source-health 巡检持续监控。
 */
import * as cheerio from "cheerio";
import { fetchText, buildBrowserHeaders } from "../http.js";
import { getSourcesConfig } from "../sources-config.js";
import { normalizeVersion } from "../version.js";

let cachedVersionsUrl = null;

/** 探测并缓存可用的版本列表页 URL（候选列表由 config/sources.json 提供） */
async function fetchVersionsPage() {
  if (cachedVersionsUrl) {
    return fetchText(cachedVersionsUrl, { headers: buildBrowserHeaders() });
  }
  const cfg = await getSourcesConfig();
  for (const url of cfg.uptodown.versionsUrlCandidates) {
    try {
      const html = await fetchText(url, { headers: buildBrowserHeaders() });
      if (html && html.length > 1000) {
        cachedVersionsUrl = url;
        return html;
      }
    } catch {
      // 该候选不可用，继续尝试下一个
    }
  }
  throw new Error("所有 Uptodown 版本页候选 URL 均不可用（可能页面改版）");
}

function toAbsolute(url, baseUrl) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return baseUrl + url;
}

/** 详情页数据：{ version, sha256, downloadUrl } */
async function fetchVersionDetail(relativeUrl) {
  const cfg = await getSourcesConfig();
  const html = await fetchText(toAbsolute(relativeUrl, cfg.uptodown.baseUrl), { headers: buildBrowserHeaders() });
  const $ = cheerio.load(html);

  const version = normalizeVersion($("div.version").first().text().trim());

  let sha256 = null;
  $("div .full").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length === 64 && /^[0-9a-fA-F]{64}$/.test(text)) {
      sha256 = text.toLowerCase();
    }
  });

  const downloadUrl = toAbsolute($("#detail-download-button").attr("href") || null, cfg.uptodown.baseUrl);

  if (!version && !downloadUrl) return null;
  return { version, sha256, downloadUrl };
}

/** 版本列表：{ version, detailUrl, sha256, downloadUrl } */
export async function fetchVersionList() {
  const html = await fetchVersionsPage();
  const $ = cheerio.load(html);
  const items = [];

  $("#versions-items-list div[data-url]").each((_, el) => {
    const detailUrl = $(el).attr("data-url");
    if (!detailUrl) return;
    items.push({ detailUrl });
  });

  // 并行解析前 N 个详情页（获取版本号用于排序）
  const MAX_PARSE = 20;
  const resolved = [];
  for (const item of items.slice(0, MAX_PARSE)) {
    try {
      const detail = await fetchVersionDetail(item.detailUrl);
      if (detail) resolved.push({ ...detail, detailUrl: item.detailUrl });
    } catch {
      // 单个详情页失败不影响整体
    }
  }
  return resolved;
}

/**
 * 获取最新版本信息（列表页第一项）
 * @returns {Promise<object|null>}
 */
export async function fetchLatestInfo() {
  const list = await fetchVersionList();
  const latest = list[0];
  if (!latest) return null;
  return {
    source: "uptodown",
    version: latest.version,
    downloadUrl: latest.downloadUrl,
    sha256: latest.sha256,
    note: "Uptodown 列表页",
  };
}

/**
 * 解析指定版本的下载链接
 * @param {object} opts { version }
 * @returns {Promise<object|null>}
 */
export async function resolveDownload({ version }) {
  const list = await fetchVersionList();
  const target = list.find((item) => item.version === version && item.downloadUrl);
  if (!target) return null;
  return {
    url: target.downloadUrl,
    sha256: target.sha256 || null,
    source: "uptodown",
  };
}
