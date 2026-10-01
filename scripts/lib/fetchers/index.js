/**
 * 源注册表：统一编排各 fetcher 的优先级
 *
 * 版本检测：官方源（Google Play）优先，失败后按序轮询冗余源。
 * 下载解析：APKMirror（首选）优先；实测其在 CI 常被 Cloudflare 拦截(403)，
 *           故 captain-droid（纯 APK）紧随其后，APKPure API（XAPK 封装）兜底。
 * 注意：captain-droid/APKMirror 提供纯 APK，APKPure 提供 XAPK 封装格式。
 */
import * as googlePlay from "./google-play.js";
import * as apkpure from "./apkpure.js";
import * as apkmirror from "./apkmirror.js";
import * as aptoide from "./aptoide.js";
import * as uptodown from "./uptodown.js";
import * as captainDroid from "./captain-droid.js";

/** 版本检测源（官方优先） */
export const VERSION_SOURCES = [
  { name: "google-play", label: "Google Play（官方）", fetchLatest: (pkg) => googlePlay.fetchLatestInfo(pkg) },
  { name: "apkpure", label: "APKPure API", fetchLatest: (pkg) => apkpure.fetchLatestInfo(pkg) },
  { name: "apkmirror", label: "APKMirror", fetchLatest: () => apkmirror.fetchLatestInfo() },
  { name: "aptoide", label: "Aptoide", fetchLatest: () => aptoide.fetchLatestInfo() },
  { name: "uptodown", label: "Uptodown", fetchLatest: () => uptodown.fetchLatestInfo() },
  { name: "captain-droid", label: "Captain Droid", fetchLatest: () => captainDroid.fetchLatestInfo() },
];

/** 下载解析源（纯 APK 优先，APKMirror 首选） */
export const DOWNLOAD_SOURCES = [
  { name: "apkmirror", label: "APKMirror", resolve: (opts) => apkmirror.resolveDownload(opts) },
  { name: "captain-droid", label: "Captain Droid", resolve: (opts) => captainDroid.resolveDownload(opts) },
  { name: "apkpure", label: "APKPure API", resolve: (opts) => apkpure.resolveDownload(opts) },
  { name: "aptoide", label: "Aptoide", resolve: (opts) => aptoide.resolveDownload(opts) },
  { name: "uptodown", label: "Uptodown", resolve: (opts) => uptodown.resolveDownload(opts) },
];

/** 按名称取源 */
export function getVersionSource(name) {
  return VERSION_SOURCES.find((s) => s.name === name) || null;
}

export function getDownloadSource(name) {
  return DOWNLOAD_SOURCES.find((s) => s.name === name) || null;
}
