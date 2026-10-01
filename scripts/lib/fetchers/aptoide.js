/**
 * Aptoide：独立第三方应用商店（冗余源）
 *
 * 版本列表页结构稳定（静态 HTML），解析最新版本与下载端点。
 * 页面结构解析基于公开实现，需在 CI 冒烟测试中实测校准。
 */
import { fetchText, buildBrowserHeaders } from "../http.js";
import { normalizeVersion, compareVersions } from "../version.js";

const VERSIONS_URL = "https://clash-of-clans.en.aptoide.com/versions";

/** 提取版本列表中的版本号（Latest Version 区块之后） */
const VERSION_RE = /([0-9]+\.[0-9]+\.[0-9]+)/g;

/** 提取下载端点链接 */
const DOWNLOAD_APP_RE = /href="([^"]*\/download-app\?package_name=com\.supercell\.clashofclans[^"]*)"/g;

function extractAll(html, regex) {
  const matches = [];
  let m;
  const r = new RegExp(regex.source, regex.flags);
  while ((m = r.exec(html)) !== null) matches.push(m);
  return matches;
}

/**
 * 获取最新版本信息
 * @returns {Promise<object|null>}
 */
export async function fetchLatestInfo() {
  const html = await fetchText(VERSIONS_URL, { headers: buildBrowserHeaders() });
  const versions = extractAll(html, VERSION_RE)
    .map((m) => normalizeVersion(m[1]))
    .filter(Boolean);
  const unique = [...new Set(versions)].sort((a, b) => compareVersions(b, a));
  const latest = unique[0];
  if (!latest) return null;

  // 附带下载端点
  const downloadMatches = extractAll(html, DOWNLOAD_APP_RE);
  return {
    source: "aptoide",
    version: latest,
    downloadUrl: downloadMatches.length > 0 ? downloadMatches[0][1] : null,
    note: "Aptoide versions 页",
  };
}

/**
 * 解析下载链接（Aptoide 的 download-app 端点为最新版）
 * @param {object} opts { version }
 * @returns {Promise<object|null>}
 */
export async function resolveDownload({ version }) {
  const info = await fetchLatestInfo();
  if (!info || info.version !== version || !info.downloadUrl) return null;
  // 绝对化：download-app 链接为站内相对/绝对混合，统一前缀
  const url = info.downloadUrl.startsWith("http")
    ? info.downloadUrl
    : "https://clash-of-clans.en.aptoide.com" + info.downloadUrl;
  return { url, source: "aptoide" };
}
