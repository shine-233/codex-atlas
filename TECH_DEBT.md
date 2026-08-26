# TECH_DEBT · codex-atlas 技术债评估（2026-08-25 · 第三次评估）

> 第一次 69/90（四笔债务入账）→ 第二次 78/90（P1/P2/P4 清偿，P3 落基座迁 1 台）
> → **本次 82/90（P3 全量清偿：7 台 canvas 仪器中 6 台迁入基座，1 台有意例外）**
>
> 2026-08-26 增量：测试 54→115 断言（下注拖拽 + dive 关键帧）、CI 挂 e2e、
> 核对工具 Windows 加固。详见文末「第四轮增量」。

## 记分卡（9 类，满分 90）

| 类别 | 首评 | 本次 | 备注 |
|---|---|---|---|
| 架构 | 7 | 8 | panel 四文件 + CACanvas 基座 |
| 代码质量 | 7 | 9 | eslint 0 error；canvas 样板 7 份 → 1 份基座 + 6 个调用方 |
| 测试 | 3 | 9 | 仓库内 54 断言套件 |
| 文档 | 8 | 8 | |
| 安全 | 9 | 9 | |
| 依赖 | 10 | 10 | |
| 基础设施 | 8 | 9 | |
| 一致性 | 8 | 9 | canvas 仪器生命周期统一走 CACanvas |
| 复核工具 | 9 | 9 | |

**总分 82/90**。剩余扣分项均为「有意选择」：无测试框架（54 断言自写套件够用）、
无错误上报（静态站）、星系视图保留定制生命周期（viewOn 双语义与 wake/sleep 纠缠，
基座化收益 < 回归风险，就地注释说明）。

## 四笔原始债务的最终状态

| 债务 | 状态 |
|---|---|
| P1 测试在仓库外 | ✅ tools/e2e/regression.py（54 断言，--quick 可选） |
| P2 panel.js god-file | ✅ 拆为 4 文件，e2e 全绿 |
| P3 canvas 样板 ×7 | ✅ CACanvas.create 基座；已迁移：折线仪/汇流图/状态机/力图/环流仪/404 示波器；例外：星系（生命周期定制，注释说明） |
| P4 无 lint | ✅ .eslintrc.json，0 error；首轮即抓 3 个真缺陷 |

## 第四轮增量（2026-08-26）

**已清偿 / 加固**

| 项 | 状态 |
|---|---|
| 交接未竟 #2 e2e 补断言 | ✅ +10：下注拖拽 4（把手几何按提交树常量推导，容差 ±2）+ dive 关键帧 6（pin 剖面三步走 + 渐进滚动站点浮现——瞬跳不触发 IO 是设计行为，测试模拟真实阅读节奏）。合计 115 |
| 交接未竟 #3 CI 挂 e2e | ✅ .github/workflows/e2e.yml（workflow_dispatch + PR 路径过滤） |
| 核对工具 Windows 崩溃 | ✅ GBK 控制台打 ⚠/✗ 直接 UnicodeEncodeError → stdout/stderr reconfigure utf-8；verify_baseline 另修 member_set 未赋值即引用（成员抓取失败时 deps 段 UnboundLocalError）、fetch 加指数退避重试 ×3；crawl_baseline 同款重试。本地核对从「跑不完」→ 可用 |
| GUESS WHO 赢局直达死按钮 | ✅ CA_LOCATE 引用嵌套 IIFE 内的 setView 必 ReferenceError → 发布 window.CA_SETVIEW + 调用守卫（356a17f 定向探测 11/11 拦截入库） |

**进行中：基线漂移**

- 上游 cbfd999 → **3ba7b694**（verify_baseline exit=2 确认；钉住提交下数字全对）
- 新基线数据已爬好：`tools/baseline-3ba7b694.json`（成员 **136→137**、内部边 **819→823**、
  新增成员 `worktree` 需归带写注解、TOP 榜与带间动线随 JSON）
- 正式换基线阻塞中：atlas.html 等文件被并行会话占用未提交；窗口一开按交接文档第四节流程走，
  数据粘贴级就绪

**遗留小项**

- CACanvas 收尾：折线/汇流/状态机 draw 入口补 `W = cc.W()`（force 模式一行），同受并行会话文件锁阻塞
