# Horizon 一手资料调研

观察时间：2026-10-20（Europe/London）。代码快照：[`0eda588fb0486a4b183bb3c613d6f20548514505`](https://github.com/Thysrael/Horizon/commit/0eda588fb0486a4b183bb3c613d6f20548514505)，该提交时间 2026-10-19 14:58:48 +08:00。方法：直接浏览 GitHub、官方 demo/官网，并只读克隆、审查源码。未执行真实付费模型调用、未对全部外部抓取服务做可用性测试。本文「实现」指代码存在且路径可追踪，不代表所有集成都已实测。

## 判断

Horizon 已是成熟的「个人信息雷达工具包」，不只是 AI 日报生成脚本。值得借鉴的是配置化编辑规则、先筛后深加工、结构化引用、分阶段产物与简便上手。若我们追逐其来源数量、MCP、所有推送渠道，会进入它已有明显积累的竞争面。相对更值得验证的切口是「给 AI 工程师看的可信编辑出版物」：证据能追溯、每天讲清新增变化、持续跟踪事件、提供明确实用判断。后者是竞争推断，不是已被市场证实的结论。

## 实际能力与实现位置

| 能力 | 证据强度 | 观察 |
|---|---|---|
| 10 类来源 | README + 实现 | GitHub、HN、RSS、Reddit、Telegram、X、OpenBB、OSS Insight、GDELT、Google News；X 有 Apify 和 Playwright 两条路径。来源广度存在维护成本，不能等同于每次运行都可靠。 |
| 编辑 profiles | README + 实现 | `tech-news`、`tech-blog`、`ai-creator`、`finance-news`；JSON 声明内容块，Markdown 定义匹配、分析、扩写规则。来源可强制 profile、自动匹配、或限制候选集。阈值/去重等读者偏好放在 runtime config，而不是写死在 profile。 |
| 两阶段 AI | 实现 | 全量分类/评分/摘要后，先按阈值、语义主题去重和类别配额筛选，再为入选内容调用工具并生成内容块。昂贵加工发生在缩小集合之后。 |
| 两层去重 | 实现 | 先按规范化 URL 合并跨来源信息（去 tracking 参数，保留有意义查询参数），保留最长正文并合并其他来源评论；后按同 profile 中标题/摘要做 LLM 主题去重。它不是长期事件数据库。 |
| 阅读容量与多样性 | README + 实现 | `digest.max_items`、类别组配额、防单一主题挤占内容。 |
| 背景及讨论 | 实现 + demo | 可生成背景/影响/社区讨论；HN/Reddit/X 评论进入来源材料。不要把论坛意见误写成已核实事实。 |
| 历史检索 | 实现 + demo | 对本地 Markdown 日报做轻量 BM25，中文用 bigram，不需向量库。只检索当前内容日期之前的旧日报，排除当前 URL，最多三条；明确标注旧日报日期不是已验证事件日期。 |
| 结构化引用 | 实现 | `ArtifactSource` + `ContentBlock.source_refs`；生成后校验块与引用 ID，工具也按块允许调用。但这是引用完整性校验，不是逐句事实核验。 |
| 多模型与可靠性 | 实现 | Anthropic/OpenAI/Gemini/Azure 与多个兼容服务；provider chain fallback、并发限制、重试、token 用量。来源抓取有 success/empty/failure 报告，部分失败可继续、全部失败报错。 |
| 上手向导 | README + 实现 | TUI 收集模型配置和兴趣，匹配源、可选 AI 推荐，生成配置。源目录优先从官网 API 获取，失败回退本地，支持离线。 |
| 交付渠道 | README + 实现 | Markdown、本地存档、Jekyll/Pages、SMTP 邮件、IMAP 订阅/退订、Feishu/Lark/DingTalk/Slack/Discord/generic webhook、微信 iLink Bot。微信需要扫码且有回复限制。 |
| MCP | 实现 | inspect config、validate、fetch、score、filter、enrich、generate summary、run pipeline 等；每个 run 有 JSON 阶段快照和元数据，重写上游会失效下游。不要误认为原生 CLI 默认也持久化了所有阶段。 |

能力依据：[models.py](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/models.py)、[orchestrator.py](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/orchestrator.py)、[profiles](https://github.com/Thysrael/Horizon/tree/0eda588fb0486a4b183bb3c613d6f20548514505/profiles)、[enricher.py](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/ai/enricher.py)、[history.py](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/processing/history.py)、[tools.py](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/processing/tools.py)、[presets.py](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/setup/presets.py)、[MCP service](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/mcp/service.py)、[run store](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/mcp/run_store.py)。

## 架构的真正重点

核心数据链为 `ContentItem → ProcessingResult(classification, analysis, artifacts[language]) → ContentArtifact(blocks, sources) → Markdown`。Pydantic 约束统一数据对象；scraper/分析/扩写/渲染/投递分层。最终 `DailySummarizer` 是程序化渲染，避免末尾再调用模型把已确定材料重新写一遍。这是简单且值得学习的质量边界。[数据模型](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/models.py)、[summarizer](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/ai/summarizer.py)。

持久化以本地 JSON/Markdown 为主：配置、订阅人列表、日报、MCP run 的 raw/scored/filtered/enriched 文件；并非数据库驱动的多用户 SaaS，也未在本次审查中发现长期事件实体/版本化事实图谱。应将「没在所审查路径发现」与「证明全仓绝不存在」区分。[storage](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/storage/manager.py)、[run store](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/mcp/run_store.py)。

`web_search` 当前用 DDGS 返回最多三条搜索结果的标题/URL/snippet，再用于扩写；不能宣传为完整的原文证据审计。RSS 原文抽取另有 trafilatura 路径。该边界给我们留下「原始材料 → 明确事实 → 来源段落 → 编辑结论」的可验证性机会，但需要产品体验和评估证明优势。[tools](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/processing/tools.py)、[extractors](https://github.com/Thysrael/Horizon/tree/0eda588fb0486a4b183bb3c613d6f20548514505/src/extractors)。

## 发布成熟度

GitHub 官方页面本次观察显示 273 commits；`gh-axi repo view Thysrael/Horizon` 读取到 10,848 stars、1,648 forks、2 open issues、0 open PRs。它们只证明关注/派生行为，不能推导活跃读者、留存、收入或实际日运行量。[仓库](https://github.com/Thysrael/Horizon)。

截至观察时 GitHub Releases 页面为空，`pyproject.toml` 版本为 0.1.0；README 将发布 GitHub release 和 PyPI package 列为计划。因此它已获得广泛关注，但不能说已有规范版本发布体系。[Releases](https://github.com/Thysrael/Horizon/releases)、[pyproject](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/pyproject.toml)、[README](https://github.com/Thysrael/Horizon#project-status)。

已有 Python ≥3.11 / uv / editable pip / Docker Compose 的运行路径；Docker 使用非 root 用户。自带 daily workflow 模板但文件名 `.disabled`，需自行配置启用；另有 Pages 文档部署 workflow。当前 `.github/workflows` 只有这两份，未见自动测试 CI workflow。这不代表没有本地测试：`tests/` 覆盖配置、sources、去重、引用、MCP、投递、URL 安全等很多路径。[Dockerfile](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/Dockerfile)、[workflows](https://github.com/Thysrael/Horizon/tree/0eda588fb0486a4b183bb3c613d6f20548514505/.github/workflows)、[tests](https://github.com/Thysrael/Horizon/tree/0eda588fb0486a4b183bb3c613d6f20548514505/tests)。

MIT 许可允许复用/改造/分发，但复制实质代码须保留版权与许可；采用设计思想与直接复制代码要分别处理。[LICENSE](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/LICENSE)。

## 获得关注的可见做法

1. 清楚的个人收益定位、双语/日语 README、真实日报 demo、终端/邮件/飞书/微信截图，减少用户想象成本。[README](https://github.com/Thysrael/Horizon)、[live demo](https://thysrael.github.io/Horizon/)。
2. 配置向导把输入从「维护 JSON」改成「描述兴趣」，并接入社区源库。这个源库已经有客户端集成，不能当作纯 roadmap。[wizard](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/setup/wizard.py)、[presets](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/setup/presets.py)。
3. 官网自称有 420+ 人参与、86 个 curated sources，并突出贡献、投票和 source discovery。数字是第一方自述，未取得其后端统计独立验证。[官网](https://www.horizon1123.top/)。
4. README 明确感谢 LINUX.DO、HelloGitHub、小红书 AIGC Link 的推广，并给出 QQ 社区与源贡献入口；也已有多个模型 API 赞助展示。可判断它采用了社区分发/合作，而不能证明某一渠道造成了多少 stars。[README community/acknowledgements](https://github.com/Thysrael/Horizon#community)。

仓库中 `docs/horizon-hub-design.md` 提出基于运行质量数据形成 source 评分网络的护城河，但这属于设计文档；已证实的是官网 source catalogue 与 CLI 的 preset 拉取，本次未发现客户端自动回传质量数据的实现。不要把设计稿的网络效应描述成已建成壁垒。[Hub design](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/docs/horizon-hub-design.md)。

## 应借鉴与避开

优先借鉴：统一内容对象/引用对象；明确编辑规范；先筛后研究；最终确定性渲染；运行报告与失败显式化；一条命令看到真实样例；可回放的阶段产物。它们服务内容可信度和维护性，且不必照搬整套 Python 架构。

谨慎借鉴：MCP、微信、金融/OpenBB、十几种推送、源市场。这些有真实价值，但只有当我们的目标用户明确需要时才进入 release 范围。当前更有力的差异是把「每天列出值得读的内容」推进成「相对昨日到底变了什么、证据是什么、对我的工作意味着什么」。历史检索 Horizon 已有，所以单纯加历史链接不足以构成独特优势；应以事件连续性、变化记录、来源证据和用户可验证的编辑判断建立差别。

## 深一层的差异化边界：哪些不能再算独特，哪些值得实测

- **历史记忆、背景、为什么重要，都已存在。** 2026-10-20 官方 demo 实际将旧日报用于今日背景，包含数月前的报道链接；不能把「带历史上下文的日报」单独当我们的差异。[当日官方样例](https://thysrael.github.io/Horizon/2026/10/20/summary-zh.html)（若 permalink 改变，可从 [demo 首页](https://thysrael.github.io/Horizon/) 点击该日期）。
- **引用仍是 block 级，未到 claim 级。** `ContentBlock` 有一段 `content` 和多个 `source_refs`，没有逐条可验证 claim、来源摘录位置、支持/反对关系、事实状态等字段。校验检查未知 ID / 允许来源，不能保证句子获得证据支持。机会是让用户点开每个关键数字/结论看到原文片段与出处，并将「来源说了什么」「编辑推断」「仍未知」明确分开。[models](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/models.py)、[enricher validation](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/ai/enricher.py#L463)。
- **已发现一个可以复查的块间一致性问题。** 10 月 20 日 Timestral 条目的主摘要称现有材料未给模型规模/访问方式等；同条背景/影响块随后列出 5M–209M 四种规模、CPU 推理、HF checkpoint 和 GitHub 代码。这至少说明「材料缺口陈述」未与后续检索新增信息一致更新；不必断言其原始新闻事实为假。我们可以用最终文章的跨块事实一致性检查证明质量优势，而不能只再加一个背景栏。[官方当天样例入口](https://thysrael.github.io/Horizon/)。
- **事件时间线需要比历史搜索更深。** `ContentItem.id` 是来源原生 ID，主题去重只针对本次候选列表。当前模型中没有跨日稳定 event ID、已知事实版本、昨日/今日变化字段。稳定事件页 + 新证据驱动的 delta（首次发布、开放 API、第三方验证、纠正旧说法），比泛泛历史联想更有可辨认价值。此判断来自审查模型/去重/历史模块，不是对其他未审查服务的穷尽否定。[models](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/models.py)、[orchestrator](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/orchestrator.py#L631)。
- **MCP checkpoint 是 run 快照，不是可验证内容缓存。** 重写一个阶段会删除其下游 JSON/summary 并清理相关 meta，解决 stale downstream；但未见按输入内容哈希、prompt 版本、模型参数形成跨 run 的有效缓存键，也不能据此保证重跑完全可复现。CLI 主流程未直接采用该 run store。我们的 release 优先需要运行 manifest、明确失败状态和安全发布门槛，不一定需要先做 MCP。[run store](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/mcp/run_store.py)。
- **故障处理已有工程深度，仍有编辑层缺口。** 来源部分失败有报告；分类失败会用 fallback profile；分析 JSON 修复失败设 `score=None`；主题去重失败保留原候选；扩写按 item 记录失败，最终可回退分析内容。工具搜索失败返回空数组。可学习的是失败显式化；不能将「pipeline 成功」等同于「每条达到发布质量」。应定义何种证据缺口阻止发布，何种允许降级但须明确显示。[classifier](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/ai/classifier.py)、[analyzer](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/ai/analyzer.py)、[enricher](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/ai/enricher.py)、[tools](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/src/processing/tools.py)。
- **评分规范可迁移，评分标尺未证明可比较。** `analysis.md` 是自然语言 0–10 分档（技术深度、新颖性、影响、来源质量等），能独立复制/分享/版本化；但不同 profile 各用自己的目标，换模型/来源后分数不自动可校准。没有本次审查发现的公开标注评估集证明其排序质量。我们应优先用少量真实候选建立编辑标注和回归样例，观察重要新闻漏选/营销误选，而不把 8.7 分这样的精度包装为客观事实。[tech-news rubric](https://github.com/Thysrael/Horizon/blob/0eda588fb0486a4b183bb3c613d6f20548514505/profiles/tech-news/analysis.md)。
