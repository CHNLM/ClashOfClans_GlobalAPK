/**
 * 版本号解析 / 比较 / 校验
 *
 * COC 国际服版本号形如 18.600.5、18.600.7（X.YYY.ZZ），
 * 部分源可能附带 build 段（如 18.600.7.1）或 versionCode（如 180600008）。
 */

/** 语义化版本号校验：主版本.次版本.修订（可选 .build） */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(\.\d+)?$/;

/** 宽松模式：允许无点号分段，如 apkmirror 链接里的 18-600-7 */
const LOOSE_VERSION_PATTERN = /^[0-9][0-9.-]*[0-9]$/;

/**
 * 判断字符串是否为合法的语义化版本号
 * @param {string} raw
 * @returns {boolean}
 */
export function isValidVersion(raw) {
  return typeof raw === "string" && VERSION_PATTERN.test(raw.trim());
}

/**
 * 判断是否为可归一化的版本字符串（含 apkmirror 的连字符形式）
 * @param {string} raw
 * @returns {boolean}
 */
export function isLooseVersion(raw) {
  return typeof raw === "string" && LOOSE_VERSION_PATTERN.test(raw.trim());
}

/**
 * 将原始字符串解析为版本段数组
 * @param {string} raw
 * @returns {number[]}
 */
export function parseVersion(raw) {
  const parts = String(raw)
    .trim()
    .split(/[.\-]/)
    .map((part) => parseInt(part, 10));
  return parts.filter((part) => Number.isFinite(part) && part >= 0);
}

/**
 * 比较两个版本号
 * @param {string} a
 * @param {string} b
 * @returns {number} a > b 返回 1，a < b 返回 -1，相等返回 0；非法输入返回 0
 */
export function compareVersions(a, b) {
  if (!isValidVersion(a) || !isValidVersion(b)) {
    return 0;
  }
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/**
 * 将宽松版本字符串归一化为标准点号形式（18-600-7 → 18.600.7）
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeVersion(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isValidVersion(trimmed)) return trimmed;
  if (isLooseVersion(trimmed)) {
    const normalized = trimmed.split("-").join(".");
    return isValidVersion(normalized) ? normalized : null;
  }
  return null;
}

/**
 * 生成 release tag：v18.600.7
 * @param {string} version
 * @returns {string}
 */
export function toTag(version) {
  return "v" + version;
}
