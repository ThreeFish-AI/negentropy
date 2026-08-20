# 自进化系列科普视频（作品总览）

> 机读 SSOT：[series.json](./series.json)（顺序变更只改它 + 视觉层；口播永不携带序号，
> 校验器 [check_series.py](./pipeline/scripts/check_series.py) 保证散文/组件与清单一致）。

| # | 作品 | 一句话主题 | 视觉契约（主色） | 源论文 | 状态 |
|---|---|---|---|---|---|
| 1 | [《上线之后，AI 才开始上学》](./experience-era-agents-video/README.md) | 部署之后经验怎么攒 | 金/青/紫 | 清华×Frontis 88 页综述（无 arXiv 号），2026-06 | **v3 就绪**（内容校准 + sunny-steady 全片重配，成片 14:01；源码含未重渲改动：P3 格阵落格校准） |
| 2 | [《AI 如何自己变强？》](./self-improving-agents-video/README.md) | 自我进化改什么 | 蓝/橙 | arXiv:2607.13104（Schmidhuber 团队），2026-07 | 就绪（待升级 sunny-steady，未排期） |
| 3 | [《会写代码的 AI，开始给自己写代码》](./self-evolving-coding-agents-video/README.md) | 代码领域全图 | 绿/洋红 | arXiv:2608.03392（NJUST×NJU），2026-08 | 就绪（源码含未重渲改动；待升级 sunny-steady） |

**系列纪律**：各集独立成片，口播互不引用、不出现集数序号——顺序只存在于本清单与片尾视觉卡片，发布顺序变更的 TTS 代价恒为零。

制作走 [公共管线](./pipeline/README.md)（九阶段）；配音经 IndexTTS-2.5 本人音色克隆（样本指纹见 [voices/refs.toml](./pipeline/voices/refs.toml)，手册 [VOICE-CLONING.md](./pipeline/VOICE-CLONING.md)）。
