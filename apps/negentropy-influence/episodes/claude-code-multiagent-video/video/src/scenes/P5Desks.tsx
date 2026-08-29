/** P5 谁的桌子：各干各的（分镜 5-A…5-D）
 *  SeparateDesks 母题：同名文件互覆之痛 → 平行目录抽屉长出 → 视野收束 +
 *  ★脏桌抖动拒删 → 外接工具标准插头。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, NamePlate, Panel, SceneHeader, phase} from '../components/motifs';

/** 5-A 阿珍阿强双写冲突：同名 config.py 互覆碎裂 + 回滚死结 */
const Collision: React.FC<{writeAt: number; crushAt: number; knotAt: number}> = ({
  writeAt,
  crushAt,
  knotAt,
}) => {
  const frame = useCurrentFrame();
  // 双写：阿珍写完 → 阿强覆盖
  const zhen = phase(frame, writeAt, 14);
  const qiang = phase(frame, writeAt + 26, 14);
  // 覆盖时刻：文件碎裂（deny 裂纹 + 碎块飞散）
  const crush = frame >= crushAt;
  const frag = crush ? phase(frame, crushAt, 16) : 0;
  // 回滚死结：箭头打成乱麻
  const knot = phase(frame, knotAt, 18);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <div style={{position: 'relative', width: 1520, height: 700}}>
        {/* 同一目录面板（中上） */}
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: 40,
            width: 400,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'同一个目录'}
        </div>
        {/* 阿珍（左）：写 config.py */}
        <div style={{position: 'absolute', left: 120, top: 130, textAlign: 'center'}}>
          <LoopRing size={160} draw={1} dotProgress={(frame / 75) % 1} tone="peer" showLabels={false} />
          <div style={{marginTop: 6}}>
            <NamePlate name="阿珍" />
          </div>
        </div>
        {/* 阿强（右）：也写 config.py */}
        <div style={{position: 'absolute', right: 120, top: 130, textAlign: 'center'}}>
          <LoopRing size={160} draw={1} dotProgress={(frame / 75 + 0.4) % 1} tone="peer" showLabels={false} />
          <div style={{marginTop: 6}}>
            <NamePlate name="阿强" />
          </div>
        </div>
        {/* 中央文件：两人先后写入同一文件 */}
        <div style={{position: 'absolute', left: 610, top: 120}}>
          <Panel accent={crush ? theme.deny : theme.panelBorder} style={{width: 320, padding: '12px 16px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'config.py'}</div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                marginTop: 8,
                color: theme.text,
                opacity: zhen,
              }}
            >
              {'AUTH_TTL = 900   '}
              <span style={{fontSize: 15, color: theme.peer}}>{'← 阿珍'}</span>
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                marginTop: 6,
                color: theme.text,
                opacity: qiang,
                textDecoration: crush ? 'line-through' : 'none',
              }}
            >
              {'AUTH_TTL = 300   '}
              <span style={{fontSize: 15, color: theme.peer}}>{'← 阿强覆盖'}</span>
            </div>
          </Panel>
          {/* 碎裂：裂纹锯齿 + 四散碎块 */}
          {crush ? (
            <svg width={340} height={200} style={{position: 'absolute', left: -10, top: -14, pointerEvents: 'none'}}>
              <path
                d="M90 10 L120 50 L96 84 L130 118 L104 150"
                fill="none"
                stroke={theme.deny}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.9}
              />
              {[
                {x: 40, y: 40, dx: -60, dy: -30},
                {x: 250, y: 60, dx: 70, dy: -20},
                {x: 60, y: 140, dx: -50, dy: 40},
                {x: 240, y: 150, dx: 60, dy: 50},
              ].map((s, i) => (
                <rect
                  key={i}
                  x={s.x + s.dx * frag}
                  y={s.y + s.dy * frag}
                  width={26}
                  height={20}
                  rx={4}
                  fill="none"
                  stroke={theme.deny}
                  strokeWidth={3}
                  opacity={(1 - frag) * 0.9}
                  transform={`rotate(${frag * (i * 30 - 45)} ${s.x + s.dx * frag} ${s.y + s.dy * frag})`}
                />
              ))}
            </svg>
          ) : null}
        </div>
        {/* 白干了 + 回滚死结 */}
        {crush ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 360,
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 38,
              fontWeight: 700,
              color: theme.deny,
              opacity: phase(frame, crushAt + 6, 10),
            }}
          >
            {'阿珍的改动，白干'}
          </div>
        ) : null}
        {/* 回滚箭头打成死结（下方） */}
        {knot > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 610,
              top: 430,
              width: 320,
              opacity: knot,
            }}
          >
            <svg width={320} height={150}>
              {/* 回滚箭头：一条回卷箭头绕成乱麻团 */}
              <path
                d="M20 110 C 90 110, 80 40, 150 44 C 220 48, 200 110, 160 96 C 120 82, 150 30, 230 40"
                fill="none"
                stroke={theme.deny}
                strokeWidth={5}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - knot}
              />
              {knot > 0.9 ? (
                <>
                  <circle cx={160} cy={72} r={10} fill="none" stroke={theme.deny} strokeWidth={4} />
                  <text
                    x={160}
                    y={142}
                    textAnchor="middle"
                    fontFamily={theme.sans}
                    fontSize={22}
                    fill={theme.deny}
                  >
                    {'回滚：分不清哪行是谁的'}
                  </text>
                </>
              ) : null}
            </svg>
          </div>
        ) : null}
      </div>
      <Footnote delay={crushAt + 8}>{'同一目录 · 同名文件 · 互相覆盖'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-B ★各开一桌：同一仓库底座长出平行目录抽屉 + `../` 名字卡弹回 + 登记虚线 */
const ParallelDesks: React.FC<{growAt: number; bounceAt: number; tieAt: number}> = ({
  growAt,
  bounceAt,
  tieAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 抽屉长出：从中央底座向两侧滑出
  const desks = [
    {name: 'task-01', x: -560},
    {name: 'task-02', x: -180},
    {name: 'task-03', x: 200},
    {name: 'task-04', x: 580},
  ];
  const grows = desks.map((_, i) =>
    interpolate(frame - growAt - i * 6, [0, 18], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  // `../` 名字卡被弹回（deny）
  const badNear = interpolate(frame - bounceAt, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const badBack =
    frame >= bounceAt + 12
      ? interpolate(frame - bounceAt - 12, [0, 12], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;
  // 登记虚线：任务卡 ↔ 桌子卡
  const tie = phase(frame, tieAt, 16);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1600, height: 720}}>
        {/* 仓库底座（下方大条） */}
        <div style={{position: 'absolute', left: 100, bottom: 60, width: 1400}}>
          <Panel style={{padding: '18px 24px'}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.mech}}>{'repo/.git'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
                {'同一个仓库底座'}
              </span>
            </div>
          </Panel>
        </div>
        {/* 四张平行目录抽屉（长出成排） */}
        {desks.map((d, i) => {
          const g = grows[i];
          const dir = d.x < 0 ? -1 : 1;
          return (
            <div
              key={d.name}
              style={{
                position: 'absolute',
                left: 800 + d.x - 160 + dir * (1 - g) * 120,
                top: 300 - (1 - g) * 10,
                width: 320,
                opacity: g,
              }}
            >
              {/* 抽屉：正面面板 + 侧沿双线 + 拉手 */}
              <Panel accent={theme.mech} style={{padding: '14px 18px'}}>
                <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.mech}}>
                  {`worktrees/${d.name}`}
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>
                  {`分支 ${d.name} · 各干各的`}
                </div>
              </Panel>
              <svg width={320} height={18} style={{display: 'block'}}>
                <line x1={20} y1={8} x2={300} y2={8} stroke={theme.panelBorder} strokeWidth={3} />
                <circle cx={160} cy={8} r={5} fill={theme.panelBorder} />
              </svg>
            </div>
          );
        })}
        {/* 名字校验：`../` 名字卡被弹回 */}
        {badNear > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 620 + badNear * 180 - badBack * 320,
              top: 90,
              opacity: 1,
              transform: `rotate(${badBack * -12}deg)`,
            }}
          >
            <Panel accent={badBack > 0.2 ? theme.deny : theme.panelBorder} style={{width: 360, padding: '12px 16px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: badBack > 0.2 ? theme.deny : theme.text}}>
                {'../../etc/passwd'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>
                {'只许字母数字点横线——路径越狱被弹回'}
              </div>
            </Panel>
          </div>
        ) : null}
        {/* 登记虚线：任务卡与桌子卡之间（状态格不动） */}
        {tie > 0 ? (
          <svg width={1600} height={720} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
            <line
              x1={640}
              y1={560}
              x2={640}
              y2={480}
              stroke={theme.mech}
              strokeWidth={4}
              strokeDasharray="9 9"
              opacity={tie}
            />
            <line
              x1={960}
              y1={480}
              x2={960}
              y2={560}
              stroke={theme.mech}
              strokeWidth={4}
              strokeDasharray="9 9"
              opacity={tie}
            />
          </svg>
        ) : null}
        {/* 任务卡 + 状态格不动注记（底部） */}
        {tie > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 560,
              top: 580,
              width: 480,
              opacity: tie,
            }}
          >
            <Panel style={{padding: '10px 16px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'T-02'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>{'接口'}</span>
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 16,
                    color: theme.dim,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: 5,
                    padding: '0 8px',
                    marginLeft: 'auto',
                  }}
                >
                  {'pending（登记不改状态）'}
                </span>
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
      <Footnote delay={tieAt}>{'绑定只登记，不改任务状态——桌子先摆上，活等人来领'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-C 队友进桌：视野光圈收束 + 保留/删除双门 + ★脏桌抖动拒删封条 + 日志行追加 */
const DeskHygiene: React.FC<{visionAt: number; doorsAt: number; sealAt: number; logAt: number}> = ({
  visionAt,
  doorsAt,
  sealAt,
  logAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 视野光圈收束：全屏视野 → 只剩桌内
  const vision = phase(frame, visionAt, 22);
  // 双门出现
  const doors = phase(frame, doorsAt, 14);
  // 脏桌抖动 + deny 封条
  const sealed = frame >= sealAt;
  const shake = sealed ? Math.sin((frame - sealAt) / 1.8) * 4 : 0;
  const seal = sealed ? spring({frame: frame - sealAt, fps, config: {damping: 200}}) : 0;
  // 明说「丢弃改动」后封条撕开
  const torn = frame >= sealAt + 46;
  const tear = torn ? interpolate(frame - sealAt - 46, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 0;
  // 日志行逐条追加
  const logs = [
    {t: '建桌 worktrees/task-01', at: logAt},
    {t: '留桌 worktrees/task-02 · 等审查', at: logAt + 12},
    {t: '拆桌被拒：有未提交改动', at: sealAt + 8},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560, height: 720}}>
        {/* 视野遮罩：光圈收束（队友的眼里只剩这张桌） */}
        <svg width={1560} height={720} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          {vision > 0.02 ? (
            <>
              <defs>
                <mask id="vision-mask">
                  <rect width={1560} height={720} fill="white" />
                  <circle cx={480} cy={330} r={340 - vision * 190} fill="black" />
                </mask>
              </defs>
              <rect
                width={1560}
                height={720}
                fill="#0E1116"
                opacity={vision * 0.82}
                mask="url(#vision-mask)"
              />
              <circle
                cx={480}
                cy={330}
                r={340 - vision * 190}
                fill="none"
                stroke={theme.peer}
                strokeWidth={4}
                strokeDasharray="12 10"
                opacity={vision * 0.8}
              />
              <text
                x={480}
                y={330 - (340 - vision * 190) - 18}
                textAnchor="middle"
                fontFamily={theme.sans}
                fontSize={24}
                fill={theme.peer}
                opacity={vision}
              >
                {'它的整个世界 = 这张桌'}
              </text>
            </>
          ) : null}
        </svg>
        {/* 左：那张桌（脏桌抖动 + 封条） */}
        <div
          style={{
            position: 'absolute',
            left: 250,
            top: 150,
            width: 460,
            transform: `translateX(${shake}px)`,
          }}
        >
          <Panel accent={sealed && !torn ? theme.deny : theme.mech} style={{padding: '18px 22px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech}}>
              {'worktrees/task-01'}
            </div>
            {/* 桌上：改动未提交的文件行 */}
            <div style={{marginTop: 12}}>
              {['M api/auth.py', 'M api/routes.py', '? notes.md'].map((f) => (
                <div
                  key={f}
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 20,
                    color: f.startsWith('?') ? theme.deny : theme.text,
                    marginTop: 6,
                  }}
                >
                  {f}
                  <span style={{fontSize: 15, color: theme.deny, marginLeft: 10}}>{'未提交'}</span>
                </div>
              ))}
            </div>
          </Panel>
          {/* deny 封条：斜贴在桌面上（明说后撕开） */}
          {sealed && tear < 1 ? (
            <svg width={460} height={140} style={{position: 'absolute', left: 0, top: 60, pointerEvents: 'none'}}>
              <g transform={`rotate(-8 230 70)`} opacity={1 - tear}>
                <rect
                  x={30 - tear * 60}
                  y={40}
                  width={400}
                  height={56}
                  rx={8}
                  fill={theme.denyDeep}
                  stroke={theme.deny}
                  strokeWidth={4}
                />
                <text
                  x={230 - tear * 60}
                  y={76}
                  textAnchor="middle"
                  fontFamily={theme.serif}
                  fontSize={30}
                  fontWeight={700}
                  fill={theme.deny}
                >
                  {'桌还乱着 · 不许删'}
                </text>
                {/* 撕开的裂口 */}
                {tear > 0 ? (
                  <path
                    d={`M${100 + tear * 120} 40 L${140 + tear * 130} 96`}
                    stroke={theme.bg}
                    strokeWidth={8}
                    opacity={tear}
                  />
                ) : null}
              </g>
            </svg>
          ) : null}
        </div>
        {/* 右：保留 / 删除双门 */}
        <div
          style={{
            position: 'absolute',
            right: 180,
            top: 150,
            display: 'flex',
            gap: 34,
            opacity: doors,
          }}
        >
          {/* 保留门 */}
          <div style={{width: 240}}>
            <Panel accent={theme.mech} style={{padding: '18px 20px', textAlign: 'center'}}>
              <svg width={120} height={80} style={{overflow: 'visible'}}>
                {/* 门形图标：双开门 */}
                <rect x={10} y={8} width={100} height={64} rx={6} fill="none" stroke={theme.mech} strokeWidth={4} />
                <line x1={60} y1={8} x2={60} y2={72} stroke={theme.mech} strokeWidth={4} />
                <circle cx={50} cy={42} r={4} fill={theme.mech} />
                <circle cx={70} cy={42} r={4} fill={theme.mech} />
              </svg>
              <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.mech, marginTop: 8}}>
                {'保留'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>
                {'分支留着 · 等人审查合并'}
              </div>
            </Panel>
          </div>
          {/* 删除门：被 deny 封条挡 */}
          <div style={{width: 240, position: 'relative'}}>
            <Panel
              accent={sealed && !torn ? theme.deny : theme.panelBorder}
              style={{padding: '18px 20px', textAlign: 'center'}}
            >
              <svg width={120} height={80} style={{overflow: 'visible'}}>
                <rect x={10} y={8} width={100} height={64} rx={6} fill="none" stroke={sealed && !torn ? theme.deny : theme.panelBorder} strokeWidth={4} />
                <line x1={60} y1={8} x2={60} y2={72} stroke={sealed && !torn ? theme.deny : theme.panelBorder} strokeWidth={4} />
              </svg>
              <div
                style={{
                  fontFamily: theme.serif,
                  fontSize: 30,
                  fontWeight: 700,
                  color: sealed && !torn ? theme.deny : theme.text,
                  marginTop: 8,
                }}
              >
                {'删除'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>
                {torn ? '明说「丢弃改动」后才开' : '默认被拒'}
              </div>
            </Panel>
            {sealed && !torn ? (
              <svg width={240} height={70} style={{position: 'absolute', left: 0, top: 50, pointerEvents: 'none'}}>
                <g transform="rotate(10 120 35)">
                  <rect x={20} y={14} width={200} height={42} rx={7} fill={theme.denyDeep} stroke={theme.deny} strokeWidth={3.5} />
                  <text
                    x={120}
                    y={42}
                    textAnchor="middle"
                    fontFamily={theme.serif}
                    fontSize={23}
                    fontWeight={700}
                    fill={theme.deny}
                  >
                    {'拒'}
                  </text>
                </g>
              </svg>
            ) : null}
          </div>
        </div>
        {/* 底部：事件日志逐行追加 */}
        <div style={{position: 'absolute', left: 430, bottom: 60, width: 700}}>
          <Panel style={{padding: '12px 18px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'events.jsonl'}</div>
            {logs.map((l) =>
              frame >= l.at ? (
                <div
                  key={l.t}
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 19,
                    color: l.t.includes('拒') ? theme.deny : theme.text,
                    marginTop: 6,
                    opacity: phase(frame, l.at, 8),
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l.t}
                </div>
              ) : null,
            )}
          </Panel>
        </div>
      </div>
      <Footnote delay={sealAt + 4}>
        {'桌上还有没提交的改动，删除默认被拒——宁可多签一次字，不悄悄丢掉工作'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 5-D 【三】产品差异角标 + 标准插头插入工具池 + mcp__jira__create 铭牌 */
const McpPlug: React.FC<{noteAt: number; plugAt: number; plateAt: number}> = ({
  noteAt,
  plugAt,
  plateAt,
}) => {
  const frame = useCurrentFrame();
  // 角标浮现
  const note = phase(frame, noteAt, 12);
  // 插头插入：从右滑向工具池插口，咔哒接入
  const plug = interpolate(frame - plugAt, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const seated = plug >= 1;
  const jolt = seated ? interpolate(frame - plugAt - 24, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) : 0;
  // 铭牌特写
  const plate = phase(frame, plateAt, 14);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1560, height: 640}}>
        {/* 工具池（左）：一排既有插口 + 新插口空位 */}
        <div style={{position: 'absolute', left: 200, top: 200}}>
          <Panel accent={theme.mech} style={{width: 560, padding: '18px 22px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.mech}}>{'工具池'}</div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 16}}>
              {['跑命令', '读文件', '写文件', '找文件'].map((t) => (
                <div
                  key={t}
                  style={{
                    height: 64,
                    borderRadius: 8,
                    border: `2px solid ${theme.panelBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.sans,
                    fontSize: 19,
                    color: theme.dim,
                  }}
                >
                  {t}
                </div>
              ))}
              {/* 新插口：虚线空位，插头落座后亮起 */}
              <div
                style={{
                  height: 64,
                  borderRadius: 8,
                  border: `2px dashed ${seated ? theme.mech : theme.panelBorder}`,
                  background: seated ? theme.mechDeep : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 19,
                  color: seated ? theme.mech : theme.dim,
                }}
              >
                {seated ? '接上了' : '空插口'}
              </div>
            </div>
          </Panel>
        </div>
        {/* 插头：自右向左滑向工具池的空插口（px 推导：pin1 对准第 2 行第 1 格中心 ≈ x 281） */}
        <div
          style={{
            position: 'absolute',
            left: 620 - plug * 421,
            top: 340,
            opacity: plug > 0 ? 1 : 0,
          }}
        >
          <svg width={220} height={130} style={{overflow: 'visible'}}>
            {/* 标准插头：双脚朝左（插向工具池），线缆拖向右画外 */}
            <rect x={60} y={30} width={110} height={70} rx={12} fill={theme.panel} stroke={theme.mech} strokeWidth={5} />
            <line x1={82} y1={12} x2={82} y2={30} stroke={theme.mech} strokeWidth={8} strokeLinecap="round" />
            <line x1={148} y1={12} x2={148} y2={30} stroke={theme.mech} strokeWidth={8} strokeLinecap="round" />
            <path
              d={`M170 65 C 210 65, 230 90, 270 90`}
              fill="none"
              stroke={theme.mech}
              strokeWidth={6}
            />
            <text x={115} y={72} textAnchor="middle" fontFamily={theme.sans} fontSize={17} fill={theme.dim}>
              {'别人造的'}
            </text>
          </svg>
          {jolt > 0 ? (
            <svg width={220} height={130} style={{position: 'absolute', left: -36, top: -20, pointerEvents: 'none'}}>
              {[0, 1].map((k) => (
                <circle
                  key={k}
                  cx={82 - 36}
                  cy={21}
                  r={20 + jolt * (50 + k * 26)}
                  fill="none"
                  stroke={theme.mech}
                  strokeWidth={4 - k * 1.5}
                  opacity={(1 - jolt) * (1 - k * 0.4)}
                />
              ))}
            </svg>
          ) : null}
        </div>
        {/* 铭牌特写：来源前缀防重名 */}
        {plate > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 200,
              top: 480,
              width: 560,
              opacity: plate,
              transform: `translateY(${(1 - plate) * 18}px)`,
            }}
          >
            <Panel accent={theme.mech} style={{padding: '14px 20px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
                {'工具名自动带来源前缀——防两家服务起同一个名字'}
              </div>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 30,
                  color: theme.mech,
                  marginTop: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                {'mcp__'}
                <span style={{color: theme.text}}>{'jira'}</span>
                {'__'}
                <span style={{color: theme.peer}}>{'create'}</span>
              </div>
            </Panel>
          </div>
        ) : null}
        {/* 产品差异角标（上浮浮现） */}
        {note > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: 60,
              top: 120,
              width: 460,
              opacity: note,
            }}
          >
            <Panel style={{padding: '14px 18px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, lineHeight: 1.55}}>
                {'实际实现里进出目录是整个进程跟着切；任务与目录也不强制绑定'}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 8}}>
                {'——第三方的源码分析（最简示例做成默认绑定）'}
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
      <Footnote delay={plugAt + 24}>{'外接工具，标准协议——谁写的都行'}</Footnote>
    </AbsoluteFill>
  );
};

/** 5-B' 官方四道闸（Harness Engineering 改造版）：主检出与工作目录之间一堵墙、四道闸
 *  ①指向主检出的编辑拦 ②工作目录解析不对/确认不了拦 ③git 重定向四种写法拦
 *  ④命令形状无法静态验证拦——第四道焊死，不能关（官方 worktrees）。 */
const FourGates: React.FC<{gatesAt: number}> = ({gatesAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gates = [
    {t: '编辑闸', s: '指向主检出的编辑，拦'},
    {t: '目录闸', s: '解析不对 / 确认不了，拦'},
    {t: '重定向闸', s: 'git 四种写法，拦'},
    {t: '形状闸', s: '无法静态验证，拦', locked: true},
  ];
  return (
    <AbsoluteFill>
      {/* 四道闸横排：上移到中带下沿（避免压住 repo 底座与 Footnote 双行区，2026-08 实拍修） */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 268, display: 'flex', justifyContent: 'center', gap: 14}}>
        {gates.map((g, i) => {
          const e = spring({frame: frame - gatesAt - i * 9, fps, config: {damping: 150}});
          if (e <= 0) return null;
          return (
            <div
              key={g.t}
              style={{
                width: 262,
                border: `2.5px solid ${g.locked ? theme.deny : theme.peer}`,
                borderRadius: 10,
                background: theme.panel,
                padding: '12px 16px',
                textAlign: 'center',
                opacity: Math.min(1, e * 1.2),
                transform: `translateY(${(1 - e) * -26}px) rotate(${(i % 2 === 0 ? -1 : 1) * (1 - e) * 4}deg)`,
                boxShadow: g.locked ? `0 0 18px ${theme.deny}44` : 'none',
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 24, color: g.locked ? theme.deny : theme.text}}>
                {g.t}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 4}}>{g.s}</div>
              {g.locked ? (
                <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.deny, marginTop: 6}}>
                  {'● 这道不能关'}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <Footnote delay={gatesAt + 40} slot={1}>
        {'隔离四检查 —— 官方文档 worktrees（取数2026年8月）'}
      </Footnote>
    </AbsoluteFill>
  );
};

export const P5Desks: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-05');
  const bB = w('p5-06', 'p5-09');
  const bC = w('p5-10', 'p5-17');
  const bD = w('p5-18', 'p5-22');
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P5" title="谁的桌子：各干各的" meta="worktree · 4 gates, one cannot close" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="5-A 双写冲突">
        <Collision
          writeAt={rel(bA, 'p5-03')}
          crushAt={rel(bA, 'p5-03') + 30}
          knotAt={rel(bA, 'p5-04')}
        />
      </Sequence>
      <Sequence {...bB} name="5-B 各开一桌与四道闸">
        <ParallelDesks
          growAt={rel(bB, 'p5-06')}
          bounceAt={rel(bB, 'p5-07')}
          tieAt={rel(bB, 'p5-08')}
        />
        <FourGates gatesAt={rel(bB, 'p5-07')} />
      </Sequence>
      <Sequence {...bC} name="5-C 视野收束与脏桌不删">
        <DeskHygiene
          visionAt={rel(bC, 'p5-10')}
          doorsAt={rel(bC, 'p5-11')}
          sealAt={rel(bC, 'p5-12')}
          logAt={rel(bC, 'p5-15')}
        />
      </Sequence>
      <Sequence {...bD} name="5-D 标准插头与角标">
        <McpPlug
          noteAt={rel(bD, 'p5-17')}
          plugAt={rel(bD, 'p5-21')}
          plateAt={rel(bD, 'p5-22')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
