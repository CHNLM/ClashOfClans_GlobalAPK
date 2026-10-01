/**
 * config/sources.json 读取：各下载源的端点配置（单点维护，进程内缓存）
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SOURCES_CONFIG_PATH = path.resolve(__dirname, "../../config/sources.json");

let cache = null;

/** 读取源配置（带进程内缓存） */
export async function getSourcesConfig() {
  if (!cache) {
    const raw = await readFile(SOURCES_CONFIG_PATH, "utf-8");
    cache = JSON.parse(raw);
  }
  return cache;
}
