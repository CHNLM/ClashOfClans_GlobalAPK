# ClashOfClans_Global

> Clash of Clans 国际服安装包的自动检测与发布仓库。

本仓库通过 GitHub Actions 每周自动检测 COC 国际服的最新版本，发现新版本后自动下载安装包、校验并发布为 GitHub Release（**只保留最新版本**，旧版本自动清理，避免占用容量）。

## 快速使用

### 下载最新安装包

直接点击下方链接查看并下载最新安装包：

[⬇️ 下载 Clash of Clans 国际服安装包](https://github.com/CHNLM/ClashOfClans_GlobalAPK/releases)

- 系统要求：Android 7.0+
- 安装包为官方签名原版（纯 APK 格式，可直接安装），SHA-256 已在发布时校验。
- 仅当纯 APK 源不可用时，才会兜底发布 XAPK 封装格式（需 XAPK 安装器）。

### 最新版本信息

| 版本号 | 格式 | 文件大小 | SHA-256 |
|--------|------|----------|---------|
| 18.600.7 | apk | 888.15 MB | 39dbe457850f706bd830490c1d0602f699699d18aea0c598cd510b81af4f71f3 |

> 表中数据为纯文本，不依赖外部服务；每次发布新版本后自动更新。

### 手动触发一次检测与发布

仓库 → **Actions** → **Weekly APK Check & Release** → **Run workflow**：

| 输入 | 说明 |
|---|---|
| `version` | 强制发布指定版本（如 `18.600.7`）。留空则自动检测最新版本 |
| `force` | 勾选后忽略版本比对，强制重新发布当前检测到的版本 |

## 工作机制

```
每周一 03:30 UTC 自动触发（也可手动 Run workflow）
        │
        ▼
① 检测最新版本：Google Play（官方源）优先，失败后按序轮询
   APKPure → APKMirror → Uptodown
        │
        ▼
② 比对当前版本：无新版 → 结束；有新版 → 继续
        │
        ▼
③ 下载 APK：APKMirror → APKPure API → Uptodown
   （体积范围 + SHA-1/SHA-256 双重校验，任一不过即中止，绝不误发）
        │
        ▼
④ 创建 Release：tag=v18.600.7，asset 固定文件名（latest 链接永久有效）
        │
        ▼
⑤ 清理旧版本：删除除最新外的全部 Release 与 tag
```

- 每月 1 日另有 **Source Health Check** 工作流，巡检全部版本源的可用性，提前发现失效源。
- 检测/下载失败时流程自动跳过，不会发布错误版本。

## 目录结构

```
├── config/apk.json          # 单点配置：包名、当前版本、哈希、体积范围等
├── scripts/
│   ├── lib/
│   │   ├── version.js       # 版本解析 / 比较 / 校验
│   │   ├── config.js        # config/apk.json 读写
│   │   ├── http.js          # UA / 超时 / 重试
│   │   └── fetchers/        # 各版本源适配器（官方优先，多源冗余）
│   ├── check-version.js     # 检测最新版本
│   ├── download-verify.js   # 下载 + 校验
│   ├── publish.js           # 发布 Release
│   ├── cleanup.js           # 只保留最新 Release
│   └── self-test.js         # 无网络自测
└── .github/workflows/
    ├── weekly-check.yml     # 每周检测 + 自动发布（支持手动）
    └── source-health.yml    # 每月源健康巡检
```

## 本地运行

```bash
npm install
npm run self-test        # 无网络自测（模块与版本工具）
npm run check            # 检测最新版本
npm run download -- --version=18.600.7   # 下载指定版本
```

> 本地需要能访问 Google Play / 镜像站网络；发布（`npm run release` / `cleanup`）依赖 [GitHub CLI](https://cli.github.com/)。

## 配置说明（config/apk.json）

| 字段 | 说明 |
|---|---|
| `packageName` | 应用包名（`com.supercell.clashofclans`） |
| `currentVersion` | 当前已发布版本 |
| `apkAssetName` | Release asset 固定文件名（勿随意改动，README 下载链接依赖它） |
| `expectedMinSizeMb` / `expectedMaxSizeMb` | 体积校验范围，防止下载到错误文件 |

## 开源协议

本项目基于 [MIT License](LICENSE) 发布。

## 免责声明

- 安装包来自第三方镜像站（APKMirror 等），本仓库仅作自动转发与分发，版权归 Supercell 所有。
- 本项目为个人学习与交流用途，请勿用于商业行为。

## 常见问题

**为什么只保留最新版本？** 单个安装包体积较大（具体大小见最新版本信息表），若保留全部历史版本会持续占用 GitHub Release 存储，因此发布新版本时自动清理旧版本。

**版本号从哪里来？** 以 Google Play（官方源）为准，第三方源仅作冗余；多源返回不一致时以官方为准。
