/**
 * APKMirror：首选下载源（原站同源）
 *
 * 页面为静态 HTML + Cloudflare 保护。版本列表页解析可靠；
 * 下载直链为多级跳转（列表页 → release 页 → 变体页 → 下载按钮），
 * 正则按公开页面结构实现，需在 CI 冒烟测试中实测校准。
 * 若解析失败返回 null，由冗余池兜底。
 */
import { fetchText, buildBrowserHeaders } from "../http.js";
import { getSourcesConfig } from "../sources-config.js";
import { normalizeVersion, compareVersions } from "../version.js";

/** 列表页：提取所有版本 release 链接 */
const RELEASE_LINK_RE = /href="(\/apk\/supercell\/clash-of-clans\/clash-of-clans-([0-9][0-9.-]*)-release\/)"/g;

/** release 页：提取变体页链接（android-apk-download） */
const VARIANT_LINK_RE = /href="(\/apk\/supercell\/clash-of-clans\/[^"]*android-apk-download\/)"/g;

/** 变体页：提取下载链接（download.php 或 .apk 直链） */
const DOWNLOAD_LINK_RES = [
  /href="(https:\/\/www\.apkmirror\.com\/wp-content\/[^"]+download\.php[^"]*)"/g,
  /href="(https:\/\/[^"]+\.apk[^"]*)"/g,
  /data-url="(https:\/\/[^"]+download\.php[^"]*)"/g,
];

function extractAll(html, regex) {
  const matches = [];
  let m;
  const r = new RegExp(regex.source, regex.flags);
  while ((m = r.exec(html)) !== null) {
    matches.push(m);
  }
  return matches;
}

/**
 * 拉取版本列表（按版本号降序）
 * 列表页 URL 由 config/sources.json 提供（单点维护）。
 * @param {string} packageName 未使用，APKMirror 以固定列表页为准
 * @returns {Promise<Array<{version, releaseUrl}>>}
 */
export async function fetchVersionList() {
  const cfg = await getSourcesConfig();
  const html = await fetchText(cfg.apkmirror.listUrl, { headers: buildBrowserHeaders() });
  const items = [];
  for (const [, href, slug] of extractAll(html, RELEASE_LINK_RE)) {
    const version = normalizeVersion(slug);
    if (!version) continue;
    items.push({
      version,
      releaseUrl: "https://www.apkmirror.com" + href,
    });
  }
  // 去重并按版本降序
  const seen = new Set();
  const unique = items.filter((item) => {
    if (seen.has(item.version)) return false;
    seen.add(item.version);
    return true;
  });
  unique.sort((a, b) => compareVersions(b.version, a.version));
  return unique;
}

/**
 * 获取最新版本信息
 * @returns {Promise<object|null>}
 */
export async function fetchLatestInfo() {
  const list = await fetchVersionList();
  const latest = list[0];
  if (!latest) return null;
  return {
    source: "apkmirror",
    version: latest.version,
    releaseUrl: latest.releaseUrl,
    note: "APKMirror 列表页",
  };
}

/**
 * 解析指定版本的 APK 直链（多级跳转，实验性）
 * @param {object} opts { version }
 * @returns {Promise<object|null>} { url, source }
 */
export async function resolveDownload({ version }) {
  const list = await fetchVersionList();
  const target = list.find((item) => item.version === version);
  if (!target) return null;

  // 1) release 页 → 变体页
  const releaseHtml = await fetchText(target.releaseUrl, { headers: buildBrowserHeaders() });
  const variantMatches = extractAll(releaseHtml, VARIANT_LINK_RE);
  if (variantMatches.length === 0) return null;

  // 优先 universal 变体，否则取第一个
  let variantHref = variantMatches[0][1];
  const universal = variantMatches.find((m) => m[1].includes("universal"));
  if (universal) variantHref = universal[1];

  // 2) 变体页 → 下载链接
  const variantUrl = "https://www.apkmirror.com" + variantHref;
  const variantHtml = await fetchText(variantUrl, { headers: buildBrowserHeaders() });

  for (const regex of DOWNLOAD_LINK_RES) {
    const matches = extractAll(variantHtml, regex);
    if (matches.length > 0) {
      return { url: matches[0][1], source: "apkmirror" };
    }
  }
  return null;
}
