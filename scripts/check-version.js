/**
 * check-version.js —— 检测国际服最新版本（官方源优先 + 多源冗余）
 *
 * 用法：
 *   node scripts/check-version.js                 # 官方优先轮询
 *   node scripts/check-version.js --source=apkpure # 指定单一源
 *   node scripts/check-version.js --all            # 收集全部源结果
 *   node scripts/check-version.js --dry-run        # 不写回 config
 *   node scripts/check-version.js --github-output  # 写入 $GITHUB_OUTPUT
 *
 * 退出码：0 = 正常（含“无新版本/全部源失败”）；仅参数错误时非 0。
 */
import { appendFileSync } from "node:fs";
import { readConfig } from "./lib/config.js";
import { info, success, warn, error as logError, setupGlobalErrorHandlers } from "./lib/logger.js";
import { isValidVersion, compareVersions } from "./lib/version.js";
import { VERSION_SOURCES, getVersionSource } from "./lib/fetchers/index.js";

function parseArgs(argv) {
  const args = {
    source: null,
    all: false,
    dryRun: false,
    githubOutput: false,
  };
  for (const arg of argv) {
    if (arg === "--all") args.all = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--github-output") args.githubOutput = true;
    else if (arg.startsWith("--source=")) args.source = arg.slice("--source=".length);
  }
  return args;
}

/** 写 GitHub Actions step output */
function writeGithubOutput(values) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) {
    warn("未检测到 GITHUB_OUTPUT，跳过输出");
    return;
  }
  const lines = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  appendFileSync(outPath, lines + "\n", "utf-8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readConfig();
  const { packageName, currentVersion } = config;
  info(`检测源列表：${VERSION_SOURCES.map((s) => s.label).join(" → ")}`);
  info(`当前发布版本：${currentVersion}`);

  const sources = args.source ? [getVersionSource(args.source)] : VERSION_SOURCES;
  if (!sources[0]) {
    logError(`未知源：${args.source}`);
    process.exit(1);
  }

  const collected = [];
  let resolved = null;

  for (const source of sources) {
    info(`尝试源：${source.label}`);
    try {
      const raw = await source.fetchLatest(packageName);
      if (!raw || !raw.version) {
        warn(`${source.label}：无有效返回`);
        continue;
      }
      if (!isValidVersion(raw.version)) {
        warn(`${source.label}：版本号格式非法，拒绝采纳（${raw.version}）`);
        continue;
      }
      const record = { source: source.name, label: source.label, version: raw.version, ...raw };
      collected.push(record);
      if (!resolved) {
        resolved = record;
        success(`${source.label}：最新版本 ${record.version}`);
        // --all 模式收集全部源结果；默认模式找到第一个可用源即停止
        if (!args.all) break;
      }
    } catch (err) {
      collected.push({ source: source.name, label: source.label, error: err.message });
      warn(`${source.label}：获取失败 —— ${err.message}`);
    }
  }

  if (!resolved) {
    logError("全部版本源均失败，本次检测跳过（不会误发）");
    const outputs = {
      hasUpdate: "false",
      checkError: "true",
      latestVersion: "",
      source: "",
    };
    if (args.githubOutput) writeGithubOutput(outputs);
    console.log(JSON.stringify({ ok: false, collected }, null, 2));
    return;
  }

  const hasUpdate = compareVersions(resolved.version, currentVersion) > 0;
  info(`检测结果：${resolved.version} ${hasUpdate ? "> 有新版" : "≤ 当前版本，无更新"}`);

  if (!args.dryRun) {
    const { writeConfig } = await import("./lib/config.js");
    await writeConfig({ lastCheckedAt: new Date().toISOString() });
  }

  const outputs = {
    hasUpdate: String(hasUpdate),
    checkError: "false",
    latestVersion: resolved.version,
    source: resolved.source,
    currentVersion,
  };
  if (args.githubOutput) writeGithubOutput(outputs);

  const summary = args.all ? { ok: true, resolved, collected } : { ok: true, resolved };
  console.log(JSON.stringify(summary, null, 2));
}

setupGlobalErrorHandlers();

main().catch((err) => {
  logError(`脚本异常：${err.stack || err.message}`);
  process.exit(1);
});
