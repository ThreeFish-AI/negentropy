/** P2 删除命令过三关（p2-01..p2-08，5 镜）——分镜 2-A / 2-B / 2-C / 2-D / 2-E。
 *
 *  叙事链：走查舞台全景（消息条竖列 + 三闸卡同形移驻通道位〔morph 承 1-D〕+
 *  环体缩悬顶角 + 第一道门后黑名单表待扫）——`rm old-notes.txt` 调用卡自消息
 *  条弹出、任务签「旧笔记」贴上（同签贯穿 P2 全程）→ 扫描线逐行扫过黑名单
 *  七行全灰暗无一亮起、过第一关留绿边过痕 → 2-B 第二关命中特写：「rm」标签
 *  与卡上命令咬合点亮、「潜在破坏性」红标贴上卡角弹一下 → 2-C 第三关暂停
 *  特写：问人终端满幅定格、光标呼吸 + 双键虚影各闪、镜尾全帧收暗半拍 →
 *  2-D 是/否双分支等高并列：同一输入分身两枚，左（是）执行脉冲+结果条沿青
 *  碧流回喂、右（否）Permission denied. 红回执沿同构红流回喂+止步符+岔路标
 *  （拒绝也是信息——教学点）→ 2-E 第一道门弹回特写：sudo 卡直冲撞行命中、
 *  原路弹回坠出（与 1-B 同款弹回轨迹）、问人门全程灰置、镜尾大问号悬停
 *  第一道门上方半拍收黑（悬念交给 3 幕）。
 *
 *  空间契约：Morph Continuity（1-D→2-A）同一主体=三道闸卡串联：1-D 末帧
 *  三闸卡列队于上方缩置 → 2-A 首帧同形移驻走查舞台通道位；中间态位移+缩放
 *  中三卡排布、各卡衬色、卡面状态逐帧不变；身份线索=三卡排布+裁决紫描边
 *  主调。2-D 双支路等高并列、回喂流同构（青=结果/红=拒绝）、同输入同签
 *  可追、模型脑两支路镜像同位。2-E sudo 卡不近问人门、弹回与 1-B 轨迹同款。
 *
 *  红线落实：词落位 = 句首 + 句长比例；本例黑名单七行无一亮起（不中）；
 *  扫描逐行可见；命中标签唯一；终端无回车（表态是 2-D 事件）；右支路必有
 *  回喂；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {AskTerminal, BrainGlyph, CallCard, DenyListTable, GateCard, GateChain, LoopRing, Panel, SceneTag, execArcPath} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useImpulse, useProgress, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 环体缩悬顶角（M-001 同形；执行段青碧微光在位——走查坐标锚） */
const RingCorner: React.FC = () => {
  const size = 150;
  const r = size / 2 - 46;
  return (
    <div style={{position: 'absolute', left: 76, top: 84, opacity: 0.6}}>
      <LoopRing size={size} nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))} showLabels={false} showExit={false} dimNodes />
      <svg width={size} height={size} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
        <path d={execArcPath(size / 2, size / 2, r)} fill="none" stroke={theme.tool} strokeWidth={7} strokeLinecap="round" opacity={0.55} />
      </svg>
    </div>
  );
};

const Foot2: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 22,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

// ── 2-A 走查舞台全景：调用卡弹出 + 第一关扫描放行 ──────────────────────

const ShotA: React.FC<{atStage: number; atCall: number; atTag: number; atScan: number; atPass: number}> = ({
  atStage,
  atCall,
  atTag,
  atScan,
  atPass,
}) => {
  const frame = useCurrentFrame();
  // morph 1-D→2-A：三闸卡自 1-D 末帧缩置位（上方 0.88 档）同形移驻通道位
  const morph = useSpring('settle', {at: 0, dur: DUR.f5});
  const chainY = 130 + (455 - 130) * morph;
  const chainS = 0.88 + 0.12 * morph;
  // 舞台三件亮起（消息条 / 三门通道 / 黑名单表——stagger）
  const stage = [0, 1, 2].map((i) => clamp01(progress(frame, atStage + i * 4, DUR.f4)));
  // 调用卡：自消息条弹出滑向第一道门前（「一次 bash 调用」）；任务签贴上
  const callGo = useProgress(atCall, DUR.f5, 'decelerate');
  const tagShow = useProgress(atTag, DUR.f3);
  // 扫描线逐行扫过七行（全行灰暗无一亮起）；「放行」过第一关留绿边过痕
  const scan = useProgress(atScan, DUR.f6, 'linear');
  const passed = useProgress(atPass, DUR.f3);
  const callX = 205 + (830 - 205) * callGo;
  return (
    <AbsoluteFill>
      <SceneTag chapter="Worked Example" tagline="删除命令 · 过三关" accent={theme.mech} />
      <RingCorner />
      {/* 左侧消息条竖列（走查起点） */}
      <div style={{position: 'absolute', left: 130, top: 330, opacity: stage[0]}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{width: 168 - i * 24, height: 34, borderRadius: 8, border: `2px solid ${theme.panelBorder}`, marginBottom: 16}} />
        ))}
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'messages'}</div>
      </div>
      {/* 三道门通道（morph 移驻：三闸卡串联；第一道卡带绿边过痕） */}
      <div style={{position: 'absolute', left: 600, top: chainY, opacity: stage[1], transform: `scale(${chainS})`, transformOrigin: 'left top'}}>
        <GateChain x={0} y={0} cardW={170} cardH={160} spacing={252} lit={[1, 1, 1]} pass={[passed, 0, 0]} />
      </div>
      {/* 第一道门后黑名单表（七行待扫；扫描逐行可见、全灰暗无一亮起） */}
      <div style={{position: 'absolute', left: 1440, top: 300, opacity: stage[2]}}>
        <DenyListTable x={0} y={0} width={380} scale={0.6} scan={scan} count={7} dim={0.25} />
      </div>
      {/* 调用卡（rm old-notes.txt 同签——自消息条弹出滑向第一道门） */}
      <div style={{position: 'absolute', left: callX, top: 495}}>
        <CallCard x={0} y={0} en="rm old-notes.txt" w={330} h={86} tag="旧笔记" tagShow={tagShow} />
      </div>
      {/* 第一关放行注记（绿边过痕的读法锚） */}
      <div
        style={{
          position: 'absolute',
          left: 610,
          top: 640,
          fontFamily: theme.sans,
          fontSize: 22,
          fontWeight: 600,
          color: theme.ok,
          opacity: passed,
        }}
      >
        {'第一关 · 放行 ✓'}
      </div>
      <Foot2>{'DENY_LIST 扫描 · 7/7 未命中'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 2-B 第二关命中特写：rm 标签咬合 + 红标贴上 ──────────────────────────

const KW_TAGS = ['rm', '> /etc/', 'chmod 777'] as const;

const ShotB: React.FC<{atScan: number; atBite: number; atMark: number; atLeave: number}> = ({atScan, atBite, atMark, atLeave}) => {
  const frame = useCurrentFrame();
  // 扫描线扫过标签列（横扫）
  const scan = useProgress(atScan, DUR.f5, 'linear');
  // 「rm」标签亮起咬合：标签下压 + 卡上浮相向贴近（咬合 = 命中判定的具象）
  const bite = useSpring('snap', {at: atBite, dur: DUR.f4});
  const biteGlow = useImpulse({at: atBite + DUR.f3, dur: DUR.f5, peak: 1});
  // 「潜在破坏性」红标贴上卡角弹一下（marked 由卡内 alpha 呈现，punch 给外层）
  const mark = useProgress(atMark, DUR.f3);
  const punch = useImpulse({at: atMark + DUR.f2, dur: DUR.f4, peak: 0.08});
  // 卡随即滑向第三道门（镜尾离场——衔接 2-C）
  const leave = useProgress(atLeave, DUR.f5, 'accelerate');
  const cardY = 600 - 46 * bite;
  const cardX = 730 + 430 * leave;
  return (
    <AbsoluteFill>
      {/* 关键词标签墙（三标签大号横排；扫描线扫过） */}
      <div style={{position: 'absolute', left: 560, top: 330, display: 'flex', gap: 44}}>
        {KW_TAGS.map((t, i) => {
          const on = i === 0 && bite > 0.3;
          return (
            <div key={t} style={{transform: i === 0 ? `translateY(${28 * bite}px)` : 'none'}}>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 34,
                  color: on ? theme.danger : theme.dim,
                  border: `3px solid ${on ? theme.danger : theme.panelBorder}`,
                  background: on ? withAlpha(theme.danger, 0.16) : 'transparent',
                  borderRadius: 12,
                  padding: '16px 30px',
                  whiteSpace: 'nowrap',
                  boxShadow: on ? `0 0 ${30 * biteGlow}px ${withAlpha(theme.danger, 0.8)}` : 'none',
                }}
              >
                {t}
              </div>
            </div>
          );
        })}
      </div>
      {/* 扫描线（横扫过标签列——查关键词的运动面） */}
      {scan > 0.02 && scan < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: 540 + 880 * scan,
            top: 320,
            width: 4,
            height: 130,
            background: theme.text,
            opacity: 0.85,
            boxShadow: `-16px 0 18px -6px ${withAlpha(theme.text, 0.45)}`,
          }}
        />
      ) : null}
      {/* 调用卡（同签 rm old-notes.txt——已带「→ ask」流转标记；咬合时上浮） */}
      <div style={{position: 'absolute', left: cardX, top: cardY, transform: `scale(${1 + punch})`}}>
        <CallCard x={0} y={0} en="rm old-notes.txt" w={360} h={90} tag="旧笔记" tagShow={1} stampMark={mark} marked={mark} />
      </div>
      {/* 命中注记（命中标签唯一——只有 rm 亮） */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 500,
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 700,
          color: theme.danger,
          opacity: clamp01(bite - 0.4) * 2,
        }}
      >
        {'命中 · 潜在破坏性'}
      </div>
      <Foot2>{'bash 关键词 · 命中交第三道'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 2-C 第三关暂停特写：终端满幅定格悬停 ────────────────────────────────

const ShotC: React.FC<{atFreeze: number; atKeys: number; atDim: number}> = ({atFreeze, atKeys, atDim}) => {
  const frame = useCurrentFrame();
  // 终端窗满幅：警示行快速落定（承 2-B 红标随卡）→「暂停」定格
  const printP = useProgress(0, DUR.f5);
  const freezeGlow = useImpulse({at: atFreeze, dur: DUR.f5, peak: 1});
  // 「等你表态」：光标呼吸（still→定格缓闪）+ 双键虚影各闪一次
  const keysLit = [clamp01(progress(frame, atKeys, DUR.f3)), clamp01(progress(frame, atKeys + 5, DUR.f3))];
  // 镜尾全帧收暗半拍（悬念交给 2-D）
  const dimAll = useProgress(atDim, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 960 - 500, top: 280}}>
        <AskTerminal x={0} y={0} w={1000} h={470} printP={printP} keysLit={keysLit} still={1} />
      </div>
      {/* 「暂停」定格辉光（终端窗框一拍加重） */}
      {freezeGlow > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 960 - 510,
            top: 270,
            width: 1020,
            height: 490,
            borderRadius: 18,
            border: `3px solid ${theme.mech}`,
            boxShadow: `0 0 ${36 * freezeGlow}px ${withAlpha(theme.mech, 0.7)}`,
            opacity: freezeGlow,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 收暗遮罩（盖场景不盖字幕；半拍收黑） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.72 * dimAll, pointerEvents: 'none'}} />
      <Foot2>{'ask · 等你表态'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 2-D 是/否双分支等高并列（回喂同构：青=结果 / 红=拒绝） ───────────────

const ShotD: React.FC<{atYes: number; atFeedL: number; atNo: number; atFeedR: number; atFork: number}> = ({
  atYes,
  atFeedL,
  atNo,
  atFeedR,
  atFork,
}) => {
  const frame = useCurrentFrame();
  // 同一输入：调用卡分身两枚（同签同形——等高并列入左右支路）
  const splitL = useProgress(atYes - DUR.f4, DUR.f4);
  const splitR = useProgress(atNo - DUR.f4, DUR.f4);
  // 左支路（是）：执行脉冲一闪 → 结果条沿青碧流回喂（tool_result）
  const execPulse = useImpulse({at: atYes, dur: DUR.f4, peak: 1});
  const feedL = useProgress(atFeedL, DUR.f5, 'decelerate');
  const modelGoL = useProgress(atFeedL + DUR.f4, DUR.f3);
  // 右支路（否）：拒绝回执沿同构红流回喂（Permission denied.）
  const stopO = useProgress(atNo, DUR.f3);
  const feedR = useProgress(atFeedR, DUR.f5, 'decelerate');
  // 「换条路」模型侧岔路标展开
  const fork = useProgress(atFork, DUR.f4);
  const branchA = clamp01(progress(frame, atFork + 4, DUR.f3));
  const branchB = clamp01(progress(frame, atFork + 8, DUR.f3));
  const LX = 500;
  const RX = 1420;
  return (
    <AbsoluteFill>
      {/* 分支总纲签（同一输入——顶部原卡在中央） */}
      <div style={{position: 'absolute', left: 960 - 165, top: 170}}>
        <CallCard x={0} y={0} en="rm old-notes.txt" w={330} h={80} tag="旧笔记" tagShow={1} />
      </div>
      {/* 同一输入分身两枚（同签同形——等高并列入左右支路；Visual Lock） */}
      <div
        style={{
          position: 'absolute',
          left: LX - 150,
          top: 320,
          opacity: splitL,
          transform: `translateY(${(1 - splitL) * 18}px)`,
        }}
      >
        <CallCard x={0} y={0} en="rm old-notes.txt" w={300} h={74} tag="旧笔记" tagShow={1} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: RX - 150,
          top: 320,
          opacity: splitR,
          transform: `translateY(${(1 - splitR) * 18}px)`,
        }}
      >
        <CallCard x={0} y={0} en="rm old-notes.txt" w={300} h={74} tag="旧笔记" tagShow={1} />
      </div>
      {/* 分流线（原卡 → 左右支路；左右等高镜像） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <path d={`M 960 262 Q ${LX + 60} 300, ${LX} 420`} fill="none" stroke={withAlpha(theme.dim, 0.55)} strokeWidth={3} strokeDasharray="8 8" opacity={splitL} />
        <path d={`M 960 262 Q ${RX - 60} 300, ${RX} 420`} fill="none" stroke={withAlpha(theme.dim, 0.55)} strokeWidth={3} strokeDasharray="8 8" opacity={splitR} />
        {/* 左支路回喂流（青碧=结果——同构弧） */}
        <path
          d={`M ${LX} 470 C ${LX - 150} 660, ${LX + 150} 700, ${LX} 880`}
          fill="none"
          stroke={withAlpha(theme.tool, 0.65)}
          strokeWidth={4}
          strokeDasharray="12 10"
          opacity={splitL}
        />
        {/* 右支路回喂流（红=拒绝——同构弧镜像；拒绝也是信息） */}
        <path
          d={`M ${RX} 470 C ${RX + 150} 660, ${RX - 150} 700, ${RX} 880`}
          fill="none"
          stroke={withAlpha(theme.danger, 0.65)}
          strokeWidth={4}
          strokeDasharray="12 10"
          opacity={splitR}
        />
      </svg>
      {/* ── 左支路（是）：执行窗 + 结果条回喂 + 模型接着干 ── */}
      <div style={{position: 'absolute', left: LX - 160, top: 400, opacity: splitL}}>
        <Panel accent={theme.tool} style={{width: 320, height: 140, boxSizing: 'border-box', padding: '14px 20px', boxShadow: `0 0 ${26 * execPulse}px ${withAlpha(theme.tool, 0.8)}`}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'命令执行'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>{'removed old-notes.txt'}</div>
        </Panel>
      </div>
      {/* 结果条（tool_result——沿青碧流回喂模型侧） */}
      {feedL > 0.02 && feedL < 1 ? (
        <div style={{position: 'absolute', left: LX - 110, top: 470 + 410 * feedL, opacity: splitL}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 10,
              border: `2px solid ${theme.tool}`,
              background: theme.panel,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.tool}}>{'tool_result'}</span>
          </div>
        </div>
      ) : null}
      {/* ⑨ QA W2：模型脑行统一 top 878（原 890——左右支路镜像错位 12px 且压字幕安全带） */}
      <div style={{position: 'absolute', left: LX - 32, top: 878, opacity: splitL, display: 'flex', alignItems: 'center', gap: 16}}>
        <BrainGlyph color={modelGoL > 0.5 ? theme.text : theme.dim} s={0.85} />
        <span style={{fontFamily: theme.sans, fontSize: 22, color: modelGoL > 0.5 ? theme.text : theme.dim}}>{'接着干'}</span>
      </div>
      {/* ── 右支路（否）：拒绝回执回喂 + 止步符 + 岔路标 ── */}
      <div style={{position: 'absolute', left: RX - 160, top: 400, opacity: splitR}}>
        <Panel accent={theme.danger} style={{width: 320, height: 140, boxSizing: 'border-box', padding: '14px 20px', position: 'relative'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'不执行'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.danger, marginTop: 6}}>{'Permission denied.'}</div>
          {/* 止步符（此路不通——执行侧红色断路；「已拦截」语义正当：真被拦） */}
          <svg width={40} height={40} viewBox="0 0 40 40" style={{position: 'absolute', right: 14, top: 14, opacity: stopO}}>
            <circle cx={20} cy={20} r={16} fill="none" stroke={theme.danger} strokeWidth={4} />
            <line x1={9} y1={9} x2={31} y2={31} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
          </svg>
        </Panel>
      </div>
      {/* 拒绝回执帧（沿红流回喂模型侧——同构通路） */}
      {feedR > 0.02 && feedR < 1 ? (
        <div style={{position: 'absolute', left: RX - 130, top: 470 + 410 * feedR, opacity: splitR}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 10,
              border: `2px solid ${theme.danger}`,
              background: theme.panel,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.danger}}>{'Permission denied.'}</span>
          </div>
        </div>
      ) : null}
      {/* 模型侧岔路标（换条路——两支岔出的新路）。
          ⑨ QA W2：岔路 svg 上提（top -12→-30）、「换条路」签移至 svg 右侧
          （top 878+14=892）——整组守住字幕清线上方（top≤900），消除压线 */}
      <div style={{position: 'absolute', left: RX - 130, top: 878, opacity: splitR}}>
        <BrainGlyph color={theme.text} s={0.85} />
        <svg width={190} height={70} style={{position: 'absolute', left: 60, top: -30, overflow: 'visible', opacity: fork}}>
          <path d="M 10 46 Q 70 20, 120 8" fill="none" stroke={theme.mech} strokeWidth={3.5} strokeDasharray="8 7" opacity={branchA} />
          <path d="M 10 46 Q 80 52, 150 50" fill="none" stroke={theme.mech} strokeWidth={3.5} strokeDasharray="8 7" opacity={branchB} />
          <path d="M 114 2 L 128 8 L 118 18 Z" fill={theme.mech} opacity={branchA} />
          <path d="M 144 44 L 158 50 L 146 58 Z" fill={theme.mech} opacity={branchB} />
        </svg>
        <span style={{position: 'absolute', left: 262, top: 14, fontFamily: theme.sans, fontSize: 21, color: theme.mech, opacity: fork, whiteSpace: 'nowrap'}}>换条路</span>
      </div>
      <Foot2>{'是 · 结果回喂 ｜ 否 · 拒绝也是信息'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 2-E 第一道门弹回特写：sudo 撞行 + 大问号悬念 ────────────────────────

/** sudo 卡直冲撞行 → 原路弹回坠出（与 1-B HitBounceCard 同款轨迹——机制复现） */
const SudoDash: React.FC<{atDash: number; flash: number}> = ({atDash, flash}) => {
  const inbound = useProgress(atDash, DUR.f4, 'accelerate');
  const rebound = useSpring('settleSoft', {at: atDash + DUR.f4, dur: DUR.f5});
  const dropOut = useProgress(atDash + DUR.f5 + DUR.f3, DUR.f5, 'accelerate');
  const x = 1520 + (900 - 1520) * inbound + 380 * rebound;
  const y = 470 + (560 - 470) * inbound + (120 + 340 * dropOut) * rebound;
  const o = useProgress(atDash - DUR.f3, DUR.f3) * (1 - dropOut * 0.9);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: o, transform: 'translate(-50%,-50%)'}}>
      <div
        style={{
          padding: '10px 24px',
          borderRadius: 10,
          border: `2.5px solid ${theme.danger}`,
          background: theme.panel,
          boxShadow: `0 0 ${26 * flash}px ${withAlpha(theme.danger, 0.8)}`,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 25, color: theme.danger}}>{'sudo …'}</span>
      </div>
    </div>
  );
};

const ShotE: React.FC<{atDash: number; atGrey: number; atQ: number; atBlack: number}> = ({atDash, atGrey, atQ, atBlack}) => {
  const frame = useCurrentFrame();
  const tableIn = useEnter('rise', {at: 0, dur: DUR.f4, dist: 18});
  // 撞「sudo」行命中：hitRow=1 + hitFlash（行高亮沿闪）
  const flash = useImpulse({at: atDash + DUR.f4, dur: DUR.f5, peak: 1});
  // 问人门图标全程暗置；「根本没人问你」灰置一拍加重
  const greyPulse = useImpulse({at: atGrey, dur: DUR.f4, peak: 1});
  const greyBase = 0.35 + 0.15 * greyPulse;
  // 大问号落下悬停第一道门上方（盖过第一道门？——悬念）
  const qDrop = useSpring('settle', {at: atQ, dur: DUR.f5});
  const qY = -140 + 330 * qDrop;
  const qBreathe = 0.75 + 0.25 * Math.sin(frame / 16);
  // 半拍收黑（悬念交给下一幕）
  const black = useProgress(atBlack, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{...tableIn, position: 'absolute', left: 520, top: 330}}>
        <DenyListTable x={0} y={0} width={680} hitRow={1} hitFlash={flash} count={7} />
      </div>
      {/* 第一道闸卡（deny——撞行命中的门本体） */}
      <div style={{position: 'absolute', left: 1180, top: 620}}>
        <GateCard x={0} y={0} w={150} h={140} kind="deny" lit={1} hitFlash={flash} showName={false} />
      </div>
      {/* 问人门图标（全程暗置在位——sudo 卡不近它；「根本没人问你」灰置一拍） */}
      <div style={{position: 'absolute', left: 1580, top: 220, opacity: greyBase}}>
        <GateCard x={0} y={0} w={120} h={112} kind="ask" lit={0.45} ghost={0.75} showName={false} />
        <div style={{position: 'absolute', left: 6, top: 118, fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'没人问'}</div>
      </div>
      {/* sudo 卡：直冲撞行、原路弹回坠出画面（同款弹回轨迹） */}
      <SudoDash atDash={atDash} flash={flash} />
      {/* 大问号（落下悬停第一道门上方——用户点头，能不能盖过第一道门？） */}
      {qDrop > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 1225,
            top: qY,
            fontFamily: theme.serif,
            fontSize: 150,
            fontWeight: 700,
            color: theme.mech,
            opacity: clamp01(qDrop) * qBreathe,
            textShadow: `0 0 ${30 * clamp01(qDrop)}px ${withAlpha(theme.mech, 0.6)}`,
          }}
        >
          ?
        </div>
      ) : null}
      {/* 半拍收黑（盖场景不盖字幕） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.85 * black, pointerEvents: 'none'}} />
      <Foot2>{'sudo · 黑名单直接拦下'}</Foot2>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2GateWalkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03');
  const bC = w('p2-04');
  const bD = w('p2-05', 'p2-06');
  const bE = w('p2-07', 'p2-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <ShotA
          atStage={wa('p2-01', 0.2) - bA.from}
          atCall={wa('p2-01', 0.45) - bA.from}
          atTag={wa('p2-01', 0.75) - bA.from}
          atScan={wa('p2-02', 0.25) - bA.from}
          atPass={wa('p2-02', 0.72) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <ShotB
          atScan={wa('p2-03', 0.25) - bB.from}
          atBite={wa('p2-03', 0.48) - bB.from}
          atMark={wa('p2-03', 0.78) - bB.from}
          atLeave={at('p2-03') + dur('p2-03') - Math.min(12, dur('p2-03') / 4) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <ShotC atFreeze={wa('p2-04', 0.22) - bC.from} atKeys={wa('p2-04', 0.6) - bC.from} atDim={wa('p2-04', 0.88) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <ShotD
          atYes={wa('p2-05', 0.22) - bD.from}
          atFeedL={wa('p2-05', 0.55) - bD.from}
          atNo={wa('p2-06', 0.18) - bD.from}
          atFeedR={wa('p2-06', 0.5) - bD.from}
          atFork={wa('p2-06', 0.82) - bD.from}
        />
      </Sequence>
      <Sequence {...bE} name="2-E">
        <ShotE
          atDash={wa('p2-07', 0.3) - bE.from}
          atGrey={wa('p2-07', 0.75) - bE.from}
          atQ={wa('p2-08', 0.4) - bE.from}
          atBlack={wa('p2-08', 0.82) - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2GateWalkthrough;
