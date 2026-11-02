/** P4 通道与权限闸（p4-01..p4-11，3 镜）——分镜 4-A / 4-B / 4-C。
 *
 *  幕间转场（3-C→4-A，头注明示）：语义断裂（教学版消融→生产版全景）走
 *  SceneFade + 拉远重锚，不 morph（消融舞台与通道矩阵拓扑断裂，承 ep2 3-C→4-A
 *  / ep18 3-D→4-A 判例）；教学装置退为暗层剪影。4-C→5-A 同走 SceneFade +
 *  环体同形签名回归（镜间身份恒常，非 morph，承 ep2/ep18 判例）。
 *
 *  叙事链：4-A 拉远降压全景（生产版通道矩阵）：p4-01「真实的」词落位拉远重锚
 *  起势、生产舞台空置一拍 → p4-02「通道」词落位六通道 stagger 依次点亮〔M-005〕
 *  （数字镜：六格通道带——通道计数 6 与口播一致，格带即基线）、「传输」词落位
 *  通道组上方「传输」总签亮出 → p4-03「本地起子进程」词落位本地族通道亮起+
 *  子进程小图闪一拍、远程网页协议/开发工具内嵌/进程内直接调用各词落位对应
 *  形态签点亮（四签盖六通道的映射连线一闪即收）→ p4-04「分批并发」词落位
 *  本地批/远程批两枚分组框先后落下、批内通道齐闪（并发）、「整套认证」词落位
 *  认证徽记亮出（角标 OAuth）、「按类重连」词落位重连回路小图转一圈 → 4-B
 *  权限闸特写：p4-05「自称只读」词落位自我介绍卡飘至闸门〔M-005〕、「不算数」
 *  词落位闸门判读窗对卡扫描线掠过即空、不留任何判读痕（不看介绍的具象——
 *  X-001 逆旁白防线：扫描线不留痕即机制红线）、卡上「只读」字样划灰（失效
 *  终态）→ p4-06「授权只认宿主配置」词落位闸门翻开宿主名单（角标
 *  MCP_HOST_POLICY）、「宿主」词落位闸后主程序轮廓亮起 → p4-07「名单四条」
 *  词落位四条目 stagger 翻出（三绿一黄——G1 修正口径：docs/search ·
 *  docs/get_version · deploy/status = allow、deploy/trigger = confirm；
 *  deploy/status 中文名「查部署状态」与 P2「查状态」卡对齐）、「就是触发部署」
 *  词落位 deploy/trigger 条目黄签放大一拍（回环点名 P2 走查例——池内对应卡
 *  暗层呼应闪）、「每次都问」词落位黄签挂「每次问」小标 → p4-08「名单之外」
 *  词落位一枚名单外工具卡飞向闸门→弹至「问用户」位（用户图标亮起一拍）→
 *  4-C 官方印证条（拉半档）：p4-09「按全名写」词落位权限规则卡亮出（规则行
 *  全名串点亮——对照表左列语义回声）、「批准了才加载」词落位批准卡两段微流
 *  走一遍 → p4-10「插件」词落位插件包卡嵌入主程序轮廓、「多一段插件名」词
 *  落位全名分段条亮出（插件全名比普通全名多一段插件节——分段逐节点亮对照）→
 *  p4-11「不能当授权依据」词落位三卡上浮定格+原则短签「自我描述 ≠ 授权」
 *  落定（幕点原则句，重音镜收拍）〔M-003〕。
 *
 *  空间契约（安全带实算）：4-A 通道底 270+420=690 + 角标底 ≈ 722 / 分组框底
 *  735 / 本地批括号底 775 / 深处剪影底 ≤ 810；4-B 闸底 250+420=670 / 名单带
 *  在闸内 / 名单外卡飞道 ≤ 560 / 「问用户」位底 ≈ 700 / 池暗层底 600+190=790；
 *  4-C 三卡底 380+340=720 / 原则短签底 770+56=826（上浮后 ≈ 800）——全部
 *  ≤ 860。红线落实：六通道等距并排、通道名只进角标、批量数字不上屏（本地 3/
 *  远程 20 属【三】级弃用素材）、形态签为关键词标签、映射连线一闪即收、名单
 *  条目与 main 轨口径一致（四条·三绿一黄·教学版角标）、「只读」划灰后不复
 *  亮、「问用户」位为唯一用户图标、插片段色染不过界、原则短签 ≤6 字、全名串
 *  只进角标。词落位 = wa(id,f)。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ChannelLane, LoopRing, PermissionGate, ToolPool} from '../components/motifs';
import {clamp01, progress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 拉远降压全景：六通道矩阵 + 形态签 + 分组框 + 认证/重连 ─────────────────

/** 4-A 布局（安全带实算见头注；六通道等距并排——本地族 stdio/IDE/SDK 非连续，
 *  本地批用下缘括线连三段、远程批 HTTP/SSE/WebSocket 连续用框，分组归属
 *  忠实于 s19f 附录口径不上批量数字） */
const DA = {
  lanes: [
    {x: 400, tag: 'stdio'},
    {x: 570, tag: 'HTTP'},
    {x: 740, tag: 'SSE'},
    {x: 910, tag: 'WebSocket'},
    {x: 1080, tag: 'IDE'},
    {x: 1250, tag: 'SDK'},
  ],
  laneY: 270,
  laneH: 420,
  signs: [
    {x: 340, w: 180, label: '本地子进程', lanes: [0]},
    {x: 545, w: 560, label: '远程网页协议', lanes: [1, 2, 3]},
    {x: 1042, w: 200, label: '开发工具内嵌', lanes: [4]},
    {x: 1242, w: 190, label: '进程内调用', lanes: [5]},
  ],
} as const;
const AUTH_4A = {x: 1560, y: 290} as const;
const RECONN_4A = {x: 1560, y: 520} as const;

const FourA: React.FC<{atPull: number; atLanes: number; atTransSign: number; atLocal: number; atRemote: number; atIde: number; atSdk: number; atMap: number; atBatch: number; atAuth: number; atReconn: number}> = ({
  atPull,
  atLanes,
  atTransSign,
  atLocal,
  atRemote,
  atIde,
  atSdk,
  atMap,
  atBatch,
  atAuth,
  atReconn,
}) => {
  const frame = useCurrentFrame();
  // 拉远重锚（3-C 峰值降压——首 16 帧自 1.08 缩回落位）
  const pull = ease(clamp01(progress(frame, atPull, 16)));
  // 六通道 stagger 依次点亮（数字镜：通道计数 6——格带即基线）
  const laneLit = (i: number) => clamp01(progress(frame, atLanes + i * 4, 10));
  // 「传输」总签（口播白话先释的就地标注）
  const transSign = clamp01(progress(frame, atTransSign, 12));
  // 四枚形态签点亮（口播四形态盖满六种）
  const signLit = [clamp01(progress(frame, atLocal, 10)), clamp01(progress(frame, atRemote, 10)), clamp01(progress(frame, atIde, 10)), clamp01(progress(frame, atSdk, 10))];
  // 子进程小图闪一拍（本地族）
  const procFlash = Math.sin(Math.PI * clamp01(progress(frame, atLocal + 8, 16)));
  // 映射连线一闪即收（四签盖六通道——辅助不常驻）
  const mapP = Math.sin(Math.PI * clamp01(progress(frame, atMap, 18)));
  // 分组框落下 + 批内通道齐闪（并发）
  const batchLocal = clamp01(progress(frame, atBatch, 12));
  const batchRemote = clamp01(progress(frame, atBatch + 10, 12));
  const batchFlash = Math.sin(Math.PI * clamp01(progress(frame, atBatch + 16, 16)));
  // 认证徽记亮出（角标 OAuth）
  const auth = clamp01(progress(frame, atAuth, 12));
  // 重连回路小图转一圈（断线→归类的循环微演示）
  const reconn = clamp01(progress(frame, atReconn, 26));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1.08 - 0.08 * pull})`, transformOrigin: '50% 40%'}}>
        {/* 镜深处教学版舞台（退为暗层剪影——环体+池，不显机制细节） */}
        <div style={{position: 'absolute', left: 130, top: 520, opacity: 0.22}}>
          <LoopRing size={140} draw={1} nodes={[]} showExit={false} />
        </div>
        <div style={{position: 'absolute', left: 120, top: 640, width: 260, height: 150, opacity: 0.22}}>
          <ToolPool x={0} y={0} w={260} h={150} litP={1} outlineP={1} labelP={0} />
        </div>
        {/* 六条传输通道（竖列并排——兰紫渐进；通道名只进角标） */}
        {DA.lanes.map((ln, i) => (
          <ChannelLane key={`ln${i}`} x={ln.x} y={DA.laneY} w={130} h={DA.laneH} litP={Math.max(laneLit(i), batchFlash * 0.4)} tag={ln.tag} t={frame} />
        ))}
        {/* 「传输」总签（通道组上方——白话先释就地标注） */}
        {transSign > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 705,
              top: 186,
              padding: '8px 26px',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.svc, 0.5 + 0.5 * transSign)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 24,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: transSign,
            }}
          >
            传输 · 把工具连过来的通道
          </div>
        ) : null}
        {/* 四枚形态签（关键词标签——悬于对应通道上方） */}
        {DA.signs.map((sg, i) => {
          const lit = signLit[i];
          return (
            <div
              key={`sg${i}`}
              style={{
                position: 'absolute',
                left: sg.x,
                top: 132,
                width: sg.w,
                height: 44,
                borderRadius: 9,
                border: `2.5px solid ${withAlpha(theme.svc, 0.3 + 0.7 * lit)}`,
                background: withAlpha(theme.panel, 0.96),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 18,
                fontWeight: 700,
                color: lit > 0.5 ? theme.text : theme.dim,
                whiteSpace: 'nowrap',
                opacity: 0.45 + 0.55 * lit,
              }}
            >
              {sg.label}
            </div>
          );
        })}
        {/* 子进程小图（本地族通道顶——闪一拍） */}
        {procFlash > 0.05 ? (
          <div style={{position: 'absolute', left: DA.lanes[0].x + 31, top: DA.laneY - 66, opacity: procFlash}}>
            <svg width={68} height={58} viewBox="0 0 68 58">
              <rect x={4} y={10} width={60} height={44} rx={8} fill={withAlpha(theme.panel, 0.97)} stroke={theme.svc} strokeWidth={3} />
              <rect x={12} y={20} width={44} height={7} rx={3} fill={withAlpha(theme.svc, 0.5)} />
              <rect x={12} y={32} width={30} height={7} rx={3} fill={withAlpha(theme.svc, 0.35)} />
            </svg>
          </div>
        ) : null}
        {/* 映射连线（四签→六通道——一闪即收，辅助不常驻） */}
        {mapP > 0.04 ? (
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            {DA.signs.map((sg, i) =>
              sg.lanes.map((li) => (
                <line
                  key={`mp${i}-${li}`}
                  x1={sg.x + sg.w / 2}
                  y1={178}
                  x2={DA.lanes[li].x + 65}
                  y2={DA.laneY - 4}
                  stroke={theme.dim}
                  strokeWidth={2.5}
                  opacity={0.7 * mapP}
                />
              )),
            )}
          </svg>
        ) : null}
        {/* 远程批分组框（HTTP/SSE/WebSocket 连续段） */}
        {batchRemote > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 548,
              top: 252,
              width: 576,
              height: 484,
              borderRadius: 18,
              border: `3px dashed ${withAlpha(theme.svc, 0.45 + 0.35 * batchRemote)}`,
              opacity: batchRemote,
              pointerEvents: 'none',
            }}
          >
            <span style={{position: 'absolute', left: 18, top: -16, padding: '2px 14px', borderRadius: 7, border: `2.5px solid ${withAlpha(theme.svc, 0.7)}`, background: withAlpha(theme.panel, 0.97), fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
              远程批
            </span>
          </div>
        ) : null}
        {/* 本地批括线（stdio/IDE/SDK 非连续段——下缘括线连三段，归属忠实） */}
        {batchLocal > 0.02 ? (
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: batchLocal}}>
            <path d={`M 400 726 V 756 H 1380 V 726`} fill="none" stroke={withAlpha(theme.svc, 0.65)} strokeWidth={3.5} strokeDasharray="12 8" />
            <line x1={855} y1={756} x2={855} y2={770} stroke={withAlpha(theme.svc, 0.4)} strokeWidth={3} strokeDasharray="12 8" />
            <text x={410} y={790} fontFamily={theme.sans} fontSize={16} fontWeight={700} fill={theme.text}>
              本地批
            </text>
          </svg>
        ) : null}
        {/* 认证徽记（远程整套认证——角标 OAuth） */}
        {auth > 0.02 ? (
          <div style={{position: 'absolute', left: AUTH_4A.x, top: AUTH_4A.y, opacity: auth, transform: `scale(${0.85 + 0.15 * auth})`}}>
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                border: `4px solid ${theme.svc}`,
                background: withAlpha(theme.panel, 0.97),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <svg width={54} height={54} viewBox="0 0 54 54">
                <circle cx={27} cy={27} r={16} fill="none" stroke={theme.svc} strokeWidth={4.5} />
                <line x1={38} y1={38} x2={50} y2={50} stroke={theme.svc} strokeWidth={5.5} strokeLinecap="round" />
              </svg>
              <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>认证</span>
            </div>
            <div style={{position: 'absolute', left: 0, top: 156, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.9}}>
              OAuth
            </div>
          </div>
        ) : null}
        {/* 重连回路小图（断线→归类的循环微演示——转一圈） */}
        {reconn > 0.02 ? (
          <div style={{position: 'absolute', left: RECONN_4A.x, top: RECONN_4A.y, opacity: clamp01(reconn * 2)}}>
            <svg width={150} height={130} viewBox="0 0 150 130">
              <path
                d="M118 65 A 43 43 0 1 1 99.6 32.4"
                fill="none"
                stroke={theme.svc}
                strokeWidth={5}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - reconn}
              />
              <path d="M99.6 22 L99.6 32.4 L110 32.4" fill="none" stroke={theme.svc} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{position: 'absolute', left: 0, top: 138, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
              断线按类重连
            </div>
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'六种传输 · 四种形态盖满 · 本地远程分批并发'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 权限闸特写：判读窗不留痕 + 宿主名单三绿一黄 + 问用户位 ──────────────────

/** 4-B 布局（安全带实算见头注；闸体 250..670；名单四条 G1 修正口径） */
const DB = {
  gate: {x: 730, y: 250, w: 460, h: 420},
  intro: {x: 1230, y: 300, w: 300, h: 140},
  ask: {x: 1560, y: 560},
  pool: {x: 180, y: 600, w: 340, h: 190},
} as const;
/** 宿主名单（main 轨 code.py L205-210：docs/search · docs/get_version ·
 *  deploy/status = allow / deploy/trigger = confirm——三绿一黄，教学版口径） */
const HOST_ENTRIES = [
  {tag: 'docs/search', kind: 'allow' as const},
  {tag: 'docs/get_version', kind: 'allow' as const},
  {tag: 'deploy/status', kind: 'allow' as const},
  {tag: 'deploy/trigger', kind: 'confirm' as const},
];

const FourB: React.FC<{atIntro: number; atScan: number; atStrike: number; atList: number; atHost: number; atEntries: number; atHot: number; atAskTag: number; atOutside: number; atUser: number}> = ({
  atIntro,
  atScan,
  atStrike,
  atList,
  atHost,
  atEntries,
  atHot,
  atAskTag,
  atOutside,
  atUser,
}) => {
  const frame = useCurrentFrame();
  // 自我介绍卡自侧飘向闸门
  const intro = ease(clamp01(progress(frame, atIntro, 18)));
  // 判读窗扫描线掠过即空（不留任何判读痕——X-001 逆旁白防线）
  const scan = clamp01(progress(frame, atScan, 14));
  // 卡上「只读」字样划灰（失效终态——不复亮）
  const strike = clamp01(progress(frame, atStrike, 12));
  // 闸门翻开宿主名单 + 闸后主程序轮廓亮起
  const list = clamp01(progress(frame, atList, 16));
  const host = clamp01(progress(frame, atHost, 12));
  // 四条目 stagger 翻出
  const entry = (i: number) => clamp01(progress(frame, atEntries + i * 6, 10));
  // deploy/trigger 黄签放大一拍（回环点名 P2 走查例）+ 池内对应卡暗层呼应闪
  const hot = Math.sin(Math.PI * clamp01(progress(frame, atHot, 20)));
  const hotHold = clamp01(progress(frame, atHot, 20));
  // 黄签「每次问」小标
  const askTag = clamp01(progress(frame, atAskTag, 10));
  // 名单外工具卡飞向闸门 → 弹至「问用户」位（用户图标亮起一拍）
  const outside = clamp01(progress(frame, atOutside, 20));
  const toAsk = clamp01(progress(frame, atUser, 18));
  const userGlow = Math.sin(Math.PI * clamp01(progress(frame, atUser + 10, 16)));
  // 飞道：自 (1000,140) → 闸门 (960, 400) → 弹至问用户位 (1620, 590)
  const outX = 1000 + outside * -40;
  const outY = 140 + outside * 260;
  const askX = outX + toAsk * (1620 - outX);
  const askY = outY + toAsk * (590 - outY) - Math.sin(Math.PI * toAsk) * 60;
  return (
    <AbsoluteFill>
      {/* 权限闸（深灰门体 + 判读窗 + 宿主名单四条三绿一黄） */}
      <PermissionGate
        x={DB.gate.x}
        y={DB.gate.y}
        w={DB.gate.w}
        h={DB.gate.h}
        litP={1}
        scanP={scan}
        listP={list}
        hostP={host}
        hotP={hot}
        askP={askTag}
        entries={HOST_ENTRIES.map((e, i) => ({...e, litP: entry(i)}))}
      />
      {/* 自我介绍卡（「我是只读的」+ readOnlyHint 角标——飘向闸门；划灰终态） */}
      <div style={{position: 'absolute', left: DB.intro.x - (1 - intro) * 320, top: DB.intro.y, opacity: intro}}>
        <div
          style={{
            width: DB.intro.w,
            height: DB.intro.h,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.dim, 0.6)}`,
            background: withAlpha(theme.panel, 0.97),
            padding: '14px 20px',
            filter: `grayscale(${strike * 0.8})`,
            opacity: 1 - strike * 0.35,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', textDecoration: strike > 0.4 ? 'line-through' : 'none'}}>
            我是只读的
          </div>
          <div style={{marginTop: 10, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
            readOnlyHint
          </div>
          <div style={{marginTop: 12, height: 8, borderRadius: 4, width: 180, background: withAlpha(theme.dim, 0.25)}} />
        </div>
      </div>
      {/* 镜深处池内对应工具卡呼应位（暗层——P2/P3 走查工具回环） */}
      <div style={{position: 'absolute', left: DB.pool.x, top: DB.pool.y, opacity: 0.3 + 0.25 * hot}}>
        <ToolPool
          x={0}
          y={0}
          w={DB.pool.w}
          h={DB.pool.h}
          litP={1}
          fillP={1}
          labelP={0}
          cards={[
            {name: '查部署状态', litP: hotHold},
            {name: '触发部署', litP: hotHold},
          ]}
        />
        <div style={{position: 'absolute', left: 0, top: -28, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
          池内呼应 · 暗层
        </div>
      </div>
      {/* 名单外工具卡（飞向闸门 → 弹至「问用户」位——有轨迹） */}
      {outside > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: askX,
            top: askY,
            padding: '7px 16px',
            borderRadius: 9,
            border: `2.5px solid ${toAsk > 0.5 ? theme.warn : theme.dim}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 17,
            fontWeight: 700,
            color: toAsk > 0.5 ? theme.warn : theme.dim,
            whiteSpace: 'nowrap',
            opacity: 1 - Math.max(0, toAsk - 0.94) * 14,
            transform: `rotate(${toAsk * -6}deg)`,
          }}
        >
          名单外工具
        </div>
      ) : null}
      {/* 「问用户」位（唯一用户图标——确认位） */}
      <div style={{position: 'absolute', left: DB.ask.x, top: DB.ask.y, opacity: 0.35 + 0.65 * toAsk}}>
        <svg width={92} height={92} viewBox="0 0 92 92" style={{overflow: 'visible'}}>
          <circle cx={46} cy={32} r={17} fill="none" stroke={theme.text} strokeWidth={4.5} />
          <path d="M12 82 C 20 58, 72 58, 80 82" fill="none" stroke={theme.text} strokeWidth={4.5} strokeLinecap="round" />
          {userGlow > 0.05 ? <circle cx={46} cy={54} r={44 + 8 * userGlow} fill="none" stroke={withAlpha(theme.text, 0.5 * userGlow)} strokeWidth={3} /> : null}
        </svg>
        <div style={{position: 'absolute', left: -6, top: 96, width: 110, textAlign: 'center', fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          问用户
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'自称只读不算数 · 授权只认宿主名单 · 名单之外先问用户'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 官方印证条（拉半档）：规则卡 + 批准卡 + 插件全名分段对照 + 原则短签 ─────

/** 4-C 布局（安全带实算：三卡 380..720（上浮 -26 后 ≈ 694）/ 原则短签
 *  770..826（上浮后 ≈ 800），恒 ≤ 860） */
const DC = {
  cards: [
    {x: 130, title: '权限规则卡', tag: 'permission rules'},
    {x: 665, title: '项目服务批准卡', tag: '.mcp.json'},
    {x: 1200, title: '插件工具全名卡', tag: 'plugin'},
  ],
  cardY: 380,
  cardW: 500,
  cardH: 340,
  sign: {x: 790, y: 770},
} as const;

const FourC: React.FC<{atRule: number; atApprove: number; atLoad: number; atPlugin: number; atEmbed: number; atSegs: number; atFloat: number; atSign: number}> = ({
  atRule,
  atApprove,
  atLoad,
  atPlugin,
  atEmbed,
  atSegs,
  atFloat,
  atSign,
}) => {
  const frame = useCurrentFrame();
  // 权限规则卡亮出（规则行全名串点亮——对照表左列语义回声）
  const rule = clamp01(progress(frame, atRule, 14));
  // 批准卡两段微流（批准→加载）
  const approve = clamp01(progress(frame, atApprove, 12));
  const load = clamp01(progress(frame, atLoad, 12));
  // 插件包嵌入主程序轮廓（装进主程序、成包扩展）
  const plugin = clamp01(progress(frame, atPlugin, 12));
  const embed = clamp01(progress(frame, atEmbed, 16));
  // 全名分段条（普通全名 vs 插件全名——分段逐节点亮对照）
  const segs = clamp01(progress(frame, atSegs, 18));
  // 三卡上浮定格 + 原则短签落定
  const float = ease(clamp01(progress(frame, atFloat, 14)));
  const sign = clamp01(progress(frame, atSign, 12));
  const cardBox = (x: number, children: React.ReactNode) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: DC.cardY - float * 26,
        width: DC.cardW,
        height: DC.cardH,
        borderRadius: 16,
        border: `3.5px solid ${withAlpha(theme.panelBorder, 0.95)}`,
        background: withAlpha(theme.panel, 0.97),
        padding: '18px 24px',
      }}
    >
      {children}
    </div>
  );
  return (
    <AbsoluteFill>
      {/* 卡一：权限规则卡（按全名写——规则行全名串点亮） */}
      {cardBox(
        DC.cards[0].x,
        <>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>权限规则卡</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>按完整工具名书写</span>
          </div>
          {['mcp__deploy__trigger', 'mcp__docs__search'].map((r, i) => (
            <div
              key={`rl${i}`}
              style={{
                marginTop: 18,
                padding: '12px 16px',
                borderRadius: 9,
                border: `2.5px solid ${withAlpha(theme.pool, 0.3 + 0.6 * rule)}`,
                background: withAlpha(theme.pool, 0.08 * rule),
                fontFamily: theme.mono,
                fontSize: 16,
                fontWeight: 700,
                color: rule > 0.5 ? theme.text : theme.dim,
                whiteSpace: 'nowrap',
                opacity: rule,
              }}
            >
              {r}
              <span style={{fontFamily: theme.sans, fontSize: 14, color: theme.dim, marginLeft: 14}}>须每次确认</span>
            </div>
          ))}
          <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: rule * 0.9}}>
            对照表左列的全名 · 同一路写法
          </div>
        </>,
      )}
      {/* 卡二：项目服务批准卡（.mcp.json——批准→加载两段微流） */}
      {cardBox(
        DC.cards[1].x,
        <>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>项目服务批准卡</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>.mcp.json</span>
          </div>
          <div style={{position: 'absolute', left: 24, top: 96, display: 'flex', alignItems: 'center', gap: 0}}>
            {[
              {label: '项目服务', p: 1},
              {label: '用户批准', p: approve},
              {label: '加载', p: load},
            ].map((n, i) => (
              <React.Fragment key={`fl${i}`}>
                {i > 0 ? (
                  <svg width={64} height={40} viewBox="0 0 64 40">
                    <line x1={4} y1={20} x2={44} y2={20} stroke={i === 1 ? withAlpha(theme.ok, 0.4 + 0.6 * load) : withAlpha(theme.ok, 0.4 + 0.6 * approve)} strokeWidth={3.5} strokeDasharray="7 6" />
                    <path d="M44 12 L58 20 L44 28 Z" fill={i === 1 ? withAlpha(theme.ok, 0.4 + 0.6 * load) : withAlpha(theme.ok, 0.4 + 0.6 * approve)} />
                  </svg>
                ) : null}
                <div
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    border: `2.5px solid ${withAlpha(i === 1 ? theme.ok : theme.pool, 0.35 + 0.65 * n.p)}`,
                    background: withAlpha(i === 1 ? theme.ok : theme.pool, 0.1 * n.p),
                    fontFamily: theme.sans,
                    fontSize: 17,
                    fontWeight: 700,
                    color: n.p > 0.5 ? theme.text : theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: 0.5 + 0.5 * n.p,
                  }}
                >
                  {n.label}
                </div>
              </React.Fragment>
            ))}
          </div>
          <div style={{position: 'absolute', left: 24, bottom: 20, fontFamily: theme.sans, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.9}}>
            批准了才加载
          </div>
        </>,
      )}
      {/* 卡三：插件工具全名卡（插件包嵌主程序 + 全名分段对照） */}
      {cardBox(
        DC.cards[2].x,
        <>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>插件工具全名卡</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>mcp__plugin_…</span>
          </div>
          {/* 插件包嵌入主程序轮廓（装进主程序、成包扩展） */}
          <div style={{position: 'absolute', left: 24, top: 78, width: 200, height: 120}}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 12,
                border: `3px dashed ${withAlpha(theme.pool, 0.6)}`,
                background: withAlpha(theme.pool, 0.05),
              }}
            >
              <div style={{position: 'absolute', left: 10, top: 8, fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
                主程序
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                left: 30 + embed * 34,
                top: 40,
                width: 140,
                height: 60,
                borderRadius: 9,
                border: `3px solid ${theme.svc}`,
                background: withAlpha(theme.svc, 0.14),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 17,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                opacity: plugin,
              }}
            >
              插件包
            </div>
          </div>
          {/* 全名分段条（普通 vs 插件——插件节多一段，分段染色对照） */}
          <div style={{position: 'absolute', left: 24, top: 218, width: DC.cardW - 48, opacity: segs}}>
            <div style={{display: 'flex', gap: 6, marginBottom: 10}}>
              {[
                {t: 'mcp__', w: 66},
                {t: '{服务名}', w: 88},
                {t: '__', w: 34},
                {t: '{工具名}', w: 88},
              ].map((sg, i) => (
                <div
                  key={`ps${i}`}
                  style={{
                    width: sg.w,
                    height: 34,
                    borderRadius: 7,
                    border: `2px solid ${withAlpha(theme.dim, 0.5)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 13,
                    color: theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: clamp01(progress(frame, atSegs + i * 3, 8)),
                  }}
                >
                  {sg.t}
                </div>
              ))}
            </div>
            <div style={{display: 'flex', gap: 6}}>
              {[
                {t: 'mcp__', w: 66},
                {t: 'plugin_', w: 80, hot: true},
                {t: '{插件名}', w: 88, hot: true},
                {t: '_', w: 22, hot: true},
                {t: '{服务名}', w: 88},
                {t: '__', w: 34},
                {t: '{工具名}', w: 88},
              ].map((sg, i) => (
                <div
                  key={`pgs${i}`}
                  style={{
                    width: sg.w,
                    height: 34,
                    borderRadius: 7,
                    border: `2px solid ${sg.hot ? theme.svc : withAlpha(theme.dim, 0.5)}`,
                    background: sg.hot ? withAlpha(theme.svc, 0.18) : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 13,
                    fontWeight: sg.hot ? 700 : 400,
                    color: sg.hot ? theme.text : theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: clamp01(progress(frame, atSegs + 12 + i * 2, 8)),
                  }}
                >
                  {sg.t}
                </div>
              ))}
            </div>
          </div>
          <div style={{position: 'absolute', left: 24, bottom: 14, fontFamily: theme.sans, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: segs * 0.9}}>
            插件全名 · 多一段插件名
          </div>
        </>,
      )}
      {/* 原则短签（幕点原则句——≤6 字，落定定格） */}
      {sign > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: DC.sign.x,
            top: DC.sign.y - float * 26,
            padding: '12px 34px',
            borderRadius: 12,
            border: `3.5px solid ${theme.warn}`,
            background: withAlpha(theme.warn, 0.12),
            fontFamily: theme.serif,
            fontSize: 30,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: sign,
            transform: `translateY(${(1 - sign) * 18}px)`,
            letterSpacing: 3,
          }}
        >
          自我描述 ≠ 授权
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'权限按全名写 · 项目批准了才加载 · 插件多一段插件名'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4ChannelsAndGate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-08');
  const bC = w('p4-09', 'p4-11');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atPull={wa('p4-01', 0.1) - bA.from}
          atLanes={wa('p4-02', 0.62) - bA.from}
          atTransSign={wa('p4-02', 0.74) - bA.from}
          atLocal={wa('p4-03', 0.1) - bA.from}
          atRemote={wa('p4-03', 0.26) - bA.from}
          atIde={wa('p4-03', 0.46) - bA.from}
          atSdk={wa('p4-03', 0.72) - bA.from}
          atMap={wa('p4-03', 0.86) - bA.from}
          atBatch={wa('p4-04', 0.22) - bA.from}
          atAuth={wa('p4-04', 0.52) - bA.from}
          atReconn={wa('p4-04', 0.8) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atIntro={wa('p4-05', 0.35) - bB.from}
          atScan={wa('p4-05', 0.76) - bB.from}
          atStrike={wa('p4-05', 0.88) - bB.from}
          atList={wa('p4-06', 0.2) - bB.from}
          atHost={wa('p4-06', 0.48) - bB.from}
          atEntries={wa('p4-07', 0.16) - bB.from}
          atHot={wa('p4-07', 0.62) - bB.from}
          atAskTag={wa('p4-07', 0.8) - bB.from}
          atOutside={wa('p4-08', 0.15) - bB.from}
          atUser={wa('p4-08', 0.55) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atRule={wa('p4-09', 0.36) - bC.from}
          atApprove={wa('p4-09', 0.62) - bC.from}
          atLoad={wa('p4-09', 0.72) - bC.from}
          atPlugin={wa('p4-10', 0.06) - bC.from}
          atEmbed={wa('p4-10', 0.12) - bC.from}
          atSegs={wa('p4-10', 0.78) - bC.from}
          atFloat={wa('p4-11', 0.66) - bC.from}
          atSign={wa('p4-11', 0.8) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4ChannelsAndGate;
