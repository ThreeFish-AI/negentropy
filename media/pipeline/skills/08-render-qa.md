# Stage ⑧ 草渲 + 抽帧 QA（skill 规格 · 08）

> 草渲的意义：半分辨率快速出片，把「时长/分镜/画面」问题在终渲前暴露。渲染缺陷的**七条红线**沉淀在 [06-remotion-implementation.md](./06-remotion-implementation.md)（SSOT，此处不复制）；本文件覆盖抽帧与自动体检的操作契约。

## 命令闭环

```bash
# 草渲（0.5x，jpeg 60——参数已固化在 remotion.config.ts + pipeline.toml）
uv run --no-project media/pipeline/scripts/pipeline.py --project media/<slug>-video render

# 抽帧三选一：幕抽样 / 指定句 / 末 N 句（尾幕渐黑缺陷的必查项）
# ⚠️ 草渲 --check 须带 --scale 0.5：字幕带/亮块间隔按全分辨率像素常数计算，不折算则判据双向失真
# ⚠️ 视频路径按 CWD 解析（非 --project 相对）——从仓库根调用须写 media/<slug>-video/out/draft.mp4
uv run --no-project --with pillow --with numpy media/pipeline/scripts/qa_frames.py \
    --project media/<slug>-video media/<slug>-video/out/draft.mp4 --scene P2 [--check --scale 0.5]
uv run --no-project --with pillow --with numpy media/pipeline/scripts/qa_frames.py \
    --project media/<slug>-video media/<slug>-video/out/draft.mp4 p6-11 p6-13b --check --scale 0.5
uv run --no-project --with pillow --with numpy media/pipeline/scripts/qa_frames.py \
    --project media/<slug>-video media/<slug>-video/out/draft.mp4 --last-n 6 --check --scale 0.5

# 主题对比度（零依赖，不需视频；新配色/改 theme.ts 后必跑）
uv run --no-project media/pipeline/scripts/qa_frames.py --project media/<slug>-video --check-theme
```

## 自动体检判据与处置

| 判据 | 级别 | 处置 |
|---|---|---|
| 黑帧/早渐黑（均值 <0.02；末 beat 且分镜标「渐黑」豁免） | FAIL | 查尾幕渐黑是否从**末 beat** 而非末句推导（skills/06 红线 4）；查 SceneFade 末幕是否误开淡出 |
| 字幕带侵入（字幕框 x 区间外有独立亮块） | WARN | 角标/图形挪出 bottom≥160px 安全区（角标一律绝对定位并写死 `bottom ≥ 150`） |
| 冻帧（相邻采样帧 16×16 指纹相同） | WARN | 查 beat 窗口是否错位/句子未被分镜覆盖（`check_script.py --check-scenes`） |
| 字幕缺失（字幕带无文字亮度像素） | WARN | 查该句 Subtitle 是否被遮挡或文本为空 |
| 主题对比度 <4.5:1 | FAIL | 换色或加深；概念色清单见 skills/06 视觉契约 |

**注意**：`--offset` 仅在草渲与终渲时间基准不一致时使用；每次重合成后**所有** beat 时间轴位移，抽帧样点必须从新 manifest 重推（工具自动做，但不要复用旧帧目录的旧结论）。

## 人工目检清单（自动体检之外的残余）

1. 色彩语义遵守本集契约（每个概念色的指代不串）；
2. 每个 beat 画面与分镜「画面/动效」列语义一致；
3. 金句卡排版（衬线体/居中/角标出处）。

## 修复回路

问题 → 改场景组件（或分镜/文稿）→ `tsc --noEmit` → 重草渲 → 复抽帧。**禁止跳过复检直接终渲**。
