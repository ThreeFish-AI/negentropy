/** 运动令牌——时长标尺 / 缓动曲线 / 弹簧手感 的单一事实源。
 *
 * 只放纯数据与纯函数：不 import remotion、不读 theme（颜色一律经参数注入）——
 * 这是本层能以 frozen 档跨两个系列共享的前提（两系列 theme token 名已分叉：
 * CC 用 core/mech/deny、SE 用 danger），判据同 test_chrome_motifs_only_read_base_theme_tokens。
 *
 * 取值依据（勿凭感觉改；改前先在本集校准轮逐幕目视复测，依据写回此处注释）：
 * - 时长六档取 IBM Carbon DTCG（70/110/150/240/400/700ms）@30fps 四舍五入。
 *   弃 Material 十六档：30fps 量化下其 15 个相邻对里 6 对落进同一帧数（伪选择）。
 * - 缓动控制点取 Material 3 标准三件；曲线本体在 hooks.ts 经 Remotion Easing.bezier 求值。
 * - 弹簧预设锚定本仓实测手感：settle=200 即既有 9/10 调用点的惯用值（延续成片观感），
 *   snap=12 来自 P4「插头咬合」的过冲；ζ 与过冲峰值的关系由 motion.test.ts 用
 *   Mp = exp(-πζ/√(1-ζ²)) 钉死。
 * - effects 不变量：不透明度/颜色永不过冲——effects 类动画一律时长+缓动，
 *   弹簧只用于空间位移（M3 spatial/effects 二分的落地）。
 */

/** 时长标尺（帧 @30fps）。叙事节拍（4–8s）不用此表——那是 window/schedule 的职责。 */
export const DUR = {
  /** 70ms：微反馈（辉光起点、光标） */
  f1: 2,
  /** 110ms：快速子项（列表错峰的单项时长） */
  f2: 3,
  /** 150ms：标准入场 */
  f3: 5,
  /** 200ms：强调入场 */
  f4: 7,
  /** 400ms：大位移 / 镜头推近 / 描线 */
  f5: 12,
  /** 700ms：幕级大动作（少用） */
  f6: 21,
} as const;
export type DurToken = keyof typeof DUR;

/** 缓动令牌。 */
export type EasingToken = 'standard' | 'decelerate' | 'accelerate' | 'linear';

/** 贝塞尔控制点（x1,y1,x2,y2）；linear 无控制点。 */
export const EASING_CP: Record<
  Exclude<EasingToken, 'linear'>,
  readonly [number, number, number, number]
> = {
  // M3 standard：入场默认
  standard: [0.2, 0, 0, 1],
  // M3 decelerate：强减速（大位移入场、镜头推近）
  decelerate: [0.05, 0.7, 0.1, 1],
  // M3 accelerate：出场加速
  accelerate: [0.3, 0, 0.8, 0.15],
};

/** 弹簧预设（直传 Remotion spring config；ζ = c/(2√(k·m))）。 */
export type SpringPreset = 'settle' | 'settleSoft' | 'snap';
export const SPRING: Record<SpringPreset, {damping: number; stiffness: number; mass: number}> = {
  // ζ≈10：无过冲平滑滑入——本仓主流手感（既有场景 9/10 处 damping 200）
  settle: {damping: 200, stiffness: 100, mass: 1},
  // ζ≈8.5：更绵一点（P0/P1 既有 180/170 档的收敛）
  settleSoft: {damping: 170, stiffness: 100, mass: 1},
  // ζ≈0.6：轻微过冲（咬合/弹入——原 P4 damping 12）
  snap: {damping: 12, stiffness: 100, mass: 1},
};

/** 阻尼比 ζ。设计系统文档普遍给 ζ（无量纲），Remotion 取阻尼系数 c——直抄会得
 *  ζ≈0.02 的暴力弹跳且能通过渲染体检，这是迁移期最高风险项（单测钉死）。 */
export const dampingRatio = (s: {
  damping: number;
  stiffness: number;
  mass: number;
}): number => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));

/** 欠阻尼弹簧的峰值位置（1 = 恰好到终点不过冲；ζ ≥ 1 恒 1）。
 *  Mp = exp(-πζ/√(1-ζ²)) 是超出终点的幅度，峰值 = 1 + Mp。 */
export const overshootPeak = (zeta: number): number =>
  zeta >= 1 ? 1 : 1 + Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));

/** 出场快于入场的系数（MDC 实测 400ms 入 / 150ms 出 ≈ 0.375，取 0.4 禁手填）。 */
export const EXIT_FACTOR = 0.4;

/** 字幕安全带上沿：1080 - qa_frames.SUBTITLE_BAND_PX(160)，与体检口径同源。 */
export const SAFE_TOP_Y = 920;

/** 自下方入场的行程安全钳制：落位态底边 restBottom 之上才是可用的进场空间。
 *  ISSUE-170 的手工逐卡反算收敛于此——该缺陷类从「评审抽帧抓」变「构造不可能」。 */
export const clampRiseDist = (
  dist: number,
  restBottom: number,
  safeTop: number = SAFE_TOP_Y,
): number => Math.max(0, Math.min(dist, safeTop - restBottom));
