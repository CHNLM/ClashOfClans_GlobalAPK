/**
 * 轻量日志：统一输出格式，支持 CI 标记（::notice / ::warning / ::error）
 */

const isCI = Boolean(process.env.CI);

function stamp() {
  return new Date().toISOString();
}

export function info(msg) {
  console.log(`[${stamp()}] [INFO] ${msg}`);
}

export function success(msg) {
  console.log(`[${stamp()}] [ OK ] ${msg}`);
}

export function warn(msg) {
  if (isCI) {
    console.log(`::warning::${msg}`);
  }
  console.log(`[${stamp()}] [WARN] ${msg}`);
}

export function error(msg) {
  if (isCI) {
    console.log(`::error::${msg}`);
  }
  console.log(`[${stamp()}] [ERROR] ${msg}`);
}

/**
 * 注册全局异步错误处理。
 * 部分依赖库（如 google-play-scraper 内部的 got/p-cancelable）在网络异常时
 * 可能抛出未被捕获的 Promise rejection 直接终止进程，这里统一拦截为日志，
 * 保证单源失败不影响整体流程。
 */
export function setupGlobalErrorHandlers() {
  process.on("unhandledRejection", (reason) => {
    error(`未捕获的 Promise 拒绝：${reason?.message || reason}`);
  });
  process.on("uncaughtException", (err) => {
    error(`未捕获的异常：${err?.message || err}`);
  });
}
