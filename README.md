# CODEX ATLAS · openai/codex 源码交互图鉴

把开源的 Codex CLI 拆到事件级的中文交互学习站。编号 00 是总览，01–05 是五条线路，06 是术语速查：

| 线路 | 页面 | 回答什么 |
|---|---|---|
| 01 循环回路 | `labs/loop.html` | 一轮对话从 `codex` 命令到 TurnComplete 的 13 个阶段，单步可停；配会话建立段、重采样回路图（随阶段联动）与采样次数可调的成本对照 |
| 02 输入组装 | `labs/prompt.html` | 一次 Responses API 请求的七层构成；负载构成条、实时负载形状预览、AGENTS.md 层叠与 32 KiB 上限演示 |
| 03 权限沙箱 | `labs/sandbox.html` | 三种模式 × 审批策略 × 六动作的判定器、联动全景矩阵与判定管线、config.toml / CLI 片段生成器；三套 OS 机制对照 |
| 04 协议线路 | `labs/appserver.html` | App Server 双生命线时序图 + 报文时间线；审批请求怎样挂起整轮对话并分出批准 / 拒绝两条剧情 |
| 05 Crate 图谱 | `labs/atlas.html` | 固定提交下 codex-rs 的 135 个成员逐条注解，九条功能带 + 构成比例带 + 带间动线 + 检索高亮 |
| 06 术语速查 | `glossary.html` | 全站术语的一句话人话解释，可检索；正文里的虚线下划线词悬停即出卡片 |

## 全站交互

- 阅读进度条（顶部琥珀线）；区块滚动浮现；跨页 View Transitions（支持的浏览器自动启用）。
- 按 `?` 呼出快捷键速查；`Esc` 关闭弹层或清空搜索。
- 每页末尾 CHECKPOINT 成绩存本机 localStorage，首页线路卡上显示「自检 n/n」通关徽章。
- 站宠「小鳕」（右下角）：点一下游过屏幕并给一条真实使用提示；连点七下有彩蛋。与 Codex 词源无关，纯属谐音梗。
- 各仪器的状态持续写入地址栏 hash，刷新或分享链接不丢进度。

## 运行

纯静态站点：零依赖、无构建步骤、无外部脚本（仅 Google Fonts 一条可失败的链接）。

```sh
# 任意静态服务器均可
npx http-server . -p 8080
# 或
python -m http.server 8080
```

## 基线与证据边界

- 上游基线固定为 openai/codex main 提交 `343074d4207d572809bd8cea15f4be1d09d98e0b`（2026-08-22）。
- crate 数量（135）、星标数等数字为该日经 GitHub API 实测；上游持续变化，以固定提交为准。
- 内容来源分三类并在页内就地标注：① 仓库文件（可复核）；② OpenAI 官方博客《Unrolling the Codex agent loop》《Unlocking the Codex harness》；③ 社区源码研究，仅作交叉参考。
- 凡属推断或示意（报文形状、体积刻度），页面内均明确标注。本站不运行模型，不发起网络请求。

本站为非官方学习项目，与 OpenAI 无隶属关系。发现事实错误请提 issue，注明具体页面与依据。

## 部署

推送到 `main` 后由 GitHub Actions 自动部署到 Pages（`.github/workflows/deploy.yml`）。

## 许可证

MIT。上游 openai/codex 为 Apache-2.0；本站未复制其源码，只引用公开文档事实与其仓库内可复核的路径名。
