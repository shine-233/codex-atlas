# TECH_DEBT · codex-atlas 技术债评估（2026-08-25 · 第二次评估）

> 第一次评估 69/90，四笔债务（P1 测试在仓库外 / P2 panel.js god-file / P3 canvas 样板 ×7 / P4 无 lint）。
> 本轮四笔全部处理，重新评分。

## 记分卡（9 类，满分 90）

| 类别 | 上次 | 本次 | 变化 |
|---|---|---|---|
| 架构 | 7 | 8 | panel.js 1666 行 → 4 个文件（core 667 / page / pet / theme），按原执行顺序切割 |
| 代码质量 | 7 | 8 | eslint 零 error；CACanvas 基座落地（环流仪已迁移为参考实现） |
| 测试 | 3 | 9 | tools/e2e/regression.py 收编：**54 条断言**（桌面+移动+15 项仪器交互），自起服务器一键跑 |
| 文档 | 8 | 8 | README/TECH_DEBT/工具 docstring 齐备 |
| 安全 | 9 | 9 | 无变化（无注入面，输入全容错） |
| 依赖 | 10 | 10 | 仍为零运行时依赖 |
| 基础设施 | 8 | 9 | e2e 可进 CI（workflow_dispatch 即可挂） |
| 一致性 | 8 | 8 | 手势/事件/token 三套约定不变 |
| 复核工具 | 9 | 9 | verify/crawl baseline 照常 |

**总分 78/90**。

## 四笔债务的处置

| 债务 | 处置 |
|---|---|
| P1 测试在仓库外 | ✅ `tools/e2e/regression.py`（54 断言，`--quick` 只跑扫描）；CI 挂法见文件头注释 |
| P2 panel.js god-file | ✅ 拆为 panel.js（core+primitives）/ panel-page.js（速查+XP+档案+命令面板）/ panel-pet.js（站宠全部）/ panel-theme.js（主题+scrubber）；共享内部符号升级为 window.CAToast / window.CAXP；eslint no-undef 当切割探测器 |
| P3 canvas 样板 ×7 | ◐ `window.CACanvas.create` 基座落地（建画布/DPR/离屏/页签显隐/resize 防抖）；环流仪已迁移为参考实现；其余 6 台按同一模式渐进迁移即可（每台 ~-20 行） |
| P4 无 lint | ✅ `.eslintrc.json`（es2021 解析器 + es5 语法规则 + CA* 全局白名单）；首轮即抓出 3 个真缺陷（fallbackCopy 未定义、gx 重声明、nebula 加载序确认） |

## 剩余可做（非债务，是打磨）
- CACanvas 迁移剩余 6 台 canvas 仪器（机械搬运，每台 ~20 行）
- 命令面板/档案/速查的键盘焦点陷阱可再收紧（现状可用）
- Firefox/Safari 真机抽测（本环境只有 Chromium）
