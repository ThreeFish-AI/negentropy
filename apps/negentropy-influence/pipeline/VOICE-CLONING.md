# 科普视频配音 · 声音克隆操作手册（IndexTTS-2.5）

> **文档定位**：本文是公共视频管线声音克隆能力（用自己的声音配音 + 轻快/自信/正能量等风格控制）的**单一参考**——回答「怎么用现有能力做完一集」。
> 上游能力面、机制循证与提升路线图见进阶篇 [INDEXTTS-2.5-ADVANCED.md](./INDEXTTS-2.5-ADVANCED.md)（不复制本文参数值，只做映射与解释）。
> 管线总纲见 [README.md](./README.md)；参考音色样本目录约定见 [voices/README.md](./voices/README.md)；读音标注台账见 [PRON-GLOSSARY.md](./PRON-GLOSSARY.md)。

## 目录

1. [总览与架构](#一总览与架构)
2. [一次性部署（index-tts + 模型）](#二一次性部署index-tts--模型)
3. [参考音色样本](#三参考音色样本)
4. [风格与参数](#四风格与参数)
5. [小样试听与逐集合成](#五小样试听与逐集合成)
6. [缓存与幂等](#六缓存与幂等)
7. [故障排查](#七故障排查)
8. [许可与合规](#八许可与合规)
9. [备选方案与参考文献](#九备选方案与参考文献)

## 一、总览与架构

**能力**：用一段 **10–14 秒**（硬上限 15 秒）的本人录音作为参考音色，零样本（zero-shot）克隆出本人音色，逐句合成整集配音；并通过情感向量注入轻快、自信、正能量等风格。整集要跑数小时，故**定稿前先用单句小样试听择优**（§5.1），再全量合成（§5.2）。

**架构**（管线脚本轻依赖 与 重型推理环境 完全解耦）：

```mermaid
flowchart LR
    subgraph 管线侧["本仓 pipeline（轻依赖）"]
        A["tts.py<br/>--engine indextts"] -->|"HTTP 127.0.0.1:8766<br/>逐句 POST /synthesize"| B
        S["tts_sample.py<br/>单句小样试听"] -.->|"单次 POST /synthesize"| B
    end
    subgraph 推理侧["~/tools/index-tts（重依赖：torch/indextts）"]
        B["tts_server.py<br/>FastAPI + IndexTTS-2.5"] --> C["模型常驻内存<br/>MPS 串行推理"]
        C --> D["22.05kHz WAV"]
        D --> E["MP3 编码<br/>soundfile / lameenc"]
    end
    B -->|"MP3 bytes<br/>X-Audio-Format 头"| A
    A --> F["{id}.mp3 + manifest.json<br/>Remotion 时间轴自动重算"]
    S -.-> G[".temp/voice-samples/{风格}.mp3<br/>afplay 试听择优"]
```

**契约不变**：无论哪个引擎，输出仍是 `<工程>/video/public/audio/{id}.mp3` 与 `manifest.json`（`durationSec` 为实测时长），下游（Remotion 场景、字幕、抽帧 QA）零改动。

## 二、一次性部署（index-tts + 模型）

### 2.1 磁盘预算

| 项 | 占用 |
|---|---|
| index-tts 仓库 + uv 虚拟环境（含 torch） | ~4.5 GB |
| IndexTTS-2.5 checkpoints（含首跑自动下载的辅助模型） | ~6.5 GB |
| **合计** | **~11 GB**（本机部署前请确认剩余磁盘 ≥ 15 GB）


### 2.2 步骤

```bash
# 1) clone 仓库（仓库外，避免污染本仓）
mkdir -p ~/tools && cd ~/tools
git clone https://github.com/index-tts/index-tts.git
cd index-tts

# 2) 创建环境（uv 自动安装 Python 3.11 并锁定依赖；--all-extras 会装 webui 依赖，此处省磁盘不装）
uv sync

# 3) 下载模型（~6 GB，支持断点续传：中断后重跑同一命令即继续）
uv run hf download IndexTeam/IndexTTS-2.5 --local-dir checkpoints
# 网络不通时换 ModelScope 镜像：
#   git clone https://www.modelscope.cn/models/IndexTeam/IndexTTS-2.5.git checkpoints
```

### 2.3 启动推理服务

在 index-tts 根目录：

```bash
cd ~/tools/index-tts
uv run --frozen --with fastapi --with uvicorn --with soundfile --with numpy --with lameenc \
    python <本仓绝对路径>/$R/tts_server.py \
    --model-dir checkpoints --indextts-version 2.5 --host 127.0.0.1 --port 8766 \
    [--use-qwen-emo]   # 可选：加载 QwenEmotion（0.6B，约 +1.5 GB 内存），启用 --emo-text 自然语言情感
```

- 启动即加载模型（约 30–60 秒），出现 `>> 就绪：IndexTTS-2.5 device=mps ... emo_text=on|off` 后可服务请求；
- 健康检查：`curl http://127.0.0.1:8766/health` → `{"ok": true, "version": "2.5", "device": "mps", "synthesizing": false, "dtype": "fp32", "encoder": "soundfile", "supports_duration_factor": true, "supports_emo_text": false}`（MPS 上 dtype 恒为 fp32，属预期；`supports_emo_text` 随 `--use-qwen-emo` 变化）；
- **仅监听 127.0.0.1、无鉴权，勿暴露公网**；`ref_path` 为服务端本地绝对路径。


### 2.4 部署问题与兜底

| 症状 | 处理 |
|---|---|
| `uv run --with` 报依赖解析冲突（与 gradio/torch 锁冲突） | 先 `uv pip install fastapi uvicorn soundfile lameenc` 装进 checkout 的 venv，再 `uv run --no-sync python ...` 启动 |
| `uv run --frozen` 报锁不同步 | 去掉 `--frozen`（仅当 checkout 的 uv.lock 与 pyproject 状态异常时） |
| `--use-qwen-emo` 启动失败：`no file named model.safetensors ... qwen0.6bemo4-merge/` | 首轮 `hf download` 只落了该子目录的 config/tokenizer，权重（1.19 GB）缺失。补齐：`cd ~/tools/index-tts && uv run hf download IndexTeam/IndexTTS-2.5 --include "qwen0.6bemo4-merge/*" --local-dir checkpoints`（约 20 秒），再带 `--use-qwen-emo` 重启 |
| HF 下载超时/中断 | 重跑 `hf download` 即续传；或改用 ModelScope（见 2.2） |
| 下载中途「假死」（进程在但字节零增长，连接 CLOSE_WAIT） | 强杀进程重跑即可续传：`pkill -f "hf download"` 后重复 `uv run hf download ...`；可循环重试直至完成 |
| 磁盘不足 | checkpoints 可与其它 index-tts 部署共享（启动时 `--model-dir` 指向同一目录） |

## 三、参考音色样本

### 3.1 要求

| 项 | 要求 |
|---|---|
| 时长 | **10–14 秒**（**硬上限 15 秒**：上游 `infer_v2_5.py:396-408` 只取前 15 秒、静默丢弃尾部且无日志，故 >15s 的样本有一部分永不进模型；`prepare_ref.py` 已收紧到 15.0 并硬失败。文献侧 speaker similarity 在 ~10s 后饱和） |
| 内容 | 自然说话，**与目标成片语速/语调一致**——韵律风格会被一并克隆，样本定基线、情感向量只能在基线上微调（实测见 3.3） |
| 环境 | 安静房间、固定麦克风距离、无 BGM/混响/系统降噪痕迹 |
| 说话人 | 仅本人一人 |
| 格式 | WAV 16-bit ≥22.05kHz 优先（mp3/flac 经 `prepare_ref.py` 转换；m4a 需先 `ffmpeg -i in.m4a out.wav`） |

### 3.2 长录音裁剪（prepare_ref.py）

```bash
# 从长录音截取 [180s, 192s) 共 12s，归一化峰值、转 16-bit 单声道 WAV，输出到 voices/
uv run --no-project --with soundfile --with numpy \
    $R/prepare_ref.py ~/Documents/dify/me-1.mp3 --start 180 --duration 12
# → $V/me-1.wav（此段即已上线三集成片所用样本，sha1 3ed0d9d60d4b）
```

裁剪段须试听确认（`afplay $V/me-1.wav`）：该段人声干净、无背景音乐、语句完整。样本 SHA1 参与缓存摘要（见 §六），替换样本自动失效缓存。

**选段辅助**——长录音里挑哪一段？用 [scripts/prospect_ref.py](./scripts/prospect_ref.py) 按滑窗扫客观指标（F0 中位=音高、F0 起伏=语调、音节率=语速、谱质心=明亮度，并对静音过多/发声过少扣分），先筛候选再试听：

```bash
uv run --no-project --with soundfile --with numpy $R/prospect_ref.py \
    ~/Documents/dify/me-1.mp3 ~/Documents/dify/me-2.mp3 --window 12 --top 4
# 输出可直接当 prepare_ref.py 的 --start 用；多个文件会放在同一把尺子下排序
```

分高只代表「不小声、不平、不慢」，**不代表段落好**（成片在用的 180s 段综合分仅排 157/275）；真正的判据是人声干净、单说话人、语句完整、语速语调贴近目标成片——只能靠试听定夺。

**保真度与风格是正交的两件事**（2026-08-20 新增）：上面那套评分只回答「亮不亮、快不快」，完全不看音质；而保真度损伤**事后无法弥补**（事后增强能提升 UTMOS 却降低说话人相似度）。故 `prospect_ref.py` 另有一组只做否决、不进加权的指标——削波、底噪绝对电平、动态范围（SNR 代理）、DC 偏置、有效带宽（识别低码率转码）——在候选表里以「保真旗标」列呈现。**新录的样本请先过验收模式**：

```bash
uv run --no-project --with soundfile --with numpy \
    $R/prospect_ref.py --accept <候选1.wav> [<候选2.wav> …]
# 整段评估（不滑窗）：保真度硬结论 + 风格参考值 + 超 15s / 低带宽告警
```

通过保真度的候选再各跑一次 `--style neutral` 纯克隆小样比风格（合格线针对**小样**：F0 中位 ≥155 Hz 且起伏 ≥34，即「换段落所能拿到的最好水平」的九成）。

### 3.3 样本决定基线：换段落比调参数更管用（实测）

若合成结果「不够轻快/不够阳光」，**先怀疑样本，再怀疑向量**。2026-08-19 在同一位说话人的 4 段录音上做 12s 滑窗勘探（指标：F0 中位=音高、F0 四分位距=语调起伏、音节率=语速、谱质心=明亮度），并对每个候选样本做**纯克隆**（`--style neutral`，不注入任何情感）小样：

| 候选样本（12s） | 样本 F0 中位 | 样本起伏 | 样本音节率 | 样本质心 | → 纯克隆小样 F0 | 小样起伏 | 小样质心 |
|---|---|---|---|---|---|---|---|
| me-1 @180s（**成片在用**） | 142.2 Hz | 31.2 | 4.42 | 1698 Hz | 140.4 Hz | 26.2 | 1120 Hz |
| me-1 @0s | 161.6 Hz | 36.4 | 4.67 | 1728 Hz | 157.5 Hz | 34.1 | 1181 Hz |
| me-1 @28s | 153.8 Hz | 25.5 | 4.75 | **1898 Hz** | **163.3 Hz** | 35.2 | 1286 Hz |
| me-2 @172s | 151.3 Hz | **38.9** | **4.92** | 1840 Hz | 145.1 Hz | 32.8 | 1152 Hz |
| me-3 @48s | 156.9 Hz | 31.8 | 4.83 | 1765 Hz | 156.4 Hz | 36.4 | 1268 Hz |

结论：**成片在用的那一段恰好是说话人自己最低、最平、最暗的一档**（综合分排名 157/275），换一段同一人的录音即可让克隆音的音高 +12~16%、语调起伏 +25~40%、明亮度 +5~15%——这个幅度靠情感向量很难补回来，且向量越加越假（见 §四）。所以定式是：**`prospect_ref.py` 挑 3–4 段候选 → `prepare_ref.py` 各裁一份 → 各跑一次 `--style neutral` 小样比对 → 选定样本后再谈风格。**

> 最省力的做法其实是**重录一段 10–15 秒的目标风格样本**：用你想要的那种语气念一段自己视频的开场逐字稿（比平时略快、句尾略上扬、带笑意），克隆会把这份韵律一起继承，之后连情感向量都可以只加一点点。

## 四、风格与参数

**情感有三个来源，互斥，只能给一个**（客户端与服务端双向校验；上游对「向量 + 情感音频」是**静默丢弃音频**，本管线改为显式报错）：

| 来源 | 开关 | 机制 | 适用 |
|---|---|---|---|
| **向量注入** | `--style` / `--emo-vector` | 8 维情感基向量加权混合，强度由 `--emo-alpha` 控制 | 要可复现、可微调的确定性风格 |
| **语调迁移** | `--emo-ref <另一段录音>` | 音色仍取 `--ref`，**语调/情绪整体迁移自这段录音** | 觉得向量注入「有合成味」时的首选；用本人一段本来就轻快的录音最自然 |
| **自然语言** | `--emo-text "轻快爽朗、自信阳光"` | 服务端 QwenEmotion 把描述转成向量（需启动带 `--use-qwen-emo`） | 说不清参数、只说得清感觉时；推出的向量会回显，可再用 `--emo-vector` 固化 |

**为什么「少注入」往往更自然**：上游把情感嵌入按 `emovec = Σ(wᵢ·基向量ᵢ) + (1 − Σwᵢ) · 参考音频情感` 混合（`indextts/infer_v2_5.py:766-767`，`wᵢ` 为 alpha 缩放后的分量）。可见 **Σw 就是「合成情感」挤掉「本人真实情感」的比例**：Σw=0.7 时只剩 30% 是你自己的语调；Σw>1 更会让参考音频项变成**负权重**（发音劣化）。听感偏假时，先把 `--emo-alpha` 往下调（0.3–0.45），而不是继续加权重。

> ⚠️ **口径校准（2026-08-20 核验上游源码）**：本管线的有效和护栏 `Σvec×alpha ≤ 0.8` 是**我们自定的**，
> 不是上游行为。上游 `infer()` **从不做归一化**——`normalize_emo_vec` 全仓唯一调用点是
> `webui.py:665` 的「自定义向量」分支，且那条的 0.8 作用在**已乘 `emo_bias` 的和**上、且在
> alpha 之前。`emo_bias`（`infer_v2_5.py:493` 硬编码）8 维**严重不等权**：
> `sad/afraid=1.0 > happy/disgusted/melancholic=0.9375 > angry=0.875 > surprised=0.6875 > calm=0.5625`。
> 后果：从社区/WebUI 抄来的 `(vec, alpha)` 在本管线上实际**强 16%–33%**（含 `calm` 越重偏差越大，
> `confident` 档最失真），**跨来源参数迁移必须重新试听定档**。
> 另：`alpha` 恰好等于「替换掉本人语调的百分比」**仅当名义向量和 = 1.0** —— `sunny`/`passionate`
> 刚好是 1.00，`lively`(0.85)/`confident`(0.90)/`positive`(0.95) 不是，其 alpha 跨预设不可比。
> 机制与数值推导见 [INDEXTTS-2.5-ADVANCED.md](./INDEXTTS-2.5-ADVANCED.md) §3。

### 4.1 风格预设（--style）

| 预设 | 定位 | emo_vector（顺序：happy, angry, sad, afraid, disgusted, melancholic, surprised, calm） | alpha | 有效注入 | df | 束宽 |
|---|---|---|---|---|---|---|
| **sunny 明快阳光** | **日常/批量推荐位**（2026-08-19 试听定档） | happy=.95, surprised=.02, calm=.03 | **0.35** | **0.35** | 0.95 | 1 |
| **sunny-steady 明快稳健** | **成片定稿推荐位**：同上但韵律更收敛，代价是慢 2–5 倍 | 同 sunny | 0.35 | 0.35 | 0.95 | **3** |
| neutral | 中性（默认） | 不注入情感，纯克隆参考音色 | — | 0 | 1.0 | 1 |
| passionate 激情 | 充满激情与轻快 | happy=.70, surprised=.20, calm=.10 | 0.7 | 0.70 | 0.97 | 1 |
| lively 轻快 | 明快跳跃 | happy=.55, surprised=.15, calm=.15 | 0.6 | 0.51 | 0.95 | 1 |
| confident 自信 | 沉稳有力 | calm=.65, happy=.25 | 0.7 | 0.63 | 1.05 | 1 |
| positive 正能量 | 昂扬向上 | happy=.75, calm=.20 | 0.7 | 0.665 | 1.0 | 1 |

> **两个候选档（2026-08-20 新增，尚未定档）**：`sunny-pure`（happy 单载，砍掉 sunny 里
> 有效强度仅 0.5625/0.6875 的 calm/surprised 配料）与 `sunny-clear`（= `sunny-steady`
> 但 df 1.05，护术语密集句的清晰度——df 方向勘误见 §4.3）。二者是**新增**而非改动生产档，
> 故对已上线三集的缓存零影响；定档前须按
> [INDEXTTS-2.5-ADVANCED.md §6.5](./INDEXTTS-2.5-ADVANCED.md) 的测量协议做 A/B + 人耳确认。

预设可自带**束宽**（`STYLE_PRESETS` 的可选键 `beams`，缺省 1）——束宽改变韵律稳定度，属风格的一部分；命令行 `--num-beams` 显式给值时优先（故其 argparse 默认值是 `None` 而非 `1`，否则无法区分"没给"与"给了 1"）。`--list-styles` 会打印全部七档的向量/alpha/有效注入/语速/束宽。

> **`sunny-steady` 的来历**：与 `sunny` 同方向同强度同语速，只把束宽 1→3。同文本同样本实测：语调起伏 **48.4 → 43.5**（更收敛、更"稳"）、音节率 4.10 → 4.55，而亮度基本不掉（谱质心 1245 → 1223）——是目前唯一"不牺牲明快度就让语气更可信"的旋钮。代价是 GPT 段耗时按束宽放大：单句墙钟由 20–35 秒变为 **56–131 秒**（同机同参两次实测的区间，受机器负载影响大），整集排期须按 §4.3b 的 3 束口径乘上去。

> **`sunny` 的来历**（也是一份调参范例）：方向由 QwenEmotion 对「轻快、爽朗、自信、阳光」推出——happy 近乎独载；但 Qwen 的原始强度会顶到 Σ=0.8 上限，实测把克隆音高推到 **199–223 Hz**，而该说话人自然区间只有 142–163 Hz，听感"像另一个人在用力"。**保留方向、把强度压到 0.35**（留 65% 给本人真实语调）+ `df 0.95` 后即为 `sunny`。**该档在 `voices/me-bright.wav` 上定档**（`prepare_ref.py ~/Documents/dify/me-1.mp3 --start 0.36 --duration 12`），换回更闷的样本会失去明快感（见 §3.3）。定式可复用：**Qwen 选方向 → 人工压强度 → 固化成预设**。

### 4.2 自定义向量（--emo-vector）

`--emo-vector "happy:0.6,calm:0.2"` 语法覆盖预设；与 `--style` 非默认值互斥。**各分量非负，且有效和（Σ分量×emo-alpha）≤ 0.8**（客户端与服务端双重校验；管线直调 `infer` 不做自动归一，超界会拒绝请求；如 `happy:1.0` 在 alpha=0.6 下有效和 0.6，可放行）。

`--emo-alpha` 本身只被上游 clamp 到 `[0, 1]`（`infer_v2_5.py:605`）——**0.8 是「向量总和」的上限，不是 alpha 的上限**，此前把两者混为一谈的「alpha ≤0.8 推荐（官方建议）」表述已更正；该 0.8 的来源见 §四 的口径校准块。实操上真正该盯的是**残差保留率** `1 − Σ(w·α)`：想保住 ≥60% 本人语调就让 `Σ(w·α) ≤ 0.40`，这与实测「≥0.6 开始像另一个人、0.3–0.45 是平衡带」（§4.4）互相印证。

### 4.3 语速（--duration-factor）

0.5–2.0（>1 变慢、<1 变快）。仅 v2.5 支持；`--emo-vector` 模式默认 1.0（手动传 df 需服务为 v2.5）。

**它改的是什么**：S2M 阶段的时间轴重采样（`infer_v2_5.py:832`，`F.interpolate(mode='nearest')` 把已生成完的语义 token 序列拉伸/压缩到目标梅尔帧数；常数 1.72 = 梅尔帧率 86.13 ÷ 语义特征帧率 50）。因此语速与总时长是同一件事、无法解耦，且**整段均匀**伸缩。它**不做**信号域重采样、`f0_condition: false`，故不会出现「花栗鼠」式音高偏移；也**不消耗** mel token 预算（放慢语速不会提高溢出风险）。

> ⚠️ **方向校准**：`df<1` = 更快 = 每个音素分到的时间更短 = 咬字**更紧更糊**。此前
> `passionate` 档注释写的「df 0.97 护密集技术句清晰度」**方向是反的**——护清晰度的正确
> 方向是 `df>1`（可试 1.03 / 1.05，上限建议 1.10，再大会出现拖腔）。数值本身与「激情=略快」
> 的定位自洽，故预设未改，只更正因果表述。

### 4.3b 束搜索宽度（--num-beams，速度主旋钮）

GPT 声码段的束搜索宽度，**缺省随风格**（多数预设 1、`sunny-steady` 为 3；上游库内部默认 3）。采样生成（`do_sample=True`）下 1 与 3 的听感差异可忽略。

> ⚠️ **「线性放大」这个说法在 MPS 上不成立**（2026-08-20 本机分段 profile 校准）。束宽只作用于
> T2S（S2M 入口的 `codes` 形状与束宽无关），而 MPS 上 T2S 只占三段耗时的 **18–46%** ——
> 用服务端内建计时器实测 13 个样本：`s2mel` 反而占 **45–73%**、`bigvgan` 6–9%。整集口径
> 1→3 束仅 **+4%**（EP1 v3 两遍法 1.9h → 1.98h）。正确表述是：**CUDA 上近线性放大，
> MPS 上近乎免费**。机器忙/热节流时仍会出现数倍差（下文 2026-08-18/19 那批就是忙时口径），
> 此时才需要 `--steady` 混合档。分段占比与瓶颈分析见
> [INDEXTTS-2.5-ADVANCED.md](./INDEXTTS-2.5-ADVANCED.md) §6。**MPS fp32 实测**（2026-08-18，M3 系列；⚠️ 该轮数据采集于机器有其它负载时——2026-08-20 空闲复测整集 RTF≈9.2，见 §4.3b）：每句墙钟 = GPT 束搜索 + 扩散声码 + BigVGAN，RTF（耗时/音频时长）约 40–58（beams=3，忙时口径）；beams=1 下三集全量连续跑（596 句 / 40.2 分钟纯语音 / 8.5 小时墙钟）折算整集 RTF≈12–14；整集（约 180–230 句）约 2.5–3.5 小时，按句缓存可断点续跑。**束宽也是韵律稳定度旋钮**，不只是速度旋钮：3 束把语调起伏收窄约 10–20%，听感更"稳/可信"（见 §4.1）。三种用法按代价递增：单句重合成 `--num-beams 3`、关键句混合档 `--steady`（§5.2.1，推荐）、整集升档 `--style sunny-steady`。

**短句最贵、数字句更贵**（2026-08-19 实测，单句空闲口径）：RTF 随句长下降——4–6 秒的短句 3 束 RTF 19.6–31.5、1 束 6.0–7.4；13–15 秒长句 3 束仅 8.9–13.8。固定开销（`ref_mel` 作为 CFM 前缀参与每句 25 步扩散、BigVGAN）被长音频摊薄了。**逐字稿为字幕可读性把句子都拆到 ≤43 字，正好落在最贵区间**，排期请按短句口径留余量。

> ⚠️ **归因校准**：此前把「`2026 年 6 月…88 页` 一句 5.87 秒音频烧了 185 秒（RTF 31.5）」
> 归因于「数字被归一展开、token 数暴涨」——**这条因果是错的**。实测该句文本 token 仅
> 17 → 23（1.35×），远低于 118 的分段预算（`segments_count` 恒为 1），且**文本 token 只作为
> 前缀进一次 prefill、不参与 AR 循环**。真实原因就是「短句 × 3 束」：31.5 正是同段自述的
> 「4–6 秒短句 3 束 RTF 19.6–31.5」区间上界。归一化的真实影响是二阶且温和的——音节变多
> （两千零二十六 = 6 音节 vs 二零二六 = 4 音节）导致音频变长。
> 顺带：那句的年份写法 `2026 年` 本身就会被读成「两千零二十六年」，已作为读法陷阱修复
> 并成门（见 [skills/03-narration.md](./skills/03-narration.md) 读法纪律）。

### 4.4 调参建议

风格向量是 8 维情感空间中的**方向 + 强度**，两者要分开调：

1. **先定样本**（§3.3）——样本决定基线明亮度与语速，这一步的收益最大且零副作用；
2. **再定方向**：固定一句文本，`--style` 各档跑一遍对比（`--all-styles` 一条命令跑完，见 §5.1）；说不清就用 `--emo-text` 让 Qwen 选方向，再把回显向量固化；
3. **最后压强度**：`--emo-alpha` 才是"像不像真人"的开关。**注入 ≥0.6 普遍开始"用力/像另一个人"，0.3–0.45 是自然与风格的平衡带**（实测：同一方向 0.35 → 音高 169 Hz，0.60 → 188 Hz，0.80 → 199–223 Hz，而说话人自然区间 142–163 Hz）；
4. 语速用 `--duration-factor` 微调：0.92–0.95 更明快，1.0+ 更稳；术语密集的段落嫌糊就回到 1.0。

5. **最后定束宽**：想让语气更"稳/可信"就上 3 束（`--style sunny-steady`），代价是整集墙钟 ×2–5；赶工或改稿频繁期用 1 束的 `sunny`。

**推荐位**：日常/批量用 **`sunny`（明快阳光）**，成片定稿用 **`sunny-steady`（明快稳健）**——两档参数完全相同、只差束宽，故可"先用 sunny 快速迭代文稿，定稿再用 sunny-steady 重跑一遍"（换档会改摘要 → 全量重合成；机器空闲时两遍合计约 4 小时、并非数量级负担，见 §4.3b 复测）。两档都配 `voices/me-bright.wav`。历史上曾推荐 `passionate`，但其有效注入 0.70 在本人样本上偏"用力"，已改为 sunny 系。**任何情况下都先跑小样确认，再全量合成。**

## 五、小样试听与逐集合成

### 5.1 小样试听（单句直调服务，不需要工程）

全量一集要跑 2.5–3.5 小时，而「克隆出的音色像不像我」「哪档风格适合本集」用**一句话**就能判定——所以**定稿风格前必须先听小样**。[scripts/tts_sample.py](./scripts/tts_sample.py) 直调 IndexTTS 服务合成单句，无需 `narration.json`、无需视频工程；它复用 `tts.py` 的风格预设与口播文本预处理（单一事实源），故小样与成片走**完全相同**的合成路径，听感可直接外推。

```bash
# 1) 生成参考样本（已有可跳过）。推荐档：me-1.mp3 的 [0.36s, 12.36s) 这一段更亮更快
uv run --no-project --with soundfile --with numpy \
    $R/prepare_ref.py ~/Documents/dify/me-1.mp3 --start 0.36 --duration 12 \
    --out $V/me-bright.wav      # sha1 54b699cce97f · sunny 档即在此样本上定档
# 换段落先用 prospect_ref.py 筛候选（§3.2），成片曾用的更闷一档是 --start 180（§3.3）

# 2) 确认服务在线（未启动见 §2.3）
curl -s http://127.0.0.1:8766/health

# 3) 单档试听：合成后立即播放
uv run --no-project --with mutagen $R/tts_sample.py \
    --ref $V/me-bright.wav --style sunny --play

# 4) 全风格 A/B：7 档预设按 STYLE_PRESETS 顺序各一遍，顺序试听择优
#    neutral→passionate→lively→confident→positive→sunny→sunny-steady（末档自带 3 束，耗时见下表）
uv run --no-project --with mutagen $R/tts_sample.py \
    --ref $V/me-bright.wav --all-styles --play

# 5) 觉得向量注入「有合成味」：改用语调迁移——音色仍是本样本，语气搬自另一段录音
uv run --no-project --with mutagen $R/tts_sample.py \
    --ref $V/me-1.wav --emo-ref $V/me-bright.wav \
    --label emoref-bright --play          # --emo-alpha 0.7 可只迁移七成

# 6) 说不清参数、只说得清感觉：用自己的话描述（服务需 --use-qwen-emo）
uv run --no-project --with mutagen $R/tts_sample.py \
    --ref $V/me-bright.wav --emo-text "轻快、爽朗、自信、阳光" \
    --label qwen-brisk --play             # 回显 8 维向量；强度务必自己再压（§4.4 第 3 步）
```

> **`--start 180 --duration 12` 就是已上线三集成片所用的同源样本**：该段裁剪结果的 `sha1` 前 12 位为 `3ed0d9d60d4b`，与三集音频缓存 sidecar 摘要中的 `ref_sha1` 一致，直接复用即可听到与成片完全一致的音色。想换段落见 §3.2。

**常用开关**

| 开关 | 作用 | 默认 |
|---|---|---|
| `--text` / `--text-file` | 试听文本（建议 20–40 字，带数字/术语更易暴露咬字问题） | 内置一句科普文本 |
| `--style` / `--all-styles` | 单档 / 全部 7 档预设 A/B（`--all-styles` 逐档取预设自带的 alpha/语速/束宽，故与 `--emo-vector` `--emo-alpha` `--duration-factor` `--num-beams` 互斥） | `neutral` |
| `--emo-vector` `--emo-alpha` `--duration-factor` | 手动调参，语义与取值范围同 §四 | 随风格 |
| `--emo-ref <录音>` | 语调迁移：音色仍取 `--ref`，语气来自这段录音（见 §四） | 关 |
| `--emo-text "<描述>"` | 自然语言描述情感（需服务端 `--use-qwen-emo`）；推出的向量会打印，可用 `--emo-vector` 固化 | 关 |
| `--num-beams` | 束宽；越大韵律越稳、耗时约按束宽线性放大（见 §4.3b）。显式给值会压过预设，但与 `--all-styles` 互斥（否则 sunny 与 sunny-steady 会产出完全相同的音频） | 随风格（`sunny-steady` 为 3，其余 1） |
| `--dry-run` | 只解析并打印各档向量/alpha/语速/束宽，不连服务（秒级核参，改风格后先跑这个） | 关 |
| `--label` | 产物文件名（多档时作前缀 `{label}-{风格}`）——**横向对比多个参考样本或多组自定义向量时必用**，否则同名互相覆盖 | 取风格名 |
| `--play` / `--out-dir` | 合成后 `afplay` 顺序试听 / 产物目录 | 关 / `.temp/voice-samples/` |

**耗时实测**（2026-08-19 · M3 系列 · MPS fp32 · 上述 34 字文本）

| 环节 | 音频时长 | 墙钟 | RTF |
|---|---|---|---|
| 单档 · 首档（含服务暖机，1 束，机器空闲） | 6.86s | 47.0s | 6.8 |
| 单档 · 暖机后（1 束，机器空闲） | 6.0–6.9s | 20–22s | 3.2–3.4 |
| 全 7 档 A/B（`--all-styles`，含 sunny-steady 的 3 束档，机器有其它负载） | 合计 46.2s | **6.3 分钟** | — |

> **口径提醒**：小样 RTF（暖机后、机器空闲、单句，≈3.3）与 §4.3b 整集折算 RTF（≈12–14）测的不是同一件事——后者含数小时长跑的降频、机器争用与逐句开销。上表 A/B 行即反例：机器有其它负载时单档墙钟散布在 37.7–86.6 秒（最慢的是该服务会话内首次用该样本的那档），其中 3 束的 sunny-steady 只用 38.6 秒、并未比 1 束档更慢。**小样耗时既不可线性外推到整集，也不足以据单次样本推断束宽代价**——束宽的系统性代价与整集排期一律以 §4.3b 的长跑折算口径为准。

**注意事项**

- 参考样本路径由客户端解析为**绝对路径**后传给服务端（服务与客户端可分处不同 checkout，本机即如此），但文件须对**服务进程**可见；
- 小样文本会经与成片相同的预处理（`——`→`，`、`……`→`。`）；改用下方 curl 直调则**不做**该替换，破折号会念出怪音；
- 风格/样本一改，整集时长随之改变 → 定稿后必须重跑草渲让时间轴重算（见 5.3、§六）；
- 产物落 `.temp/voice-samples/`（已被根 `.gitignore` 忽略）。**小样内含本人音色，属生物特征信息，试听后请 `rm -rf .temp/voice-samples`**。

#### 附：纯 HTTP 直调（协议级排障 / 无 Python 环境时）

服务只暴露 `/health` 与 `/synthesize` 两个端点，一条 `curl` 即可完成合成——用于判定「问题在服务端还是客户端」：

```bash
mkdir -p .temp/voice-samples && cat > .temp/voice-samples/payload.json <<'JSON'
{
  "text": "自进化编码智能体的核心不是写代码，而是让 AI 学会修改自己写代码的方式。",
  "ref_path": "<样本绝对路径>/me-1.wav",
  "emo_vector": [0.7, 0, 0, 0, 0, 0, 0.2, 0.1],
  "emo_alpha": 0.7,
  "duration_factor": 0.97,
  "lang": "ZH",
  "num_beams": 1
}
JSON
curl -sS -X POST http://127.0.0.1:8766/synthesize \
    -H 'Content-Type: application/json' -d @.temp/voice-samples/payload.json \
    -D .temp/voice-samples/headers.txt -o .temp/voice-samples/curl.mp3 \
    -w '状态 %{http_code} · 墙钟 %{time_total}s\n' --max-time 900
grep -i '^x-' .temp/voice-samples/headers.txt   # 期望 X-Audio-Format: mp3 与 X-Duration-Sec
afplay .temp/voice-samples/curl.mp3
```

- `emo_vector` 为 8 维（顺序见 §4.1），**取值以 §4.1 表或 `tts.py --list-styles` 输出为准**（勿另抄副本）；`neutral` 档传 `null` 或整字段省略即不注入情感；
- 状态码非 200 时响应体是 JSON 错误详情、被 `-o` 写进了 `.mp3`：`cat .temp/voice-samples/curl.mp3` 即可看到 `detail`（如情感有效和超界、参考音频不存在）。

### 5.2 全量合成（逐集）

```bash
cd $P   # 工程内薄包装等价于中心脚本；风格取 5.1 试听定稿的那一档

# 0) 先看计划（纯本地计算，不连服务、不合成）：各束宽多少句、缓存命中多少、大致要跑多久
uv run --no-project --with mutagen scripts/tts.py --engine indextts \
    --ref <样本绝对路径>/me-bright.wav --style sunny --plan

# 1) 全量合成
uv run --no-project --with mutagen scripts/tts.py --engine indextts \
    --ref <样本绝对路径>/me-bright.wav --style sunny
```

**`--plan` 是长跑前的必经一步**：它逐句算摘要并与 sidecar 比对，告诉你「真正要合成几句」——改了几行稿子后重跑，往往只有那几句是 miss，不必按整集排期。

#### 5.2.1 混合档：整集 1 束 + 关键句 3 束（`--steady`）

3 束（`sunny-steady`）韵律更稳。机器空闲时整集升档实测仅 +4%（见 §4.3b 复测），可直接整集跑；**机器忙/热节流时**整集升档代价可达数倍，而真正决定第一印象的只是冷开场与各幕金句——`--steady` 让这些句子单独升档，其余仍按风格的束宽跑：

```bash
uv run --no-project --with mutagen scripts/tts.py --engine indextts \
    --ref <样本绝对路径>/me-bright.wav --style sunny \
    --steady 'P0,p3-25b,p5-01' [--steady-beams 3] --plan   # 先 --plan 核对命中句数，再去掉 --plan 实跑
```

选择器语法（逗号分隔、大小写不敏感、**任一项匹配不到句子直接报错**，避免拼错后静默按低束宽跑完）：

| 写法 | 含义 |
|---|---|
| `P0` | 整幕（匹配 `narration.json` 的 `scene`） |
| `p3-25b` | 单句（含 `-` 即视为句 id） |
| `p5-*` | 前缀通配（该幕内 `p5-` 开头的全部句子） |

**代价按句线性**（189 句一集、长跑折算口径，`--plan` 输出）：

| 方案 | 3 束句数 | 估算墙钟 | 相对纯 sunny |
|---|---|---|---|
| `--style sunny` | 0 | **2.9 h** | — |
| `--style sunny --steady 'p0-01,p0-02,p0-03,p3-25b,p5-01'` | 5 | 3.1 h | +7% |
| `--style sunny --steady 'P0,p3-25b,p5-01'` | 20 | 3.6 h | +24% |
| `--style sunny-steady`（整集升档） | 189 | **9.9 h** | +241% |

即**每升 1 句约 +2.2 分钟（+1.3%）**——升十几句买到关键处的稳定度是划算的，整集升档则不划算。

> ⚠️ **2026-08-20 复测推翻了「整集升档不划算」这一结论的前提**（EP1 v3 两遍法，187 句，机器空闲）：
> A 遍 `sunny`(beams=1) 墙钟 ≈1.9 h、B 遍 `sunny-steady`(beams=3) 墙钟 **1.98 h**——**B/A ≈ 1.04，而非 +241%**。
> 实测 RTF：1 束 ≈8.8、3 束 ≈9.2（`--plan` 常量分别为 13 / 45，即 3 束估算偏保守约 4.9 倍）。
> 上表的 9.9 h 数据应是在机器被占用或热节流时测得。**新口径：机器空闲时整集直上 `sunny-steady` 是可行的**
> （本集即如此完成），`--steady` 混合档的价值退回到「机器忙时的折中手段」。`--plan` 常量刻意不下调——
> 排期宁可高估留窗口，但看到估算与实测差 3–5 倍属正常。缓存 sidecar 按句独立（摘要含 `|beams=N`），故混用两种束宽完全安全，也可以先全集跑 `sunny`、事后再补 `--steady 'P0'` 只重合成那几句。

- 服务启动一次可服务多集；管线客户端不常驻模型；
- 每句墙钟与文本长度及束宽相关：长跑折算 RTF≈45（3 束）/ ≈13（1 束）。**1 束整集（约 180–230 句）约 2.5–3.5 小时；3 束整集约 9–10 小时**（`--plan` 会按这两个口径给出估算）——请据此选档并 `nohup` 挂后台跑，按句缓存可断点续跑（见 §六）；
- 超长句（>120 token）服务端内部自动分段；极端长句推理可达数分钟。客户端并发为 1（与服务端串行推理对齐，避免排队时间计入超时），HTTP 超时 600s；万一超时——重跑即续传，无需干预。

### 5.3 合成后重渲染

```bash
cd video && pnpm run render:draft && pnpm run render   # render 脚本定义在 video/package.json
```

引擎/风格/样本任一变化都会改写每句时长，合成后**必须重跑草渲**让 Remotion 时间轴重算。


## 六、缓存与幂等

| 引擎 | 摘要公式 |
|---|---|
| edge（历史不变） | `sha1(voice\|rate\|text)` |
| indextts | `sha1(indextts\|engine_tag\|ref_sha1前12位\|lang\|style\|vec\|alpha\|df\|text[\|beams=N][\|emoref=情感样本sha1前12位][\|emotext=描述原文])` |

- 方括号内为**可选后缀，仅在该项被使用时才拼入**（`--num-beams 1` / 无情感音频 / 无情感描述时省略）——这样新增能力不会失效任何存量缓存（已对已上线三集 189 句逐句核对：摘要 100% 不变）；
- 情感样本按**内容 SHA1** 入键，换一段情感录音会自动失效缓存，与 `--ref` 同口径；
- sidecar `{id}.sha` 与 `{id}.mp3` 一一对应、单槽位：换引擎/风格/样本/语速 = 全量重合成（一个句 id 只有一个 mp3 槽位，这是 Remotion 契约决定的）；
- 模型/服务升级后想强制刷新全部音频：`--engine-tag v2.5b`（自定义标记进摘要）；
- 中断后续跑：直接重跑同命令（已完成句子全部命中缓存跳过）。


## 七、故障排查

| 症状 | 原因 | 处理 |
|---|---|---|
| 合成请求全部失败，报「服务不可用」 | 服务未启动/端口错 | `curl 127.0.0.1:8766/health`；按 §2.3 启动；`lsof -ti:8766` 查占用 |
| 生成音频含 NaN（HTTP 500，detail 提示） | MPS 数值问题 | 客户端自动重试常可清；持续则服务加 `--device cpu` 重启（速度大幅下降，仅救急） |
| 合成极慢 / 内存飙高 | fp32 + 长句 | 服务串行推理已是缓解；进一步可 `--device cpu` 换稳定；句长已由 max_text_tokens_per_segment=120 内部切分 |
| 服务日志 `QwenEmotion not loaded` | 正常 | 仅向量模式，不加载 Qwen（省内存） |
| `X-Audio-Format=wav` | 服务端 MP3 编码器探测失败 | 按 §2.3 带 `--with lameenc` 重启服务 |
| `/health` 报 `supports_duration_factor=false` | 服务为 IndexTTS-2 | 语速控制需 v2.5：重启服务 `--indextts-version 2.5` |
| `/health` 报 `supports_emo_text=false`，`--emo-text` 被拒 | 服务未加载 QwenEmotion | 带 `--use-qwen-emo` 重启；若报缺 `model.safetensors` 见 §2.4 补权重 |
| 报「情感来源互斥，只能给一个」 | 同时给了 `--emo-vector`/`--emo-ref`/`--emo-text` 中的两个以上 | 三者择一（上游遇「向量+音频」会静默丢弃音频，故本管线显式拒绝，见 §四） |
| 生成音色「不像我」 | 样本质量问题 | 按 §三 重录/重裁：换更干净段落、保证单说话人、10–14s（先跑 `prospect_ref.py --accept` 过保真度） |
| 长句合成失败 | 超时（HTTP_TIMEOUT=600s） | 重跑（缓存续传）；超长句在逐字稿层面拆句 |
| edge 模式失败 | 网络 | 与历史行为一致（重试 4 次后报错） |

## 八、许可与合规

- **模型许可**：IndexTTS-2.5 按 [bilibili 模型使用许可协议](https://github.com/index-tts/index-tts/blob/main/LICENSE)（bilibili Model Use License）发布——**个人/研究用途可用；商用需联系 indexspeech@bilibili.com**。制作对外发布的视频前请自行评估许可范围。
- **声音权利**：克隆他人声音必须获得本人书面同意；本仓 `$V/`（即 `pipeline/voices/`）下样本已被根 `.gitignore` 忽略，绝不入库。
- **edge-tts 义务**：edge-tts 为微软服务免费接口，成品需遵守微软服务条款；当前默认引擎仍为 edge，行为与历史完全一致。

## 九、备选方案与参考文献

### 9.1 方案对比（为何选 IndexTTS-2.5）

| 方案 | 克隆 | 风格控制 | Mac 部署 | 备注 |
|---|---|---|---|---|
| edge-tts | ❌ 仅预置 | 仅 rate | 无需部署 | 本管线默认引擎（零成本回退） |
| **IndexTTS-2.5** | ✅ 单样本零样本 | ✅ 向量+强度+语速 | ✅ MPS fp32 | **主方案**；中英日西阿 |
| IndexTTS-2 | ✅ | ✅ 向量（无语速） | ✅ fp16 成熟 | 服务端一键回退档（`--indextts-version 2`） |
| index-tts-2.5-mlx（社区 MLX 移植） | ✅ | ❌ 砍掉全部情感控制 | ✅ 最省内存 | 0.1.1（2026-08-14）**已支持 2.5**、自带 int8 GPT 权重、uvx 一键；但主动放弃 `emo_vector`/`emo_audio_prompt`/`emo_text` 与束搜索 ⇒ 本仓 7 档风格体系与 alpha 标定全部失效，不可直接替换（评估前置动作见进阶篇 §6） |
| GPT-SoVITS | ✅ 微调最佳 | 依赖参考音频 | 推理可/训练差 | 需训练工作流，过重 |
| CosyVoice 2 | ✅ 3–10s | instruct 指令 | ✅ | 克隆相似度略逊 |
| 云端（Azure Custom Voice 等） | ✅ | ✅ | 无需 | 收费/审核/隐私，不采纳 |

### 9.2 参考文献（IEEE）

<a id="ref1"></a>[1] B. Si et al., "IndexTTS: An Industrial-Level Controllable and Efficient Zero-Shot Text-To-Speech System," *arXiv preprint arXiv:2502.05512*, 2025.

<a id="ref2"></a>[2] B. Si et al., "IndexTTS-2: Breakthrough Emotionally Expressive and Duration-Controlled Auto-Regressive Zero-Shot Text-To-Speech," *arXiv preprint arXiv:2506.21619*, 2025.

<a id="ref3"></a>[3] B. Si et al., "IndexTTS-2.5 Technical Report," *arXiv preprint arXiv:2601.03888*, 2026.

<a id="ref4"></a>[4] Skywork 博客：[Index-TTS 2 on Mac](https://skywork.ai/blog/index-tts-2-on-mac-how-i-got-emotion-aware-lip-sync-ready-tts-running-without-cuda/) —— Mac MPS 部署实测（NaN clamp 等补丁）。

<a id="ref5"></a>[5] macOS 部署参考：[张洪Heo：Mac 部署 IndexTTS2](https://blog.zhheo.com/p/gulzh21p.html)。
