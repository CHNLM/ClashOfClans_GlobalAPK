/**
 * self-test.js —— 无网络自测：校验核心模块与配置可加载、版本工具正确
 *
 * 用法：node scripts/self-test.js
 * 退出码：全部通过返回 0，否则返回 1。
 */
import assert from "node:assert/strict";
import { readConfig } from "./lib/config.js";
import { info, success, error as logError, setupGlobalErrorHandlers } from "./lib/logger.js";
import {
  isValidVersion,
  isLooseVersion,
  normalizeVersion,
  parseVersion,
  compareVersions,
  toTag,
} from "./lib/version.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    success(`PASS ${name}`);
  } catch (err) {
    failed += 1;
    logError(`FAIL ${name}：${err.message}`);
  }
}

async function main() {
  info("运行自测…");

  // 配置可读且字段完整
  test("config/apk.json 可读取且字段完整", async () => {
    const config = await readConfig();
    assert.ok(config.packageName === "com.supercell.clashofclans");
    assert.ok(typeof config.currentVersion === "string");
    assert.ok(typeof config.apkAssetName === "string");
    assert.ok(config.expectedMinSizeMb > 0 && config.expectedMaxSizeMb > config.expectedMinSizeMb);
  });

  // 源配置可读且字段完整
  test("config/sources.json 可读取且字段完整", async () => {
    const { getSourcesConfig } = await import("./lib/sources-config.js");
    const cfg = await getSourcesConfig();
    assert.equal(cfg.googlePlay.country, "us");
    assert.ok(cfg.apkpure.apiBaseUrl.startsWith("https://") && cfg.apkpure.versionsPath.startsWith("/"));
    assert.ok(cfg.apkmirror.listUrl.includes("apkmirror.com"));
    assert.ok(Array.isArray(cfg.uptodown.versionsUrlCandidates) && cfg.uptodown.versionsUrlCandidates.length > 0);
  });

  // 版本校验
  test("isValidVersion 接受合法版本", () => {
    assert.equal(isValidVersion("18.600.5"), true);
    assert.equal(isValidVersion("18.600.7"), true);
    assert.equal(isValidVersion("1.0.0"), true);
  });
  test("isValidVersion 拒绝非法版本", () => {
    assert.equal(isValidVersion("18.600"), false);
    assert.equal(isValidVersion("abc"), false);
    assert.equal(isValidVersion(""), false);
    assert.equal(isValidVersion("18.600.7.1.2"), false);
  });
  test("isLooseVersion / normalizeVersion 处理连字符形式", () => {
    assert.equal(isLooseVersion("18-600-7"), true);
    assert.equal(normalizeVersion("18-600-7"), "18.600.7");
    assert.equal(normalizeVersion(" 18.600.5 "), "18.600.5");
    assert.equal(normalizeVersion("abc"), null);
  });

  // 版本比较
  test("compareVersions 正确比较", () => {
    assert.equal(compareVersions("18.600.7", "18.600.5"), 1);
    assert.equal(compareVersions("18.600.5", "18.600.7"), -1);
    assert.equal(compareVersions("18.600.7", "18.600.7"), 0);
    assert.equal(compareVersions("18.100.0", "18.99.99"), 1);
    assert.equal(compareVersions("18.600.7.1", "18.600.7"), 1);
  });
  test("parseVersion / toTag", () => {
    assert.deepEqual(parseVersion("18.600.7"), [18, 600, 7]);
    assert.equal(toTag("18.600.7"), "v18.600.7");
  });

  // 各 fetcher 模块可加载（不发起网络请求）
  test("全部 fetcher 模块可加载", async () => {
    const { VERSION_SOURCES, DOWNLOAD_SOURCES } = await import("./lib/fetchers/index.js");
    assert.equal(VERSION_SOURCES.length, 4);
    assert.equal(DOWNLOAD_SOURCES.length, 3);
    for (const s of [...VERSION_SOURCES, ...DOWNLOAD_SOURCES]) {
      assert.ok(s.name && typeof s.name === "string");
    }
  });

  // 工具模块可加载
  test("http / logger 模块可加载", async () => {
    const http = await import("./lib/http.js");
    assert.ok(http.BROWSER_UA.includes("Chrome"));
    assert.ok(http.buildApkPureHeaders(["arm64-v8a"]));
    const logger = await import("./lib/logger.js");
    assert.equal(typeof logger.info, "function");
  });

  if (failed > 0) {
    logError(`自测未通过：${failed} 项失败 / ${passed} 项通过`);
    process.exit(1);
  }
  success(`自测全部通过（${passed} 项）`);
}

setupGlobalErrorHandlers();

main().catch((err) => {
  logError(`自测异常：${err.stack || err.message}`);
  process.exit(1);
});
