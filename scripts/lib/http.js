/**
 * HTTP 工具：统一浏览器 UA、超时、重试；内置 fetch（Node 20+）
 * 以及 APKPure API 所需的三段式请求头。
 */
import { error as logError } from "./logger.js";

/** 桌面浏览器 UA（访问 APKMirror / Uptodown / captain-droid / Aptoide） */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** APKPure 客户端 UA（伪装官方客户端以调用其非官方 API） */
export const APKPURE_CLIENT_UA =
  "Dalvik/2.1.0 (Linux; U; Android 15; Pixel 4a (5G) Build/BP1A.250505.005); APKPure/3.20.53 (Aegon)";

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 2;

/**
 * 构造 APKPure API 请求头
 * @param {string[]} abis
 * @param {string} language
 * @param {string} osVer
 */
export function buildApkPureHeaders(abis, language = "en-US", osVer = "35") {
  return {
    "User-Agent": APKPURE_CLIENT_UA,
    "ual-access-businessid": "projecta",
    "ual-access-projecta": JSON.stringify({
      device_info: {
        abis,
        language,
        os_ver: osVer,
      },
    }),
    Accept: "application/json",
  };
}

/** 默认浏览器请求头 */
export function buildBrowserHeaders(extra = {}) {
  return {
    "User-Agent": BROWSER_UA,
    Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    ...extra,
  };
}

/**
 * 带超时与重试的 fetch
 * @param {string} url
 * @param {object} options
 * @param {object} [options.headers]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.retries]
 * @param {string} [options.method]
 * @param {string} [options.body]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}) {
  const { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, method = "GET", body } = options;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
      // 4xx 一般重试无意义，直接抛出
      if (response.status >= 400 && response.status < 500) {
        throw lastError;
      }
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err.name === "AbortError") {
        lastError = new Error(`Timeout after ${timeoutMs}ms for ${url}`);
      }
      if (attempt < retries) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }
  throw lastError || new Error(`Unknown network error for ${url}`);
}

/** 获取文本内容 */
export async function fetchText(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.text();
}

/** 获取 JSON 内容 */
export async function fetchJson(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.json();
}

/**
 * 流式下载到本地文件（带超时与重试）
 * @param {string} url
 * @param {string} filePath
 * @param {object} [options]
 */
export async function downloadToFile(url, filePath, options = {}) {
  const { headers = {}, timeoutMs = 60000, retries = 2, onProgress } = options;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} while downloading ${url}`);
        if (response.status >= 400 && response.status < 500) throw lastError;
        if (attempt < retries) {
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }
      const { createWriteStream } = await import("node:fs");
      const contentLength = Number(response.headers.get("content-length") || 0);
      let received = 0;
      const { Readable } = await import("node:stream");
      const body = Readable.fromWeb(response.body);
      await new Promise((resolvePromise, rejectPromise) => {
        const stream = createWriteStream(filePath);
        body.on("data", (chunk) => {
          received += chunk.length;
          onProgress?.(received, contentLength);
        });
        body.pipe(stream);
        stream.on("finish", () => resolvePromise());
        stream.on("error", rejectPromise);
        body.on("error", rejectPromise);
      });
      return;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (err.name === "AbortError") {
        lastError = new Error(`Download timeout after ${timeoutMs}ms for ${url}`);
      }
      logError(`下载失败（第 ${attempt + 1} 次尝试）: ${lastError.message}`);
      if (attempt < retries) {
        await sleep(2000 * Math.pow(2, attempt));
      }
    }
  }
  throw lastError || new Error(`Unknown download error for ${url}`);
}

/** 简易延时 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
