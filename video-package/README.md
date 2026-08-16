# 视频制作包：《当 AI 开始给自己当老师》

> 基于 [arXiv:2607.13104v1](https://arxiv.org/html/2607.13104v1)《Self-Improvements in Modern Agentic Systems: A Survey》§5「Foundation Model Improvement」的 10–15 分钟深度科普视频完整制作包。
> 制作流程总览与各文件用法见下。

## 目录结构

| 文件 | 用途 | 何时用 |
|---|---|---|
| [01-topic-card/topic-card.md](./01-topic-card/topic-card.md) | 选题卡：标题、钩子、受众、封面、标签 | 发布准备 / 开拍前对齐 |
| [02-script/script.md](./02-script/script.md) | 完整逐字稿（段落 ID `N0–N6` 是全包 join 主键） | **最先定稿** → 录音 |
| [03-storyboard/storyboard.md](./03-storyboard/storyboard.md) | 分镜表（按场景分组，`shot_id` ↔ 动画场景一一对应） | 录音后切段 / 录屏时对照 |
| [03-storyboard/storyboard.csv](./03-storyboard/storyboard.csv) | 同内容 CSV 版 | 导入剪映 / 表格软件 |
| [04-animation/index.html](./04-animation/index.html) | 可录制动画 demo（3Blue1Brown 风格，8 场景） | 浏览器打开即可录屏 |
| [05-fact-check/fact-check.md](./05-fact-check/fact-check.md) | 事实核查表（每条断言 ↔ 论文锚点） | 定稿前 / 评论区对线时 |

## 推荐制作流程（五步）

```
① 定稿逐字稿 (02)          ← 全部下游文件以段落 ID 为锚
② 录旁白音频（按 N 段落分文件存放）
③ 打开 04-animation/index.html，逐场景录屏（快捷键见动画内右上角提示）
④ 剪辑：音频为主线，画面按 03 分镜表 cue 对齐音频段落
⑤ 发布前跑一遍 05 事实核查表，确认无 RISKY 遗留
```

**核心纪律**：旁白是单一事实源。先录音后录画面，剪辑时以音频为锚——分镜表的时间码是规划值（±3s 容差），以实际录音时长为准。

## 动画使用说明

- **打开方式**：双击 `04-animation/index.html`（macOS 默认浏览器即可，`file://` 直开，零依赖零联网）
- **快捷键**：`←/→` 切场景（切入即自动从头播放该场景）· 空格 暂停/继续 · `R` 重放当前场景 · `1–8` 直达场景 · `H` 显示/隐藏录屏辅助 UI
- **录屏建议**：窗口 1920×1080、60fps、隐藏光标；每场景独立录一段（切场景即重置，天然分段）
- **改文案**：所有中文文案（含各场景 `glyphs` 微标签，如「自产」「真数据」「快循环」等图内小字）均集中在文件内 `sceneText` 对象（单一事实源），改词不动动画逻辑；改完刷新页面即生效

## 三表互联关系

```
02-script 段落 ID (N0–N6)
   ├──→ 03-storyboard.narration_anchor   （镜头念的是哪段词）
   └──→ 05-fact-check.narration_anchor   （这段词里哪些是事实断言）
03-storyboard.scene_ref ←→ 04-animation 场景号 S0–S7（强制一致）
```

## 事实核查状态仪表盘

见 [05-fact-check/fact-check.md](./05-fact-check/fact-check.md) 顶部统计表；**定稿门槛：无 `RISKY` / 未处理 `REWRITE` 遗留**。

## 论文引用（IEEE 格式）

<a id="ref1"></a>[1] Z. Ren, Y. Chen, D. Guo, et al., "Self-improvements in modern agentic systems: A survey," *arXiv preprint* arXiv:2607.13104, Jul. 2026.

<a id="ref2"></a>[2] I. Shumailov, Z. Shumaylov, Y. Zhao, N. Papernot, R. Anderson, and Y. Gal, "AI models collapse when trained on recursively generated data," *Nature*, vol. 631, no. 8022, pp. 755–759, 2024.

正文引用示例：论文将智能体形式化为「大脑 + 装备」的配置<sup>[[1]](#ref1)</sup>；模型坍缩风险最早由《自然》研究实证<sup>[[2]](#ref2)</sup>。
