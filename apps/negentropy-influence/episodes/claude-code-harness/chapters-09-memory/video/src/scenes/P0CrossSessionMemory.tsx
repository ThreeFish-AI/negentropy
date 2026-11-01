/** P0 跨会话的记忆（p0-01..p0-07，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：系列片头交棒后冷启动直入（开篇视听合力 I-039）：上半区对话窗 +
 *  下半区磁盘层带双位同屏（本集世界坐标——会话层 / 磁盘层；p0-01「越攒越懂你」
 *  记忆小签逐枚贴上消息条〔M-005〕、「是拒绝」窗顶记忆紫闸影一压即隐——全片
 *  张力预告）→ p0-02「会话一断」窗框熄灭断开、「全清零」警示红淡扫自上而下
 *  逐条熄灭（前集收尾意象一句兑现）→ 0-B 焦点下移磁盘层特写：文件图标独存
 *  亮起（库体之种·呼吸微光）、旁侧新会话窗空待、「还认得你」三枚小签自文件
 *  图标逐一飞入（stagger）、「来龙去脉」末签落位窗内泛微光 → 0-C 全景拉远
 *  分层重锚（Map-First）：上层压缩装置位暗位带过（小环缩悬示归属、不展开
 *  内部——前集域）、下层记忆库体首亮（mech 方体轮廓·主体）、分隔基线、「三件
 *  事」三签 stagger 升起（「不脏」微红描边预示 P3）、「先说存」存签单独高亮
 *  + @pushIn 推向库体（1-A 在库体屏位接棒——morph continuity）。
 *
 *  空间契约：会话层 / 磁盘层双位同屏、清零扫单向自上而下、磁盘层 p0-03 前不
 *    亮、文件图标为 0-B 唯一亮主体、三签仅关键词（存 / 取 / 不脏）、压缩装置
 *    内部机制不显形、署源角标右下恒定不抢焦（首部署源位）。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；.memory/ 只进角标；
 *    三签文字不成句；pushIn 不越过库体屏位（1-A 接棒）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ChatWindow, LoopRing, MemoryVault} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 176 避开字幕条（承 ep1–ep8 SourceCredit 形态） */
const SourceCredit: React.FC = () => {
  const o = useProgress(0, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        bottom: 168,
        fontFamily: theme.mono,
        fontSize: 22,
        letterSpacing: 1,
        color: theme.dim,
        opacity: 0.85 * o,
      }}
    >
      Learn Claude Code
    </div>
  );
};

// ── 0-A 冷启动全景：贴签攒记忆 → 闸影一压 → 会话断 → 红扫清零 ────────────

/** 对话窗全局位（上半区）与磁盘层带（下半区）——本集世界坐标双位 */
const CHAT = {x: 430, y: 150, w: 1060, h: 430} as const;
const DISK = {x: 260, y: 700, w: 1400, h: 150} as const;

const ZeroA: React.FC<{atTags: number; atGate: number; atDead: number; atSweep: number}> = ({atTags, atGate, atDead, atSweep}) => {
  const frame = useCurrentFrame();
  // 「越攒越懂你」记忆小签逐枚贴上消息条（stagger——攒的过程）
  const tagIn = [0, 1, 2].map((i) => clamp01(progress(frame, atTags + i * 7, DUR.f4)));
  // 「是拒绝」窗顶记忆紫闸影一压即隐（全片张力预告，不展开）
  const gateP = clamp01(progress(frame, atGate, DUR.f5));
  const gatePress = Math.sin(Math.PI * gateP);
  // 「会话一断」边框熄灭断开（dead dashed）+「全清零」红淡扫自上而下（扫过处行熄灭）
  const dead = useProgress(atDead, DUR.f5);
  const sweep = useProgress(atSweep, 46, 'linear');
  // 消息条随开场亮起（冷启动舞台先立）+ 光标待落
  const rowsLit = 6 * clamp01(progress(frame, 4, 26));
  const tags = [
    {t: '偏好', row: 0},
    {t: '踩过的坑', row: 2},
    {t: '结论', row: 4},
  ] as const;
  return (
    <AbsoluteFill>
      {/* 对话窗（上半区·会话层——消息条若干、光标待落） */}
      <ChatWindow
        x={CHAT.x}
        y={CHAT.y}
        w={CHAT.w}
        h={CHAT.h}
        rows={['问：这段怎么缩进？', '答：已按偏好处理', '问：路径放哪？', '答：在 src/ui', '问：再核一处', '答：好了']}
        rowsLit={rowsLit}
        dead={dead}
        sweepP={sweep}
        emptyAwait={0}
      />
      {/* 记忆小签（逐枚贴上消息条—— mech 小签，攒的过程） */}
      {tags.map((tg, i) => {
        const p = tagIn[i];
        if (p <= 0.02) {
          return null;
        }
        return (
          <div
            key={tg.t}
            style={{
              position: 'absolute',
              left: CHAT.x + 620,
              top: CHAT.y + 108 + tg.row * 54 - 26 * (1 - p),
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.mech, 0.55 + 0.4 * p)}`,
              background: withAlpha(theme.panel, 0.95),
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: p * (1 - 0.92 * clamp01(sweep * 7 - i * 2)),
              transform: `translateY(${(1 - p) * -12}px)`,
            }}
          >
            {tg.t}
          </div>
        );
      })}
      {/* 闸影一压即隐（窗顶——记忆紫横闸下压一拍，不展开） */}
      {gatePress > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: CHAT.x + 300,
            top: CHAT.y - 26 - 34 * gatePress,
            width: 460,
            height: 34,
            borderRadius: 8,
            border: `3px solid ${withAlpha(theme.mech, 0.85)}`,
            background: withAlpha(theme.mech, 0.18),
            boxShadow: `0 0 ${22 * gatePress}px ${withAlpha(theme.mech, 0.5)}`,
            opacity: gatePress,
          }}
        />
      ) : null}
      {/* 磁盘层带（下半区·暗色——一枚文件图标暗位轮廓，p0-03 才亮） */}
      <div
        style={{
          position: 'absolute',
          left: DISK.x,
          top: DISK.y,
          width: DISK.w,
          height: DISK.h,
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `2.5px dashed ${withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.bg, 0.5),
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 40,
          gap: 22,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'磁盘层 · 会话之外'}</span>
        {/* 文件图标暗位轮廓（不亮——p0-03 才点亮） */}
        <span style={{width: 30, height: 38, borderRadius: 5, border: `2.5px dashed ${withAlpha(theme.dim, 0.55)}`, display: 'inline-block'}} />
      </div>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'.memory/ · 对话之外的一层'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 磁盘层特写：文件图标独存亮起 → 三签飞入新会话 → 窗内泛微光 ────────

const ZeroB: React.FC<{atSink: number; atFile: number; atFly: number; atLast: number}> = ({atSink, atFile, atFly, atLast}) => {
  const frame = useCurrentFrame();
  // 「不住对话里」熄灭的对话窗整体退暗一沉（已清零语义——不复亮）
  const sink = useProgress(atSink, DUR.f5);
  // 「住磁盘文件里」文件图标点亮（呼吸微光——库体之种）
  const fileOn = useProgress(atFile, DUR.f4);
  const breathe = useBreathe({period: 56, amp: 0.4, base: 0.6});
  // 「还认得你」三枚小签自文件图标逐一飞入新会话窗（stagger；横向飞行——无竖条
  // 装置需避让，QA 教训 26 不适用位）
  const fly = [0, 1, 2].map((i) => clamp01(progress(frame, atFly + i * 12, 30)));
  // 「来龙去脉」末签落位、窗内泛一次微光（认得的具象）
  const lastIn = clamp01(progress(frame, atLast, DUR.f4));
  const glowP = useImpulse({at: atLast + DUR.f3, dur: DUR.f6, peak: 1});
  const signTexts = ['偏好', '教训', '来龙去脉'] as const;
  // 文件图标位（中左）与新会话窗位（右）——飞行起点/终点
  const FILE = {x: 640, y: 470} as const;
  const NEWCHAT = {x: 1060, y: 330, w: 640, h: 380} as const;
  return (
    <AbsoluteFill>
      {/* 熄灭的对话窗（退暗一沉——整体下移压暗，残在上方；沉幅不触磁盘特写框） */}
      <div style={{position: 'absolute', left: 0, top: 50 + 44 * sink, opacity: 0.5 * (1 - 0.7 * sink)}}>
        <ChatWindow x={430} y={50} w={1060} h={240} scale={0.82} rows={['…', '…', '…', '…']} rowsLit={4} dead={1} dim={0.3 + 0.4 * sink} header={'会话 · 已断'} />
      </div>
      {/* 磁盘层特写（焦点下移——层带上缘亮起） */}
      <div
        style={{
          position: 'absolute',
          left: 240,
          top: 380,
          width: 1440,
          height: 320,
          boxSizing: 'border-box',
          borderRadius: 16,
          border: `2.5px dashed ${withAlpha(theme.panelBorder, 0.9 - 0.3 * fileOn)}`,
          background: withAlpha(theme.bg, 0.45),
        }}
      >
        <span style={{position: 'absolute', left: 30, top: 14, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'磁盘层 · 特写'}</span>
      </div>
      {/* 文件图标（独存亮起——库体之种；呼吸微光） */}
      <div style={{position: 'absolute', left: FILE.x, top: FILE.y, opacity: fileOn}}>
        <svg width={110} height={132} viewBox="0 0 110 132" style={{overflow: 'visible', filter: `drop-shadow(0 0 ${14 + 20 * breathe}px ${withAlpha(theme.mech, 0.55)})`}}>
          <path d="M 12 6 L 74 6 L 98 30 L 98 126 L 12 126 Z" fill={withAlpha(theme.panel, 0.97)} stroke={theme.mech} strokeWidth={4} strokeLinejoin="round" />
          <path d="M 74 6 L 74 30 L 98 30" fill="none" stroke={theme.mech} strokeWidth={4} strokeLinejoin="round" />
          <line x1={28} y1={56} x2={82} y2={56} stroke={withAlpha(theme.mech, 0.55)} strokeWidth={4} strokeLinecap="round" />
          <line x1={28} y1={76} x2={82} y2={76} stroke={withAlpha(theme.mech, 0.4)} strokeWidth={4} strokeLinecap="round" />
          <line x1={28} y1={96} x2={62} y2={96} stroke={withAlpha(theme.mech, 0.3)} strokeWidth={4} strokeLinecap="round" />
        </svg>
        <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.mech, marginTop: 10}}>{'.memory/ · 文件'}</div>
      </div>
      {/* 新会话窗（旁侧开起——消息列空待） */}
      <ChatWindow x={NEWCHAT.x} y={NEWCHAT.y} w={NEWCHAT.w} h={NEWCHAT.h} lit={fileOn} rows={[]} rowsLit={0} emptyAwait={fileOn} glowP={glowP} header={'新会话'} />
      {/* 三枚关键词小签（自文件图标逐一飞入新窗——stagger 横向飞行） */}
      {signTexts.map((t, i) => {
        const p = fly[i];
        if (p <= 0.02) {
          return null;
        }
        const tx = FILE.x + 130 + (NEWCHAT.x + 90 - FILE.x - 130) * p;
        const ty = FILE.y + 40 + (NEWCHAT.y + 110 + i * 64 - FILE.y - 40) * p;
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: tx,
              top: ty,
              padding: '5px 16px',
              borderRadius: 9,
              border: `2.5px solid ${theme.mech}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 18,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: Math.min(1, p * 2),
              boxShadow: i === 2 ? `0 0 ${16 * lastIn}px ${withAlpha(theme.mech, 0.5)}` : 'none',
            }}
          >
            {t}
          </div>
        );
      })}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'住磁盘文件里 · 再开会话还认得你'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 分层全景重锚：压缩层暗位带过 + 库体首亮 + 存/取/不脏三签 ───────────

/** 库体全景位（下层中景——1-A morph 起点；pushIn 推向此位不越过） */
const VAULT_P0 = {x: 640, y: 560, w: 640, h: 300} as const;

const ZeroC: React.FC<{atTop: number; atVault: number; atThree: number; atStore: number}> = ({atTop, atVault, atThree, atStore}) => {
  const frame = useCurrentFrame();
  // @pushIn（动机：p0-07 主线三问起，推向本集主舞台库体；1-A 在库体屏位接棒）
  const push = usePushIn(atStore, {scale: 0.09, dur: 34});
  // 「压缩管会话内」上层标签亮一拍即收（一眼带过）；「这层管跨会话」库体层标签亮
  const topTag = useImpulse({at: atTop, dur: 22, peak: 1});
  const vaultTag = useProgress(atVault, DUR.f4);
  // 「三件事」三签 stagger 升起（落位暗态先随 vaultTag 显——seat 与点亮解耦）；
  // 「不脏」签微红描边（预示 P3）
  const seatP = useProgress(atVault + DUR.f4, DUR.f5);
  const three = [0, 1, 2].map((i) => clamp01(progress(frame, atThree + i * 6, DUR.f4)));
  // 「先说存」存签单独高亮一枚
  const storeHot = useProgress(atStore, DUR.f4);
  const storeGlow = useImpulse({at: atStore, dur: DUR.f6, peak: 1});
  // 压缩层小环（缩悬其间示归属——不展开内部；恒定巡游）
  const dot = ((frame / 80) % 1 + 1) % 1;
  const signs = [
    {t: '存', danger: false},
    {t: '取', danger: false},
    {t: '不脏', danger: true},
  ] as const;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: `${((VAULT_P0.x + VAULT_P0.w / 2) / 1920) * 100}% ${((VAULT_P0.y + VAULT_P0.h / 2) / 1080) * 100}%`}}>
        {/* 上层·会话内压缩装置位（暗位带过——一枚小环缩悬其间示归属，不展开内部） */}
        <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 330, opacity: 0.85}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 64, textAlign: 'center', fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: 0.6 + 0.4 * topTag}}>
            {'会话内 · 压缩管这层（前集域 · 带过）'}
          </div>
          <div style={{position: 'absolute', left: 906, top: 128, opacity: 0.9}}>
            <LoopRing size={108} nodes={[]} showExit={false} dotProgress={dot} />
          </div>
        </div>
        {/* 分隔基线（两层之间） */}
        <div style={{position: 'absolute', left: 160, right: 160, top: 396, height: 0, borderTop: `3px solid ${withAlpha(theme.dim, 0.55)}`}} />
        {/* 下层·跨会话记忆库体（首亮主体——mech 方体轮廓，门缝未开） */}
        <div style={{position: 'absolute', left: 0, top: 428, width: 1920, textAlign: 'center', opacity: vaultTag}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.mech}}>{'跨会话 · 这层管'}</span>
        </div>
        <MemoryVault x={VAULT_P0.x} y={VAULT_P0.y} w={VAULT_P0.w} h={VAULT_P0.h} lit={vaultTag} />
        {/* 库体上方三枚标签位（存 / 取 / 不脏——落位暗态 → 点亮升起） */}
        <div style={{position: 'absolute', left: 0, top: 470, width: 1920, display: 'flex', justifyContent: 'center', gap: 60}}>
          {signs.map((s, i) => {
            const lit = three[i];
            const seat = seatP;
            return (
              <div
                key={s.t}
                style={{
                  padding: '8px 30px',
                  borderRadius: 10,
                  border: `2.5px ${lit > 0.05 ? 'solid' : 'dashed'} ${i === 0 && storeHot > 0.3 ? theme.core : s.danger ? (lit > 0.3 ? theme.danger : theme.panelBorder) : lit > 0.3 ? theme.mech : theme.panelBorder}`,
                  background: lit > 0.05 ? theme.panel : 'transparent',
                  fontFamily: theme.sans,
                  fontSize: 24,
                  fontWeight: 700,
                  color: i === 0 && storeHot > 0.3 ? theme.core : lit > 0.3 ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: lit > 0.05 ? lit : 0.45 * seat,
                  transform: `translateY(${(1 - Math.max(lit, seat * 0.4)) * 14}px)`,
                  boxShadow: i === 0 && storeHot > 0.05 ? `0 0 ${20 * storeGlow}px ${withAlpha(theme.core, 0.5)}` : 'none',
                }}
              >
                {s.t}
              </div>
            );
          })}
        </div>
        <SourceCredit />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'存 · 取 · 不脏——先说存'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0CrossSessionMemory: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-04');
  const bC = w('p0-05', 'p0-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atTags={wa('p0-01', 0.16) - bA.from}
          atGate={wa('p0-01', 0.82) - bA.from}
          atDead={wa('p0-02', 0.18) - bA.from}
          atSweep={wa('p0-02', 0.55) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atSink={wa('p0-03', 0.34) - bB.from}
          atFile={wa('p0-03', 0.72) - bB.from}
          atFly={wa('p0-04', 0.3) - bB.from}
          atLast={wa('p0-04', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atTop={wa('p0-05', 0.16) - bC.from}
          atVault={wa('p0-05', 0.62) - bC.from}
          atThree={wa('p0-06', 0.3) - bC.from}
          atStore={wa('p0-07', 0.2) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0CrossSessionMemory;
