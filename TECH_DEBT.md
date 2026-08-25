# TECH_DEBT · codex-atlas 技术债评估（2026-08-25）

> 评估方式：tech-debt 八类逐项 + 两轮全源码人工/代理审查 + Playwright 实测。
> 一句话结论：**不是屎山。是一个自律的单体**——约定统一、零依赖、仪器互相隔离；
> 有四笔真实债务，都在"长大之前"的可控期。

## 记分卡（9 类，满分 90）

| 类别 | 得分 | 最大问题 |
|---|---|---|
| 架构 | 7/10 | panel.js 1666 行 god-file（12+ 功能混居） |
| 代码质量 | 7/10 | canvas 仪器样板（size/dpr/IO/visibility）重复 7 次 |
| 测试 | 3/10 | 仓库内零测试；Playwright 回归脚本在仓库外的一次性目录里 |
| 文档 | 8/10 | README 详实 + 工具有 docstring；缺 CONTRIBUTING/CHANGELOG |
| 安全 | 9/10 | 无用户输入→innerHTML 通路；hash/localStorage 全容错；静态站无注入面 |
| 依赖 | 10/10 | 零运行时依赖（仅一条可失败的 Google Fonts 链接） |
| 基础设施 | 8/10 | CI 部署 + 周期基线核对齐备；无错误上报（静态站可接受） |
| 一致性 | 8/10 | 手势词汇/事件命名（ca:*）/token 体系统一 |
| 复核工具 | 9/10 | verify_baseline + crawl_baseline + 周报 issue |

**总分 69/90** —— 健康偏上，债务集中在"测试缺位"与"panel.js 体量"。

## 债务清单（按优先级）

### P1 · 测试不在仓库里（影响：高 / 工作量：S）
十几轮 Playwright 回归脚本都写在临时目录，人走茶凉。**修法**：把回归脚本收编进
`tools/e2e/`，加一条 `workflow_dispatch` 的手动 CI。这是唯一"高影响低工作量"项。

### P2 · panel.js god-file（影响：中 / 工作量：M）
1666 行装了：主题、PanelState、命令面板、导览、档案、XP、站宠、快捷键、scrubber…
按功能拆成 `assets/panel/*.js`（每个 IIFE 已经天然隔离，拆分是搬运不是重构）。

### P3 · canvas 样板重复（影响：中 / 工作量：M）
size()/dpr/IntersectionObserver/visibilitychange 四件套在 7 台 canvas 仪器里各写一遍。
抽一个 `CACanvas.mount(host, {draw, tick})` 基座可删 ~300 行。

### P4 · 无 lint 配置（影响：低 / 工作量：S）
ES5 手写纪律目前靠自觉。加 `.jshintrc` 或 eslint with es5 env 即可。

## 明确不是债务的部分
- **无构建步骤**是选择不是缺失：部署 = push，故障面为零
- **全局 window.CA\* API** 是刻意的仪器间总线，有命名约定，不是全局变量污染
- **ES5 风格**与目标浏览器策略一致，不是落后
