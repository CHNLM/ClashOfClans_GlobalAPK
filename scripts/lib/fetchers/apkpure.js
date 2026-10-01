/**
 * APKPure：非官方 JSON API（结构经实测实证）
 *
 * 端点：https://tapi.pureapk.com/v3/get_app_his_version?hl=en&package_name=<pkg>
 * 需要伪装 APKPure 客户端的三段式请求头（见 http.js buildApkPureHeaders）。
 * 一次请求返回全部历史版本，含下载直链、SHA1、大小，最适合自动化。
 */
import { fetchJson, buildApkPureHeaders } from "../http.js";
import { getSourcesConfig } from "../sources-config.js";
import { normalizeVersion, compareVersions } from "../version.js";

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
 * 端点与请求头参数统一由 config/sources.json 提供（单点维护）。
 * @param {string} packageName
 * @returns {Promise<object[]>}
 */
export async function fetchVersionList(packageName) {
  const cfg = await getSourcesConfig();
  const { apiBaseUrl, versionsPath, abis, language, osVer } = cfg.apkpure;
  const url = `${apiBaseUrl}${versionsPath}?hl=en&package_name=${encodeURIComponent(packageName)}`;
  const payload = await fetchJson(url, {
    headers: buildApkPureHeaders(abis, language, osVer),
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
 * 优先纯 APK 变体（asset.type === 'apk'，完整单包，约 888MB），
 * 仅当无纯 APK 时才回退 XAPK（分体封装）。
 * @param {object} opts { packageName, version }
 * @returns {Promise<object|null>} { url, sha1, size, source, assetType }
 */
export async function resolveDownload({ packageName, version }) {
  const items = await fetchVersionList(packageName);
  const mapped = items.map(mapVersionItem);
  const candidates = mapped.filter((item) => item.version === version && item.downloadUrl);
  if (candidates.length === 0) return null;
  const target =
    candidates.find((item) => item.assetType && item.assetType.toLowerCase() === "apk") ||
    candidates[0];
  return {
    url: target.downloadUrl,
    sha1: target.sha1 || null,
    size: target.size || null,
    source: "apkpure",
    assetType: target.assetType || null,
  };
}
