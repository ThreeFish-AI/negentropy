# Stage ⑥ TTS 配音：声音克隆决策树（skill 规格 · 07）

> 目标读者：执行配音阶段的代理/操作者。**参数与实测数据一律以 [VOICE-CLONING.md](../VOICE-CLONING.md) §三–§六为准（链接非复制）**；本文件只承载操作顺序与决策点。

## 决策树（按序过闸，任何一闸不过不进长跑）

1. **样本就位？** `uv run --no-project media/pipeline/scripts/refs.py list` → 缺失则 `refs.py rebuild --name <样本>`（源录音是本人私有文件，路径记录在 `voices/refs.toml`）。
2. **指纹一致？** `refs.py verify --name <样本>` 必须全绿——sha1 与清单不符说明源文件/裁剪参数变了，**勿在未核验音色上烧 10 小时**；新样本须先过第 4 步试听再回填清单。
3. **风格定档？** 首次/换风格必过小样 A/B：`tts_sample.py --ref <样本> --all-styles --play`；再用**领航片段**（本集最难的 6–8 句：长分句/枚举清单/带小数点数字）在该风格下整句合成试听。听完 `--cleanup` 或 `pipeline.py clean-samples`（生物特征）。
4. **排期对账？** `pipeline.py tts --plan`（纯本地）：待合成句数 × 束宽档 + 墙钟估算。ETA 与预期差 >15% 先查机器负载。
5. **音色签名护栏**：与上次合成不一致会被 `.engine` 标记硬拦（显式 `--allow-voice-switch` 才放行）——这正是防「README 旧命令静默重录整集」的机制。

## 两遍法（长片的既定工作法）

草稿遍 `--style sunny`（快 ≈3.4×）拿真 manifest 校时间轴与分镜 → 定稿遍回到成片档（`sunny-steady`，beams=3）。**改稿只废改动句；换档全量重合成**（摘要含 style/ref/束宽，见 VOICE-CLONING §六）。B 遍必须在文稿字节冻结后启动。

## 调用形态

- 编排入口（参数读自各集 `pipeline.toml`）：`uv run --no-project media/pipeline/scripts/pipeline.py --project media/<slug>-video tts [--plan|--style sunny]`
- 直接薄包装（工程内）：`uv run --no-project --with mutagen scripts/tts.py --engine indextts …`（须带 `--expect-ref-sha1`，编排入口会自动带上）
- 服务端启动命令由 `tts.py`/`tts_sample.py` 在不可达时自动打印（可直接粘贴），手册见 [VOICE-CLONING.md §二](../VOICE-CLONING.md)

## 完成门（交给 Stage ⑧ 前）

- manifest 句数 = narration 句数；`pipeline.py check` 的实测时长口径落在预算窗内；
- sidecar `{id}.sha` 逐句齐备（断点续跑的依据）；`.engine` 标记已更新。
