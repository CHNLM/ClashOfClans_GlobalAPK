/**
 * publish.js —— 创建 GitHub Release（asset 使用固定文件名，latest 链接永久有效）
 *
 * 依赖 gh CLI（CI 环境预装；本地需先安装并登录 GitHub CLI）。
 * 用法：
 *   node scripts/publish.js --version=18.600.7 --apk=downloads/Clash_of_Clans_18.600.7.apk
 *   node scripts/publish.js --version=18.600.7 --apk=xxx.apk --notes="更新说明"
 *   node scripts/publish.js --dry-run
 */
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import { readConfig } from "./lib/config.js";
import { info, success, warn, error as logError } from "./lib/logger.js";
import { toTag } from "./lib/version.js";

function parseArgs(argv) {
  const args = { version: null, apk: null, notes: "", dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith("--version=")) args.version = arg.slice("--version=".length);
    else if (arg.startsWith("--apk=")) args.apk = arg.slice("--apk=".length);
    else if (arg.startsWith("--notes=")) args.notes = arg.slice("--notes=".length);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  return args;
}

function runGh(args, opts = {}) {
  const result = spawnSync("gh", args, { encoding: "utf-8", ...opts });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} 失败：${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout.trim();
}

function getRepo() {
  return runGh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readConfig();
  const version = args.version || config.currentVersion;
  if (!version) {
    logError("缺少版本号：请传 --version=");
    process.exit(1);
  }

  const tag = toTag(version);
  info(`目标版本：${version}（tag: ${tag}）`);

  if (args.dryRun) {
    info("dry-run：仅打印发布参数，不实际发布");
    console.log(JSON.stringify({ dryRun: true, tag, version, apk: args.apk, assetName: config.apkAssetName }, null, 2));
    return;
  }

  if (!args.apk) {
    logError("缺少 APK 文件路径：请传 --apk=");
    process.exit(1);
  }
  try {
    const stat = statSync(args.apk);
    if (stat.size === 0) throw new Error("文件为空");
  } catch (err) {
    logError(`APK 文件不可用：${args.apk} —— ${err.message}`);
    process.exit(1);
  }

  const repo = getRepo();
  info(`仓库：${repo}`);

  // 幂等：若同名 tag 的 Release 已存在（如 force 重发），先删除旧 Release 与 tag 再创建
  try {
    runGh(["release", "view", tag, "--repo", repo, "--json", "tagName", "--jq", ".tagName"]);
    info(`检测到同名 Release（${tag}），先删除旧的`);
    runGh(["release", "delete", tag, "--yes", "--repo", repo]);
    try {
      runGh(["api", "-X", "DELETE", `repos/{owner}/{repo}/git/refs/tags/${tag}`]);
    } catch {
      warn("旧 tag 删除失败（可能已被移除），继续");
    }
  } catch {
    info(`无同名 Release，直接创建`);
  }

  // asset 用固定基础名 + 实际格式扩展名（Clash_of_Clans_international.apk / .xapk），
  // 使 releases/latest/download/<assetName> 永久指向最新版本。
  const ext = path.extname(args.apk) || ".apk";
  const assetName = config.apkAssetName + ext;
  const notes = args.notes || `Clash of Clans 国际服安装包 v${version}（自动发布）`;
  const releaseArgs = [
    "release",
    "create",
    tag,
    `${args.apk}#${assetName}`,
    "--repo",
    repo,
    "--title",
    `Clash of Clans v${version}`,
    "--notes",
    notes,
  ];

  info("创建 Release 并上传 asset（约 885MB，可能需要数分钟）…");
  const output = runGh(releaseArgs, { stdio: ["ignore", "pipe", "pipe"] });
  const url = output.split("\n").find((line) => line.startsWith("https://")) || output;
  success(`发布完成：${url}`);

  // 回写 config 当前版本
  const { writeConfig } = await import("./lib/config.js");
  await writeConfig({
    currentVersion: version,
    lastReleasedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify({ ok: true, tag, url, assetName: config.apkAssetName }, null, 2));
}

main().catch((err) => {
  logError(`脚本异常：${err.stack || err.message}`);
  process.exit(1);
});
