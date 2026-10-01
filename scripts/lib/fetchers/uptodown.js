/**
 * Uptodown：老牌 APK 站（冗余源）
 *
 * 解析规则基于开源实现（helium18/u2d）：
 *   - 版本列表页 #versions-items-list 内 div[data-url] → 详情页
 *   - 详情页 div.version（版本号）、div .full 内 64 位文本（SHA-256）、
 *     #detail-download-button 的 href（下载链接）
 * 注意：当前页面已 JS 化，选择器需在 CI 冒烟测试中实测校准。
 */
import * as cheerio from "cheerio";
import { fetchText, buildBrowserHeaders } from "../http.js";
import { normalizeVersion } from "../version.js";

const VERSIONS_URL = "https://clash-of-clans.en.uptodown.com/android/versions";
const BASE_URL = "https://clash-of-clans.en.uptodown.com";

function toAbsolute(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return BASE_URL + url;
}

/** 详情页数据：{ version, sha256, downloadUrl } */
async function fetchVersionDetail(relativeUrl) {
  const html = await fetchText(toAbsolute(relativeUrl), { headers: buildBrowserHeaders() });
  const $ = cheerio.load(html);

  const version = normalizeVersion($("div.version").first().text().trim());

  let sha256 = null;
  $("div .full").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length === 64 && /^[0-9a-fA-F]{64}$/.test(text)) {
      sha256 = text.toLowerCase();
    }
  });

  const downloadUrl = toAbsolute($("#detail-download-button").attr("href") || null);

  if (!version && !downloadUrl) return null;
  return { version, sha256, downloadUrl };
}

/** 版本列表：{ version, detailUrl, sha256, downloadUrl } */
export async function fetchVersionList() {
  const html = await fetchText(VERSIONS_URL, { headers: buildBrowserHeaders() });
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
