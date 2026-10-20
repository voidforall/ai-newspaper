# Release tickets：v0.1 执行清单

由 2026-10-20 Horizon 调研与 release 策略拆分；用户已确认执行至 v0.1。01–09 已发布为 [GitHub Issues #1–#9](https://github.com/voidforall/ai-newspaper/issues)，编号对应。每张 ticket 的完整交付行为、验收条件与范围边界见独立文件。10–11 仍是后续草案，不属于当前完成门槛。

01–09 是建议的 v0.1 发布链路；10 是可独立推进的连续事件优势；11 是试读与传播验证。单张完成可演示或验收，不把 schema/UI/测试拆成互相等待的水平任务。

| 编号 | 交付 | 阻塞依赖 |
| --- | --- | --- |
| 01 | [对齐发布基线并保留历史期刊](01-reconcile-release-baseline.md) | 无，可立即开始 |
| 02 | [真实 AI 编辑与明确的草稿/发布状态](02-honest-generation-state.md) | 01 |
| 03 | [让真实失败页面生成干净、可用的摘要材料](03-clean-source-material.md) | 01 |
| 04 | [上线有明确标准的 AI Builder 中文主栏目](04-ai-builder-editorial-policy.md) | 01 |
| 05 | [读者可展开关键事实的原文依据](05-inspectable-evidence.md) | 02、03 |
| 06 | [首页直接读当天，并提供舒服的手机阅读与新闻链接](06-read-todays-paper.md) | 01 |
| 07 | [从同一正式期刊生成 RSS 与可传播分享预览](07-rss-and-share.md) | 02、06 |
| 08 | [让新维护者按 README 发出第一份报纸](08-first-success-onboarding.md) | 02、03、04、05、07 |
| 09 | [验证 v0.1 候选版与连续七期内容质量](09-release-candidate-validation.md) | 02、03、04、05、06、07、08 |
| 10 | [给重点事件提供时间线、新增变化与更正](10-event-changes-and-corrections.md) | 05、06 |
| 11 | [用试读反馈验证定位，并准备公开发布素材](11-pilot-and-launch-kit.md) | 09 |

## 如何开工

先做 01，保护远端历史并确定可用基线。之后 02、03、04、06 没有相互硬依赖，可以按风险优先依次推进；依赖关系表示确实阻塞，不是规定只能串行。

09 需要七个真实发布日的观察，可以在期间完善素材，但不能提前宣称验收通过。10 不阻塞 v0.1 或 11；它上线后才能在发布文案中承诺完整事件追踪。

## 执行状态

GitHub 维护实际问题状态；[发布进度记录](../../release/progress.md)记录验证证据、提交、待验收事项和运行限制。实现按依赖推进，已完成代码不代表付费模型实测、连续七期与线上部署也已完成。

