/**
 * 源注册表：统一编排各 fetcher 的优先级
 *
 * 版本检测：官方源（Google Play）优先，失败后按序轮询冗余源。
 * 下载解析：APKMirror（首选，纯 APK）→ APKPure API（稳定，纯 APK 优先）→ Uptodown（纯 APK）。
 * 注意：APKMirror 在 CI 常被 Cloudflare 拦截(403)，此时由 APKPure 直接顶上。
 * 已移除：captain-droid（CI 403）、Aptoide（包完整性存疑）。
 */
import * as googlePlay from "./google-play.js";
import * as apkpure from "./apkpure.js";
import * as apkmirror from "./apkmirror.js";
import * as uptodown from "./uptodown.js";

/** 版本检测源（官方优先） */
export const VERSION_SOURCES = [
  { name: "google-play", label: "Google Play（官方）", fetchLatest: (pkg) => googlePlay.fetchLatestInfo(pkg) },
  { name: "apkpure", label: "APKPure API", fetchLatest: (pkg) => apkpure.fetchLatestInfo(pkg) },
  { name: "apkmirror", label: "APKMirror", fetchLatest: () => apkmirror.fetchLatestInfo() },
  { name: "uptodown", label: "Uptodown", fetchLatest: () => uptodown.fetchLatestInfo() },
];

/** 下载解析源（纯 APK 优先，APKMirror 首选） */
export const DOWNLOAD_SOURCES = [
  { name: "apkmirror", label: "APKMirror", resolve: (opts) => apkmirror.resolveDownload(opts) },
  { name: "apkpure", label: "APKPure API", resolve: (opts) => apkpure.resolveDownload(opts) },
  { name: "uptodown", label: "Uptodown", resolve: (opts) => uptodown.resolveDownload(opts) },
];

/** 按名称取源 */
export function getVersionSource(name) {
  return VERSION_SOURCES.find((s) => s.name === name) || null;
}

export function getDownloadSource(name) {
  return DOWNLOAD_SOURCES.find((s) => s.name === name) || null;
}
