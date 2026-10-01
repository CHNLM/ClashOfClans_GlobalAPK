/**
 * config/apk.json 读写：项目的单点事实源
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_DIR = path.resolve(__dirname, "../../config");
export const CONFIG_PATH = path.join(CONFIG_DIR, "apk.json");

/** 读取配置 */
export async function readConfig() {
  const raw = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

/** 局部更新配置（保留未涉及的字段） */
export async function writeConfig(partial) {
  const current = await readConfig();
  const next = { ...current, ...partial };
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", "utf-8");
  return next;
}
