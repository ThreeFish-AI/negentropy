/** P3 权威轴（p3-01..p3-26 含 06b/c/d、21b/c，31 句；storyboard v5「P3 权威轴」节）。
 *
 *  8 镜 / 8 条 archify cue（tm2-open ×2 + tm2-threats ×6，跨镜背靠背 → 后实例 lead={false}；
 *  3-D/3-E 同一 Sequence 承载、句窗按分镜分别登记）：
 *   3-A 开轴绕开测试（p3-01..04）：FiveAxisMap 高亮 authority（幕首）→ 判据卡
 *       「接线执行路径 · 绕行被挡回」vs「未接线 · 旁路畅通」（DualGate 迁移改写）
 *   3-B 执法点四层（p3-05..07 含 06b/c/d）：层名+强制力来源随 p3-06 落下，
 *       层内白话/本请求走查随 06b（422）/06c（注册表）/06d（引擎）/07（灰态+
 *       「本仓无对应物」）各句点亮；「绕过余地」递窄箭头随 p3-07 逐段收窄
 *   3-C 双层拦截（p3-08..12）：检索过滤（隐形化）+ 执行拒绝（弹回）+ D5 消融对照
 *   3-D/E 权限交集（p3-13..15 / p3-16..18）：VennShrink 双圆求交 → 收缩（撤权）
 *       → 快照凭证失效 + D9 实心徽 + Classmethod 实线徽行
 *   3-F 供给面（p3-19..20）：tm2-open 锚 p3-19 → hold p3-20
 *   3-G 六类威胁（p3-21..24 含 21b/c）：tm2-threats 锚 p3-21 → hold 21b/21c/22/23/24
 *       （lead={false}）；侧栏前景：数字墙三步（p3-21/21b/21c 逐句点亮
 *       98,380 → 157 → 632）+「样本＝两大 registry」角标 + 四客户端零验签
 *       （「2026-09 实测口径」角标）+ 三条最低要求
 *   3-H 轴收束（p3-25..26）：判词条（+「指针不副本」小字）+ FiveAxisMap 推进
 *       （passedCount=2）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useCount, useEnter, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {FiveAxisMap} from '../components/FiveAxisMap';
import {VennShrink} from '../components/VennShrink';

export const P3Authority: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-07');
  const bC = w('p3-08', 'p3-12');
  const bD = w('p3-13', 'p3-15');
  const bE = w('p3-16', 'p3-18');
  const bF = w('p3-19', 'p3-20');
  const bG = w('p3-21', 'p3-24');
  const bH = w('p3-25', 'p3-26');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P3" tagline="权威轴" accent={theme.conceptDeep} />

      {/* 3-A 开轴绕开测试：Map-First 幕首 → 判据卡 + 接线/未接线对照 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="3-A">
        <Sequence from={0} durationInFrames={dur('p3-01')} name="3-A-map">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <FiveAxisMap built highlight="authority" at={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p3-02') - bA.from} name="3-A-dev">
          <BypassTest at02={0} at03={at('p3-03') - at('p3-02')} at04={at('p3-04') - at('p3-02')} />
        </Sequence>
      </Sequence>

      {/* 3-B 执法点四层：层名+强制力来源落下 → 白话随句点亮 → 递窄箭头 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="3-B">
        <EnforcementLayers
          at05={at('p3-05') - bB.from}
          at06={at('p3-06') - bB.from}
          at06b={at('p3-06b') - bB.from}
          at06c={at('p3-06c') - bB.from}
          at06d={at('p3-06d') - bB.from}
          at07={at('p3-07') - bB.from}
        />
      </Sequence>

      {/* 3-C 双层拦截：体验层隐形化 + 强制层弹回 + D5 消融 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="3-C">
        <DualIntercept
          at08={at('p3-08') - bC.from}
          hideAt={at('p3-09') - bC.from}
          bounceAt={at('p3-10') - bC.from}
          labelAt={at('p3-11') - bC.from}
          d5At={at('p3-12') - bC.from}
        />
      </Sequence>

      {/* 3-D/E 权限交集：VennShrink 双圆求交 → 撤权收缩 → 快照凭证失效。
          分镜拆为 3-D（p3-13..15）与 3-E（p3-16..18）两镜，装置连续故同一
          Sequence 承载——句窗按分镜分别登记（w 调用即覆盖门对账输入）。 */}
      <Sequence from={bD.from} durationInFrames={bE.from + bE.durationInFrames - bD.from} name="3-D">
        <VennShrink at={at('p3-13') - bD.from} shrinkAt={at('p3-17') - bD.from} crackAt={at('p3-18') - bD.from} />
        <div style={{position: 'absolute', bottom: 190, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
          <div style={{display: 'flex', gap: 22, alignItems: 'center'}}>
            <EvidenceBadge level="solid" at={at('p3-18') - bD.from} note="D9 · 快照式撤权失效" />
            <EvidenceBadge level="solid" at={at('p3-18') - bD.from + 10} note="Classmethod · RSS 内 INSERT/DDL 全拒" />
          </div>
        </div>
      </Sequence>

      {/* 3-F 供给面：tm2-open 锚 + hold */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="3-F">
        <ArchifyRecap slug="blueprint--mcp-threat-model" caption="供给面 · 接入边界" cues={[
          {chapterId: 'tm2-open', at: at('p3-19') - bF.from, durationInFrames: dur('p3-19')},
          {chapterId: 'tm2-open', at: at('p3-20') - bF.from, durationInFrames: dur('p3-20'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 3-G 六类威胁：tm2-threats hold 链（承 3-F 链尾跨镜背靠背 → lead={false}）；
          前景走画框外左右侧栏（回放框居中，两侧余量各 ~300px） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="3-G">
        <ArchifyRecap slug="blueprint--mcp-threat-model" caption="供给面 · 六类威胁" cues={[
          {chapterId: 'tm2-threats', at: at('p3-21') - bG.from, durationInFrames: dur('p3-21')},
          {chapterId: 'tm2-threats', at: at('p3-21b') - bG.from, durationInFrames: dur('p3-21b'), fit: 'hold'},
          {chapterId: 'tm2-threats', at: at('p3-21c') - bG.from, durationInFrames: dur('p3-21c'), fit: 'hold'},
          {chapterId: 'tm2-threats', at: at('p3-22') - bG.from, durationInFrames: dur('p3-22'), fit: 'hold'},
          {chapterId: 'tm2-threats', at: at('p3-23') - bG.from, durationInFrames: dur('p3-23'), fit: 'hold'},
          {chapterId: 'tm2-threats', at: at('p3-24') - bG.from, durationInFrames: dur('p3-24'), fit: 'hold'},
        ]} lead={false} />
        <ThreatSidebar
          n1At={at('p3-21') - bG.from}
          n2At={at('p3-21b') - bG.from}
          n3At={at('p3-21c') - bG.from}
          clientsAt={at('p3-22') - bG.from}
          rulesAt={at('p3-24') - bG.from}
        />
      </Sequence>

      {/* 3-H 轴收束：FiveAxisMap 推进（权威轴走完 · 已过 2/5）+ 判词条（不遮导航图） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="3-H">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
          <FiveAxisMap built highlight={null} passedCount={2} at={4} />
        </AbsoluteFill>
        <JudgeStrip at={at('p3-25') - bH.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 3-A：绕开测试判据卡 + 「接线执行路径」vs「未接线」对照（DualGate v4 改写）。 */
const BypassTest: React.FC<{at02: number; at03: number; at04: number}> = ({at02, at03, at04}) => {
  const enter = useStagger(2, {stride: 14, at: at02});
  const question = useReveal('绕开这个点，会发生什么？', {at: at03, cps: 7});
  // 探针：0→1 走向门；接线侧被挡回（piecewise），未接线侧旁路畅通
  const probe = useProgress(at04, 44);
  const bounceT = probe < 0.55 ? probe / 0.55 : 1 - (probe - 0.55) / 0.45;
  const passT = probe;
  const ruleNote = useProgress(at04 + 30, 14);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
      {/* 判据卡 + 问话打字机 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
        <div style={{padding: '12px 26px', border: `2px solid ${theme.concept}`, borderRadius: 10, background: theme.panel}}>
          <div style={{fontSize: 21, color: theme.concept}}>绕开测试</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 4, fontFamily: theme.mono}}>一条治理规则</div>
        </div>
        <span style={{fontSize: 30, color: theme.text, fontFamily: theme.mono, minWidth: 460}}>
          {question}
          <span style={{opacity: question.length >= 12 ? 1 : 0}}>▍</span>
        </span>
      </div>
      <div style={{display: 'flex', gap: 60}}>
        {/* 接入执行路径：横杆在必经通道，绕行线被挡回（绿） */}
        <div style={{opacity: enter[0], position: 'relative'}}>
          <svg width={430} height={230}>
            <line x1={20} y1={180} x2={410} y2={180} stroke={theme.panelBorder} strokeWidth={3} />
            <rect x={196} y={104} width={44} height={76} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={1.5} />
            <line x1={162} y1={114} x2={274} y2={114} stroke={theme.ok} strokeWidth={6} strokeLinecap="round" />
            <polyline
              points={`24,162 ${24 + bounceT * 132},162`}
              fill="none"
              stroke={theme.concept}
              strokeWidth={2.5}
              strokeDasharray="7 7"
            />
            <circle cx={24 + bounceT * 132} cy={162} r={6} fill={theme.concept} />
            <text x={215} y={214} textAnchor="middle" fill={theme.ok} fontSize={20}>接线执行路径 · 绕行被挡回</text>
          </svg>
        </div>
        {/* 未接线：旁路畅通（橙警示） */}
        <div style={{opacity: enter[1], position: 'relative'}}>
          <svg width={430} height={230}>
            <line x1={20} y1={180} x2={410} y2={180} stroke={theme.panelBorder} strokeWidth={3} />
            <rect x={196} y={96} width={44} height={84} fill="none" stroke={theme.conceptDeep} strokeWidth={1.5} strokeDasharray="6 5" />
            <path
              d={`M 24 162 C ${64 + passT * 90} 162, ${160 + passT * 120} 84, ${222 + passT * 172} 162`}
              fill="none"
              stroke={theme.conceptDeep}
              strokeWidth={2.5}
            />
            <circle cx={222 + passT * 172} cy={162} r={6} fill={theme.conceptDeep} />
            <text x={215} y={214} textAnchor="middle" fill={theme.conceptDeep} fontSize={20}>未接线 · 旁路畅通</text>
          </svg>
        </div>
      </div>
      <div style={{fontSize: 20, color: theme.dim, opacity: ruleNote}}>
        强制力 = 求值点
      </div>
    </AbsoluteFill>
  );
};

/** 3-B：执法点四层分层表——层名+强制力来源随 p3-06 逐层落下，层内白话与该层的
 *  本请求走查随 p3-06b（注册期 422）/06c（装配期注册表）/06d（执行期引擎求值）/
 *  p3-07（编译期灰态+「本仓无对应物」）各句点亮；「绕过余地」递窄箭头随 p3-07
 *  前半句逐段收窄。 */
const EnforcementLayers: React.FC<{
  at05: number;
  at06: number;
  at06b: number;
  at06c: number;
  at06d: number;
  at07: number;
}> = ({at05, at06, at06b, at06c, at06d, at07}) => {
  const intro = useProgress(at05, 12);
  const names = useStagger(4, {stride: 10, at: at06});
  const d1 = useProgress(at06b, 12);
  const d2 = useProgress(at06c, 12);
  const d3 = useProgress(at06d, 12);
  const d4 = useProgress(at07, 12);
  const wedge = useStagger(3, {stride: 9, at: at07 + 8});
  const details = [d1, d2, d3, d4];
  const layers: Array<{name: string; src: string; detail: string; dim?: boolean}> = [
    {name: '注册期 · 接口校验', src: '422 拒绝入册', detail: '定义入库前过校验 · 不合法 → 422'},
    {name: '装配期 · 注册表', src: '进窗前核权限', detail: '工具只取自注册表 · 未注册不进窗'},
    {name: '执行期 · 引擎求值', src: '查询时强制', detail: '跑起来的那一刻 · 当场判定'},
    {name: '编译期', src: '本仓无对应物', detail: '意图编译成计划 · 越权即失败', dim: true},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 16, opacity: intro}}>
        <div style={{fontSize: 18, color: theme.dim, fontFamily: theme.mono, marginBottom: 4}}>强制力 ＝ 求值时点</div>
        {layers.map((l, i) => (
          <div
            key={l.name}
            style={{
              width: 620,
              padding: '12px 22px',
              border: `2px solid ${l.dim ? theme.panelBorder : theme.concept}`,
              borderStyle: l.dim ? 'dashed' : 'solid',
              borderRadius: 10,
              background: theme.panel,
              opacity: names[i] * (l.dim ? 0.7 : 1),
              transform: `translateY(${(1 - names[i]) * -18}px)`,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontSize: 24, color: l.dim ? theme.dim : theme.concept}}>{l.name}</span>
              <span style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono}}>{l.src}</span>
            </div>
            <div style={{fontSize: 17, color: l.dim ? theme.dim : theme.text, marginTop: 6, opacity: 0.35 + details[i] * 0.65}}>
              {l.detail}
            </div>
          </div>
        ))}
      </div>
      {/* 递窄箭头：越往后绕过余地越小（三段随 p3-07 逐段收窄） */}
      <svg width={260} height={330} style={{opacity: intro}}>
        <polygon points="30,20 230,20 190,90 70,90" fill={withAlpha(theme.concept, 0.35)} stroke={theme.concept} strokeWidth={2} opacity={wedge[0]} />
        <polygon points="82,110 178,110 156,180 104,180" fill={withAlpha(theme.concept, 0.45)} stroke={theme.concept} strokeWidth={2} opacity={wedge[1] * 0.9} />
        <polygon points="112,200 148,200 136,270 124,270" fill={withAlpha(theme.ok, 0.5)} stroke={theme.ok} strokeWidth={2} opacity={wedge[2]} />
        <text x={130} y={310} textAnchor="middle" fill={theme.dim} fontSize={18} opacity={wedge[2]}>绕过余地 递减</text>
      </svg>
    </AbsoluteFill>
  );
};

/** 3-C：双层拦截（体验层隐形化 / 强制层弹回）+ D5 消融对照。 */
const DualIntercept: React.FC<{at08: number; hideAt: number; bounceAt: number; labelAt: number; d5At: number}> = ({
  at08,
  hideAt,
  bounceAt,
  labelAt,
  d5At,
}) => {
  const f = useCurrentFrame();
  const enter = useProgress(at08, 14);
  const hide = useProgress(hideAt, 14);
  // 查询 chip 撞引擎横杆弹回：0→1 前冲，之后按衰减回弹
  const hit = useSpring('snap', {at: bounceAt, dur: 26});
  const hitT = f < bounceAt ? 0 : Math.min(1, (f - bounceAt) / 26);
  const backX = hitT < 0.45 ? hitT / 0.45 : 1 - (hitT - 0.45) / 0.55;
  const labels = useProgress(labelAt, 14);
  const d5 = useProgress(d5At, 16);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34}}>
      {/* 上层：检索过滤 · 体验 */}
      <div style={{opacity: enter, width: 900, padding: '16px 26px', border: `2px solid ${theme.concept}`, borderRadius: 12, background: theme.panel}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontSize: 22, color: theme.concept}}>检索过滤 · 体验层</span>
          <span style={{fontSize: 17, color: theme.dim, opacity: labels}}>前一层管体验</span>
        </div>
        <div style={{display: 'flex', gap: 16, marginTop: 14}}>
          <span style={{padding: '8px 18px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, fontSize: 19, fontFamily: theme.mono, color: theme.text}}>指标定义</span>
          <span style={{padding: '8px 18px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, fontSize: 19, fontFamily: theme.mono, color: theme.text}}>订单表</span>
          <span
            style={{
              padding: '8px 18px',
              border: `1.5px dashed ${theme.conceptDeep}`,
              borderRadius: 8,
              fontSize: 19,
              fontFamily: theme.mono,
              color: theme.conceptDeep,
              opacity: 1 - hide * 0.85,
              outline: hide > 0.5 ? `1.5px dashed ${withAlpha(theme.conceptDeep, 0.4)}` : 'none',
            }}
          >
            customers · phone
          </span>
          <span style={{fontSize: 17, color: theme.conceptDeep, alignSelf: 'center', opacity: hide}}>
            候选中不可见
          </span>
        </div>
      </div>
      {/* 下层：执行拒绝 · 强制 */}
      <div style={{opacity: enter, width: 900, padding: '16px 26px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 12, background: theme.panel}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontSize: 22, color: theme.conceptDeep}}>执行拒绝 · 强制层</span>
          <span style={{fontSize: 17, color: theme.dim, opacity: labels}}>后一层才是强制</span>
        </div>
        <div style={{position: 'relative', height: 74, marginTop: 12}}>
          <div
            style={{
              position: 'absolute',
              left: 20 + backX * 250,
              top: 12,
              padding: '10px 20px',
              border: `1.5px solid ${theme.text}`,
              borderRadius: 8,
              fontSize: 19,
              fontFamily: theme.mono,
              color: theme.text,
              background: theme.terminalBg,
              whiteSpace: 'nowrap',
            }}
          >
            SELECT phone FROM customers
          </div>
          <div style={{position: 'absolute', right: 24, top: 6, width: 8, height: 58, borderRadius: 4, background: theme.conceptDeep, transform: `scaleY(${1 + hit * 0.25})`}} />
          <span style={{position: 'absolute', right: 46, top: 20, fontSize: 18, color: theme.conceptDeep, opacity: hitT > 0.4 ? 1 : 0}}>引擎拒绝</span>
        </div>
      </div>
      {/* D5 消融：去掉执行层 → 取到（红）/ 装回 → blocked（绿） */}
      <div style={{display: 'flex', alignItems: 'center', gap: 22, opacity: d5}}>
        <span style={{padding: '10px 22px', border: `2px solid ${theme.danger}`, borderRadius: 8, fontSize: 21, color: theme.danger}}>
          去掉执行层 → intern 取到数据
        </span>
        <span style={{fontSize: 22, color: theme.dim}}>|</span>
        <span style={{padding: '10px 22px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 21, color: theme.ok}}>
          装回 → blocked
        </span>
        <EvidenceBadge level="filled" at={d5At + 12} note="D5 · 本仓原型复算" />
      </div>
    </AbsoluteFill>
  );
};

/** 3-G 侧栏前景：数字墙三步（p3-21/21b/21c 逐句点亮 98,380 → 157 → 632）+
 *  「样本＝两大 registry」角标 + 四客户端零验签（「2026-09 实测口径」角标）+
 *  三条最低要求（画框外左右余量）。计数走 useCount（非弹簧，不过冲）。 */
const ThreatSidebar: React.FC<{
  n1At: number;
  n2At: number;
  n3At: number;
  clientsAt: number;
  rulesAt: number;
}> = ({n1At, n2At, n3At, clientsAt, rulesAt}) => {
  const c1 = useCount({to: 98380, at: n1At, dur: 26});
  const c2 = useCount({to: 157, at: n2At, dur: 18});
  const c3 = useCount({to: 632, at: n3At, dur: 18});
  const o1 = useProgress(n1At, 8);
  const o2 = useProgress(n2At, 8);
  const o3 = useProgress(n3At, 8);
  const sample = useEnter('rise', {at: n3At + 20, dur: 16});
  const clients = useStagger(4, {stride: 8, at: clientsAt});
  const cross = useImpulse({at: clientsAt + 34, dur: 22, peak: 1});
  const year = useEnter('rise', {at: clientsAt + 34, dur: 16});
  const rules = useStagger(3, {stride: 12, at: rulesAt});
  const wall: Array<[number, string, string, string]> = [
    [Math.round(c1), '份技能扫描', theme.concept, String(o1)],
    [Math.round(c2), '份恶意', theme.danger, String(o2)],
    [Math.round(c3), '个漏洞', theme.conceptDeep, String(o3)],
  ];
  return (
    <>
      {/* 左栏：数字墙三步 + 实线徽 + 样本口径角标 */}
      <div style={{position: 'absolute', left: 44, top: 180, width: 252, display: 'flex', flexDirection: 'column', gap: 18}}>
        {wall.map(([n, t, color, o], i) => (
          <div key={t} style={{opacity: Number(o)}}>
            <div style={{fontSize: 42, color, fontVariantNumeric: 'tabular-nums', fontFamily: theme.mono}}>
              {n.toLocaleString('en-US')}
            </div>
            <div style={{fontSize: 17, color: theme.dim, marginTop: 2}}>{t}</div>
          </div>
        ))}
        <EvidenceBadge level="solid" at={n3At + 30} note="中立锚 · 生态扫描" />
        <div
          style={{
            ...sample,
            padding: '8px 12px',
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 8,
            fontSize: 15,
            color: theme.dim,
            lineHeight: 1.5,
          }}
        >
          样本＝两大 registry 收录技能 · 非全生态统计
        </div>
      </div>
      {/* 右栏：四客户端零验签（2026-09 实测口径角标）+ 三条最低要求 */}
      <div style={{position: 'absolute', right: 44, top: 180, width: 252, display: 'flex', flexDirection: 'column', gap: 16}}>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 10}}>
          {['Claude', 'Gemini', 'Codex', 'VS Code'].map((c, i) => (
            <span key={c} style={{position: 'relative', opacity: clients[i]}}>
              <span style={{display: 'inline-block', padding: '6px 12px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, fontSize: 16, fontFamily: theme.mono, color: theme.dim, textDecoration: 'line-through'}}>{c}</span>
              <span style={{position: 'absolute', top: -8, right: -8, fontSize: 17, color: theme.danger, fontWeight: 700, transform: `scale(${1 + cross * 0.45})`}}>✕</span>
            </span>
          ))}
        </div>
        <div style={{fontSize: 17, color: theme.conceptDeep, opacity: clients[3]}}>四家头部客户端 · 零验签</div>
        <div
          style={{
            ...year,
            alignSelf: 'flex-start',
            padding: '5px 12px',
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 999,
            fontSize: 15,
            fontFamily: theme.mono,
            color: theme.dim,
          }}
        >
          2026-09 实测口径
        </div>
        {['一凭据一来源', '描述按不可信', '破坏动作人确认'].map((t, i) => (
          <div key={t} style={{opacity: rules[i], padding: '10px 14px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 18, color: theme.ok, textAlign: 'center'}}>
            {t}
          </div>
        ))}
      </div>
    </>
  );
};

/** 判词条（3-H 收束形：自带底盒、不全屏遮断——FiveAxisMap 的 ✓ 推进须可读）。 */
const JudgeStrip: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 18});
  return (
    <div style={{position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: enter.opacity, transform: enter.transform}}>
      <div style={{padding: '16px 44px', border: `2.5px solid ${theme.ok}`, borderRadius: 12, fontSize: 34, color: theme.ok, letterSpacing: 2, background: withAlpha(theme.bg, 0.88)}}>
        SSOT × 必经路径
      </div>
      <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono}}>指针不副本 · 与目录条目接头</div>
    </div>
  );
};
