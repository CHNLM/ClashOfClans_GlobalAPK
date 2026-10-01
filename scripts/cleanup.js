/**
 * cleanup.js —— 只保留最新 Release：删除其余全部 Release 及其 tag
 *
 * 依赖 gh CLI。用法：
 *   node scripts/cleanup.js              # 保留最新一个，删除其余
 *   node scripts/cleanup.js --dry-run    # 只列出待删除项
 */
import { spawnSync } from "node:child_process";
import { info, success, warn, error as logError } from "./lib/logger.js";

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function runGh(args, opts = {}) {
  const result = spawnSync("gh", args, { encoding: "utf-8", ...opts });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} 失败：${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout.trim();
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  const releases = JSON.parse(
    runGh(["release", "list", "--limit", "100", "--json", "tagName,isDraft,isPrerelease,createdAt"])
  );
  if (releases.length === 0) {
    info("没有任何 Release，无需清理");
    return;
  }

  // 按创建时间取最新一个（优先非草稿/非预发布）
  const sorted = [...releases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const keep = sorted.find((r) => !r.isDraft && !r.isPrerelease) || sorted[0];
  const toDelete = sorted.filter((r) => r.tagName !== keep.tagName);

  info(`保留最新 Release：${keep.tagName}`);
  info(`待清理：${toDelete.length} 个 Release（${toDelete.map((r) => r.tagName).join(", ") || "无"}）`);

  for (const release of toDelete) {
    if (dryRun) {
      warn(`[dry-run] 将删除 ${release.tagName}`);
      continue;
    }
    try {
      runGh(["release", "delete", release.tagName, "--yes"]);
      // 同步删除远端 tag（否则 release 删除后 tag 仍残留占位）
      runGh(["api", "-X", "DELETE", `repos/{owner}/{repo}/git/refs/tags/${release.tagName}`]);
      success(`已删除 ${release.tagName}（Release + tag）`);
    } catch (err) {
      warn(`删除 ${release.tagName} 失败：${err.message}`);
    }
  }

  success("清理完成，Release 区仅保留最新版本");
}

main().catch((err) => {
  logError(`脚本异常：${err.stack || err.message}`);
  process.exit(1);
});
