# CODEX ATLAS · openai/codex 源码交互图鉴

把开源的 Codex CLI 拆到事件级的中文交互学习站。五个频道，五台仪器：

| 频道 | 页面 | 回答什么 |
|---|---|---|
| CH01 循环回路 | `labs/loop.html` | 一轮对话从 `codex` 命令到 TurnComplete 的 13 个阶段，单步可停 |
| CH02 输入组装 | `labs/prompt.html` | 一次 Responses API 请求的七层构成；AGENTS.md 层叠与 32 KiB 上限 |
| CH03 权限沙箱 | `labs/sandbox.html` | 三种模式 × 三套 OS 机制的判定矩阵与场景裁决器 |
| CH04 协议线路 | `labs/appserver.html` | App Server 的 JSON-RPC 双向通道；审批请求怎样挂起整轮对话 |
| CH05 Crate 图谱 | `labs/atlas.html` | 固定提交下 codex-rs 的 135 个成员，九条功能带 + 检索 |

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

本站为非官方学习项目，与 Open AI 无隶属关系。发现事实错误请提 issue，注明具体页面与依据。

## 部署

推送到 `main` 后由 GitHub Actions 自动部署到 Pages（`.github/workflows/deploy.yml`）。

## 许可证

MIT。上游 openai/codex 为 Apache-2.0；本站未复制其源码，只引用公开文档事实与其仓库内可复核的路径名。
