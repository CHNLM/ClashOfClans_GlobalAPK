/**
 * download-verify.js —— 下载 APK 并校验（体积 + 哈希）
 *
 * 用法：
 *   node scripts/download-verify.js --version=18.600.7
 *   node scripts/download-verify.js --version=18.600.7 --output=downloads/out.apk
 *   node scripts/download-verify.js --version=18.600.7 --source=apkpure
 *
 * 下载源按优先级轮询（APKMirror → APKPure → Aptoide → Uptodown → captain-droid）。
 * 校验规则：体积在 config 范围内；若源提供 SHA-1/SHA-256 则必须匹配，否则拒绝。
 */
import { createHash } from "node:crypto";
import { createReadStream, statSync, rmSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { readConfig } from "./lib/config.js";
import { info, success, warn, error as logError, setupGlobalErrorHandlers } from "./lib/logger.js";
import { DOWNLOAD_SOURCES, getDownloadSource } from "./lib/fetchers/index.js";
import { downloadToFile, buildBrowserHeaders } from "./lib/http.js";

function parseArgs(argv) {
  const args = { version: null, output: null, source: null, githubOutput: false };
  for (const arg of argv) {
    if (arg.startsWith("--version=")) args.version = arg.slice("--version=".length);
    else if (arg.startsWith("--output=")) args.output = arg.slice("--output=".length);
    else if (arg.startsWith("--source=")) args.source = arg.slice("--source=".length);
    else if (arg === "--github-output") args.githubOutput = true;
  }
  return args;
}

/** 根据下载 URL 推断安装包格式（.xapk 为 APKPure 封装格式） */
function detectExtension(url) {
  return /\.xapk($|\?)/i.test(url) ? ".xapk" : ".apk";
}

/** 写 GitHub Actions step output */
function writeGithubOutput(values) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  const lines = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  appendFileSync(outPath, lines + "\n", "utf-8");
}

/** 计算文件哈希 */
async function hashFile(filePath, algorithm) {
  const hash = createHash(algorithm);
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  return hash.digest("hex");
}

/** 校验下载文件 */
async function verifyFile(filePath, config, expected) {
  const stat = statSync(filePath);
  const sizeMb = stat.size / 1024 / 1024;
  info(`文件大小：${sizeMb.toFixed(1)} MB`);

  if (sizeMb < config.expectedMinSizeMb || sizeMb > config.expectedMaxSizeMb) {
    throw new Error(
      `体积不在预期范围（${config.expectedMinSizeMb}-${config.expectedMaxSizeMb} MB），实际 ${sizeMb.toFixed(1)} MB，拒绝发布`
    );
  }

  if (expected.sha256) {
    const actual = await hashFile(filePath, "sha256");
    if (actual !== expected.sha256.toLowerCase()) {
      throw new Error(`SHA-256 校验失败：期望 ${expected.sha256}，实际 ${actual}`);
    }
    success("SHA-256 校验通过");
  } else if (expected.sha1) {
    const actual = await hashFile(filePath, "sha1");
    if (actual !== expected.sha1.toLowerCase()) {
      throw new Error(`SHA-1 校验失败：期望 ${expected.sha1}，实际 ${actual}`);
    }
    success("SHA-1 校验通过");
  } else {
    warn("源未提供哈希，仅体积校验通过");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readConfig();
  const version = args.version || config.currentVersion;
  if (!version) {
    logError("缺少目标版本：请传 --version= 或先初始化 config.currentVersion");
    process.exit(1);
  }

  info(`目标版本：${version}`);
  const sources = args.source ? [getDownloadSource(args.source)] : DOWNLOAD_SOURCES;
  if (!sources[0]) {
    logError(`未知下载源：${args.source}`);
    process.exit(1);
  }

  let resolved = null;
  for (const source of sources) {
    info(`尝试下载源：${source.label}`);
    try {
      const result = await source.resolve({ packageName: config.packageName, version });
      if (!result || !result.url) {
        warn(`${source.label}：未解析到下载链接`);
        continue;
      }
      resolved = { source: source.name, label: source.label, ...result };
      break;
    } catch (err) {
      warn(`${source.label}：解析失败 —— ${err.message}`);
    }
  }

  if (!resolved) {
    logError("所有下载源均失败，取消发布（不会误发）");
    process.exit(1);
  }

  info(`下载链接来源：${resolved.label}`);
  info(`开始下载：${resolved.url}`);

  const outDir = args.output ? path.dirname(path.resolve(args.output)) : path.resolve("downloads");
  const outBase = args.output ? path.resolve(args.output) : path.join(outDir, `Clash_of_Clans_${version}`);
  const outFile = outBase + detectExtension(resolved.url);
  mkdirSync(outDir, { recursive: true });
  rmSync(outFile, { force: true });

  await downloadToFile(resolved.url, outFile, {
    headers: buildBrowserHeaders({ Accept: "*/*", Referer: resolved.url }),
  });

  const expected = { sha1: resolved.sha1 || null, sha256: resolved.sha256 || null };
  await verifyFile(outFile, config, expected);

  const sha256 = await hashFile(outFile, "sha256");
  success(`下载并校验完成：${outFile}`);
  if (args.githubOutput) {
    writeGithubOutput({ file: outFile, version, sha256, format: detectExtension(resolved.url).slice(1) });
  }
  console.log(JSON.stringify({ ok: true, version, file: outFile, size: statSync(outFile).size, sha256, source: resolved.source }, null, 2));
}

setupGlobalErrorHandlers();

main().catch((err) => {
  logError(`脚本异常：${err.stack || err.message}`);
  process.exit(1);
});
