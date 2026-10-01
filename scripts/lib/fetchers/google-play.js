/**
 * 官方源：Google Play（版本号的唯一权威）
 *
 * 通过 google-play-scraper 访问 Google Play 公共接口获取应用元数据。
 * 官方渠道不提供 APK 直链，因此该源仅用于版本裁决。
 */
import gplay from "google-play-scraper";
import { getSourcesConfig } from "../sources-config.js";

/**
 * 获取最新版本信息（官方源）
 * 商店区域由 config/sources.json 提供（单点维护）。
 * @param {string} packageName
 * @returns {Promise<object>} { source, version, updatedAt, size, title }
 */
export async function fetchLatestInfo(packageName) {
  const cfg = await getSourcesConfig();
  const app = await gplay.app({ appId: packageName, country: cfg.googlePlay.country });
  return {
    source: "google-play",
    version: app.version,
    updatedAt: app.updated,
    size: app.size,
    title: app.title,
    note: "官方源",
  };
}

/** 官方源无 APK 直链，下载解析返回 null */
export async function resolveDownload() {
  return null;
}
