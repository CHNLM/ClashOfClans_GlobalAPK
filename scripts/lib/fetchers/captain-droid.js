/**
 * Captain Droid：小规模 APK 站（末位兜底源）
 *
 * 详情页含结构化 File Details 表格：Version / SHA-256 / Size / Upload Date，
 * 下载链接为 /attachment/...-apk/ 形式。页面为静态 HTML，结构已确认（2026-09 实测）。
 */
import * as cheerio from "cheerio";
import { fetchText, buildBrowserHeaders } from "../http.js";
import { normalizeVersion } from "../version.js";

const DETAIL_URL = "https://captain-droid.com/en/games/strategy/clash-of-clans/download/";
const BASE_URL = "https://captain-droid.com";

/** 提取表格字段：匹配 <td>Version</td><td>xxx</td> 形式 */
function extractTableField($, label) {
  let value = null;
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td");
    cells.each((i, cell) => {
      if ($(cell).text().trim().toLowerCase() === label.toLowerCase()) {
        value = $(cells[i + 1]).text().trim();
      }
    });
  });
  return value;
}

/**
 * 获取最新版本信息
 * @returns {Promise<object|null>}
 */
export async function fetchLatestInfo() {
  const html = await fetchText(DETAIL_URL, { headers: buildBrowserHeaders() });
  const $ = cheerio.load(html);

  const versionRaw = extractTableField($, "Version") || "";
  // 形如 "18.600.7 (180600008)"，取括号前主版本号
  const version = normalizeVersion(versionRaw.split("(")[0]);

  const sha256Raw = extractTableField($, "SHA-256") || "";
  const sha256 = /^[0-9a-fA-F]{64}$/.test(sha256Raw.trim()) ? sha256Raw.trim().toLowerCase() : null;

  let downloadUrl = null;
  $('a[href*=".apk"]').each((_, a) => {
    const href = $(a).attr("href") || "";
    if (/\.apk($|\/)/.test(href) && !downloadUrl) {
      downloadUrl = href.startsWith("http") ? href : BASE_URL + href;
    }
  });

  if (!version) return null;
  return {
    source: "captain-droid",
    version,
    sha256,
    downloadUrl,
    note: "captain-droid 详情页",
  };
}

/**
 * 解析指定版本的下载链接（该站仅托管当前最新版）
 * @param {object} opts { version }
 * @returns {Promise<object|null>}
 */
export async function resolveDownload({ version }) {
  const info = await fetchLatestInfo();
  if (!info || info.version !== version || !info.downloadUrl) return null;
  return { url: info.downloadUrl, sha256: info.sha256 || null, source: "captain-droid" };
}
