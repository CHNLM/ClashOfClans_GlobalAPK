/**
 * APKPure：非官方 JSON API（结构经实测实证）
 *
 * 端点：https://tapi.pureapk.com/v3/get_app_his_version?hl=en&package_name=<pkg>
 * 需要伪装 APKPure 客户端的三段式请求头（见 http.js buildApkPureHeaders）。
 * 一次请求返回全部历史版本，含下载直链、SHA1、大小，最适合自动化。
 */
import { fetchJson, buildApkPureHeaders } from "../http.js";
import { normalizeVersion, compareVersions } from "../version.js";

const API_URL = "https://tapi.pureapk.com/v3/get_app_his_version";
const DEFAULT_ABIS = ["arm64-v8a", "armeabi-v7a", "armeabi", "x86", "x86_64"];

/** 时间字段兜底取值顺序 */
function getTimestamp(item) {
  return (
    item.version_date ||
    item.update_date ||
    item.update_time ||
    item.update_on ||
    null
  );
}

/**
 * 拉取版本列表（原始项）
 * @param {string} packageName
 * @returns {Promise<object[]>}
 */
export async function fetchVersionList(packageName) {
  const url = `${API_URL}?hl=en&package_name=${encodeURIComponent(packageName)}`;
  const payload = await fetchJson(url, {
    headers: buildApkPureHeaders(DEFAULT_ABIS),
  });
  return payload.version_list || [];
}

/** 将 API 原始项映射为统一结构 */
export function mapVersionItem(item) {
  const asset = item.asset || {};
  return {
    version: normalizeVersion(item.version_name),
    versionCode: item.version_code ? String(item.version_code).trim() : undefined,
    timestamp: getTimestamp(item),
    size: asset.size ?? null,
    downloadUrl: asset.url || null,
    sha1: asset.sha1 || null,
    assetType: asset.type || null,
    nativeCode: item.native_code || null,
    isOffDownload: Boolean(item.is_off_download),
  };
}

/** 按时间降序取最新版本 */
export function pickLatest(items) {
  const mapped = items.map(mapVersionItem).filter((item) => item.version);
  if (mapped.length === 0) return null;
  mapped.sort((a, b) => {
    const ta = a.timestamp ? new Date(String(a.timestamp)).getTime() : 0;
    const tb = b.timestamp ? new Date(String(b.timestamp)).getTime() : 0;
    return tb - ta || compareVersions(b.version, a.version);
  });
  return mapped[0];
}

/**
 * 获取最新版本信息
 * @param {string} packageName
 * @returns {Promise<object|null>}
 */
export async function fetchLatestInfo(packageName) {
  const items = await fetchVersionList(packageName);
  const latest = pickLatest(items);
  if (!latest) return null;
  return { source: "apkpure", note: "APKPure API", ...latest };
}

/**
 * 解析指定版本的下载直链
 * @param {object} opts { packageName, version }
 * @returns {Promise<object|null>} { url, sha1, size, source }
 */
export async function resolveDownload({ packageName, version }) {
  const items = await fetchVersionList(packageName);
  const mapped = items.map(mapVersionItem);
  const target = mapped.find((item) => item.version === version && item.downloadUrl);
  if (!target) return null;
  return {
    url: target.downloadUrl,
    sha1: target.sha1 || null,
    size: target.size || null,
    source: "apkpure",
  };
}
