/** 本集 3D 原语层（seeded 档，与 motifs.tsx 严格平行）。
 *
 *  分层理由与 frozen 边界一致：**frozen 的 motion/ 共享「怎么动」（机制），
 *  本层给「画什么的三维形状」（策略）**。故本层：
 *    - 零 useCurrentFrame、零 motion hook、零 import '../motion'；
 *      所有运动量（settle/close/seat/opacity）由调用方以 prop 注入；
 *    - 只读 theme 颜色 token（与 motifs.tsx 同权限）。
 *
 *  ── 三条本集 3D 宪法（改这里之前先读） ─────────────────────────────
 *  ① **只做直角体，不做任何圆/环/曲面**。画面里的「圆」已被 LoopRing 独占
 *     （恒 core 色、恒 6px 线宽、六次出场同形），它是「循环始终不变」这个
 *     主题**被看见**的唯一载体。一旦出现三维的环/球/柱面，读法就变成
 *     「环有两种」，唯一性即失。副作用是工程护栏：元素词表被钉死在
 *     box/edges/lineLoop/basic 材质 —— 恰好等于 PlateSlab3D 已跑通并过
 *     tsc 的那一组，新增 3D **不引入任何新类型面**。
 *  ② **读感来自转物体，不来自动相机**。正交 + zoom:1 下 1 世界单位 = 1 CSS
 *     像素，这是 domToWorld 能存在、叠层能手算的唯一前提。相机一动，所有
 *     DOM 叠层坐标都要走投影反算（P5Stack 的 BAR_BASE 45 就是这类手算偏移
 *     留下的疤）。故**相机全片零动画**；深度感靠物体静置俯角/偏航。
 *     副产品：没有相机插值就没有浮点累积 ⇒ 无头渲染确定性。
 *  ③ **每个颜色必须是 theme token 字面值或有注释的确定性派生，永不是
 *     「光 × 材质」的运行时乘积**。真光照让最终像素成为运行时乘积——没有
 *     名字、不可 grep、--check-theme 看不见、WCAG 无法预先计算，而
 *     ISSUE-177 教训二（emissive 把点亮层烧成实心橙块、压掉文字对比）正是
 *     这个形态。故本层**零光源、只用 unlit 材质**，明暗靠手写面色梯度。
 *
 *  ── ISSUE-177 教训一写进类型 ────────────────────────────────────────
 *  容器的 position/width 属**调用点契约**，不属被抽取内容。故本层
 *  **没有任何导出会产生带 position 的 DOM 节点**：实体原语一律返回 <group>，
 *  Stage3D 的 style 在类型上就 Omit 掉了定位属性。
 */
import React, {useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {theme} from '../design/theme';

// ── 面色梯度（宪法三：字面量，可 grep、可算 WCAG） ─────────────────────
//
// 深 → 浅：bg < SOCKET_WALL < panel < SHELL_INNER < PLATE_LIT
// 对 theme.text #F2F5FA 的对比度（与 qa_frames --check-theme 同算法）：
//   panel #171C26 15.62:1 · PLATE_LIT #241C1E 15.26:1 · SHELL_INNER #1E242F 14.19:1
//   SOCKET_WALL #141922 16.31:1 —— 全部 ≥ 12:1 的预算线。
// ⚠️ 这些常量**刻意不进 theme.ts**：--check-theme 会遍历 theme 的所有色 token
//    并按「概念色 on bg」判 4.5:1，深色面板色会被当概念色查而直接 FAIL。

/** 井壁内表面：panel 提亮一档，读作「被井口光照到的内壁」——**作者手绘的暗部关系**，
 *  不是光照计算的结果（宪法三）。 */
export const SHELL_INNER = '#1E242F';

/** 壳壁的四层面色梯度（自内向外**逐层变暗**）。
 *
 *  ⚠️ 这组值来自实景抽帧的修复：首版四层全用 theme.panel（对 bg 只差一档），
 *  面在暗底上读不出来，棱线成了唯一可见物，四层叠加于是读成**一堆细线框**而不是
 *  「有内外之分的体」。壳与框的差别本就在「面是否可见」，所以面色必须自己拉开层次。
 *  自内向外变暗 = 越靠外越背光，符合「井」的朴素光感（仍是手绘梯度，非光照计算）。
 *  对 theme.text #F2F5FA 的对比度：#39435A 9.66 · #2E374B 11.45 · #242C3C 13.13 ·
 *  #1B212D 14.62 —— 全部远超「文字 on 面色 ≥ 7:1」的下限（本层无文字叠加，仅作余量）。
 *  ⚠️ 首版取 #232A36→#12161E（灰度 0.10–0.14），在 bg #0E1116 上几乎与背景同色，
 *  面根本读不出来 ⇒ 只剩棱线可见、整组读成线框堆。**面要被看见，必须与 bg 拉开**。 */
export const SHELL_FACES = ['#39435A', '#2E374B', '#242C3C', '#1B212D'] as const;

/** 5-B 柱的侧向厚度板面色：比 theme.panel 深一档的「厚度暗部」（手绘梯度，宪法三）。 */
export const BAR_SIDE = '#10141C';

/** 5-B 侧板偏航角（yaw-only 硬约束：加俯角会污染数据轴，见 Bar3D/P5Stack 注释）。 */
export const BAR_YAW = 26;

/** 插座井壁：比 panel 更暗一档 = 手绘的「凹进去」暗部。 */
export const SOCKET_WALL = '#141922';

/** 房屋轴测：全片静置角度，与既有 PlateSlab3D 同源。 */
export const AXO = {pitch: -12, yaw: 8} as const;

export const axoRotation = (o: {pitch?: number; yaw?: number} = {}): [number, number, number] => [
  ((o.pitch ?? AXO.pitch) * Math.PI) / 180,
  ((o.yaw ?? AXO.yaw) * Math.PI) / 180,
  0,
];

/** DOM 局部坐标（容器左上原点、y 向下）→ 世界坐标。
 *  正交 zoom=1 下为**精确等距映射**，故这是一次减法而非投影反算。
 *  ★ 3D 物件与 DOM 叠层对位的唯一口径——禁止在调用点手调偏移量
 *    （BAR_BASE 45 那类手算常数正是本函数要消灭的缺陷类）。 */
export const domToWorld = (
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
): [number, number, number] => [x - canvasW / 2, canvasH / 2 - y, 0];

/** 读色皮肤——「平面语义 → 3D 属性」的唯一载体。
 *  face 大面积**永不**用概念色（core/mech/deny）；概念色只走 edge。 */
export type SolidSkin = {
  /** 面色：不吃光（材质恒 basic） */
  face: string;
  /** 棱线色：概念色只在此出现 */
  edge: string;
  /** 整体不透明度（对应平面档的 dim） */
  opacity?: number;
  /** 棱线不透明度（缺省随 opacity） */
  edgeOpacity?: number;
  /** 正面加权描边：edges 的单像素棱线在暗底读不出 2px border，故正面再叠 lineLoop。缺省 true */
  faceOutline?: boolean;
  /** 半透明壳套住实心内容时必须 true：关 depthWrite，否则内容被壳的深度缓冲剔除 */
  seeThrough?: boolean;
  /** 关掉 box 的 12 条 edges，只留正面轮廓。
   *  ⚠️ 多层嵌套时必须关：N 层 × 每层 4 条 Slab × (12 edges + 1 lineLoop) 的线条密度会
   *  压倒面，整组读成「一堆细线框」而不是「体」（5-D 壳首版实景抽帧的修复）。 */
  noEdges?: boolean;
};

/** 世界约定（全片唯一）：正交 + zoom 1 ⇒ 1 世界单位 = 1 CSS px；原点在画布中心。
 *  相机全片零动画（宪法二）。
 *  ⚠️ style 在类型上就禁掉了定位属性——定位是调用点契约（ISSUE-177 教训一）。 */
export const Stage3D: React.FC<{
  width: number;
  height: number;
  style?: Omit<
    React.CSSProperties,
    'position' | 'inset' | 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'
  >;
  children?: React.ReactNode;
}> = ({width, height, style, children}) => (
  <ThreeCanvas width={width} height={height} orthographic camera={{position: [0, 0, 100], zoom: 1}} style={style}>
    {/* 零光源（宪法三）：basic 材质不吃光，明暗全部来自手写面色梯度 */}
    {children}
  </ThreeCanvas>
);

/** 正面轮廓线顶点（矩形四角闭合）：edges 的单像素棱线在暗底不足以读作 2px 描边，
 *  故在正面再叠一圈 lineLoop 加权。 */
const faceOutlineAttrs = (w: number, h: number) => {
  const x = w / 2;
  const y = h / 2;
  return {
    attributes: {
      position: new THREE.BufferAttribute(
        new Float32Array([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0]),
        3,
      ),
    },
  };
};

/** 板：box + edges + 正面 lineLoop 的最小实体。
 *  ★ 返回 <group>——不建画布、不设定位、不含文字（文字永不进 3D）。 */
export const Slab3D: React.FC<{
  width: number;
  height: number;
  depth?: number;
  skin: SolidSkin;
  position?: [number, number, number];
  rotation?: [number, number, number];
  renderOrder?: number;
}> = ({width, height, depth = 14, skin, position, rotation, renderOrder}) => {
  const boxGeo = useMemo(
    // ★ 依赖数组刻意不含 frame：几何缓存跨帧复用是无头渲染确定性的一部分
    () => new THREE.BoxGeometry(width, height, depth),
    [width, height, depth],
  );
  const op = skin.opacity ?? 1;
  const eop = skin.edgeOpacity ?? op;
  return (
    <group position={position} rotation={rotation}>
      <mesh renderOrder={renderOrder}>
        <boxGeometry args={[width, height, depth]} />
        {/* basic：面色恒等于给定字面量，不受光（宪法三）。
            半透明壳须关 depthWrite，否则套在里面的实心体会被深度缓冲剔掉 */}
        <meshBasicMaterial
          color={skin.face}
          opacity={op}
          transparent
          depthWrite={skin.seeThrough ? false : undefined}
        />
      </mesh>
      {skin.noEdges ? null : (
        <lineSegments renderOrder={renderOrder}>
          <edgesGeometry args={[boxGeo]} />
          <lineBasicMaterial color={skin.edge} transparent opacity={eop} />
        </lineSegments>
      )}
      {skin.faceOutline === false ? null : (
        <lineLoop position={[0, 0, depth / 2 + 0.5]} renderOrder={renderOrder}>
          <bufferGeometry attach="geometry" {...faceOutlineAttrs(width, height)} />
          <lineBasicMaterial color={skin.edge} transparent opacity={eop} />
        </lineLoop>
      )}
    </group>
  );
};

/** 矩形井壁的一圈（中空框 = 上下左右四条 Slab3D，无前盖）。
 *
 *  5-D 的「壳」由内向外四圈叠成：层序即 z 序 —— 循环在最内最深、插口在最外最前，
 *  于是口播的「挂在外面」在几何上成立。井壁内表面朝向观者，这是「里面」不再靠
 *  约定、而成为几何事实的原因（2D 边框只能画外轮廓）。
 *
 *  合拢由调用方注入：close 0 = 四条各自在框外 openDist 处，1 = 合拢到位。 */
export const Rim3D: React.FC<{
  /** 合拢到位时的内沿尺寸（CSS px） */
  innerWidth: number;
  innerHeight: number;
  /** 框条宽 */
  band: number;
  depth?: number;
  skin: SolidSkin;
  /** 合拢进度 0..1（调用方以 win(parentProgress,[s,e]) 注入——不新增时点） */
  close: number;
  /** 未合拢时四条各自的起始外移距离（px） */
  openDist?: number;
  position?: [number, number, number];
  renderOrder?: number;
}> = ({innerWidth, innerHeight, band, depth = 16, skin, close, openDist = 90, position, renderOrder}) => {
  const c = close < 0 ? 0 : close > 1 ? 1 : close;
  const off = (1 - c) * openDist;
  // 四条的落位：上下条横跨内沿+两侧框条宽，左右条只占内沿高（避免角部重叠加深）
  const hx = innerWidth / 2 + band / 2;
  const hy = innerHeight / 2 + band / 2;
  const outerW = innerWidth + band * 2;
  // 未合拢时整体更透（effects 通道纯线性映射，非弹簧——铁律③）
  const op = (skin.opacity ?? 1) * (0.35 + 0.65 * c);
  const bandSkin: SolidSkin = {...skin, opacity: op, edgeOpacity: op};
  return (
    <group position={position}>
      {/* 上 / 下：横条 */}
      <Slab3D width={outerW} height={band} depth={depth} skin={bandSkin} position={[0, hy + off, 0]} renderOrder={renderOrder} />
      <Slab3D width={outerW} height={band} depth={depth} skin={bandSkin} position={[0, -hy - off, 0]} renderOrder={renderOrder} />
      {/* 左 / 右：竖条 */}
      <Slab3D width={band} height={innerHeight} depth={depth} skin={bandSkin} position={[-hx - off, 0, 0]} renderOrder={renderOrder} />
      <Slab3D width={band} height={innerHeight} depth={depth} skin={bandSkin} position={[hx + off, 0, 0]} renderOrder={renderOrder} />
    </group>
  );
};

/** 体积柱（5-B）。
 *
 *  ★ 刻意**不用** AXO —— 只偏航、**零俯角**。加俯角 θ 后屏幕上的表观高度是
 *  `h·cosθ + d·sinθ`，顶面会给每根柱子加一个常数高度：141/191/241/255 的比例
 *  被污染，且 yFor(20) 算出的「20–28 行实测带」会与柱子真实刻度错位（BAR_BASE 45
 *  同类疤）。纯偏航下表观高度**精确等于 height**，垂直轴仍是可直接读数的数据轴。
 *
 *  ⚠️ height 与数据线性同构 —— 本组件内**不做任何缩放**。 */
export const Bar3D: React.FC<{
  width: number;
  height: number;
  depth?: number;
  /** 缺省 AXO.yaw；pitch 恒 0（见上方说明，勿加） */
  yaw?: number;
  shell: SolidSkin;
  /** 柱底 core 段（同一高度口径）。壳转半透明时本段保持实心。 */
  base?: {height: number; skin: SolidSkin};
  position?: [number, number, number];
}> = ({width, height, depth = 46, yaw = AXO.yaw, shell, base, position}) => {
  const rot: [number, number, number] = [0, (yaw * Math.PI) / 180, 0];
  return (
    <group position={position} rotation={rot}>
      {/* 柱体以底边为锚（y=0 是柱底）——数据轴由调用方在 DOM 侧决定 */}
      {base ? (
        // 实心 core 段先画（renderOrder 0），半透明壳后画（1）：顺序 + depthWrite
        // 双保险，否则半透明壳的深度写入会把里面的实心段剔掉
        <Slab3D
          width={width - 2}
          height={base.height}
          depth={depth - 2}
          skin={base.skin}
          position={[0, base.height / 2, 0]}
          renderOrder={0}
        />
      ) : null}
      <Slab3D width={width} height={height} depth={depth} skin={shell} position={[0, height / 2, 0]} renderOrder={1} />
    </group>
  );
};

/** 插座（4-C）：内凹方口 —— 口沿四条 + 井底。
 *  井底用 theme.bg（全片最深）⇒ 读作「洞」；井壁 SOCKET_WALL 比 panel 更暗一档。 */
export const Socket3D: React.FC<{
  size: number;
  /** 井深；也是插头行程的下限锚 */
  wellDepth?: number;
  skin: SolidSkin;
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({size, wellDepth = 26, skin, position, rotation}) => {
  const band = Math.max(6, Math.round(size * 0.16));
  const inner = size - band * 2;
  return (
    <group position={position} rotation={rotation}>
      {/* 井底：沉在 -wellDepth 处的暗面板 —— 「洞」的底 */}
      <Slab3D
        width={inner}
        height={inner}
        depth={4}
        skin={{face: theme.bg, edge: SOCKET_WALL, faceOutline: false, opacity: skin.opacity}}
        position={[0, 0, -wellDepth]}
      />
      {/* 井壁四条：面色比 panel 更暗（凹陷暗部），棱线仍是概念色（口沿读法） */}
      <Rim3D
        innerWidth={inner}
        innerHeight={inner}
        band={band}
        depth={wellDepth}
        skin={{face: SOCKET_WALL, edge: skin.edge, opacity: skin.opacity, edgeOpacity: skin.edgeOpacity}}
        close={1}
        position={[0, 0, -wellDepth / 2]}
      />
    </group>
  );
};

/** 插头（4-C）：沿插座轴线进入的方块 + 两根插脚。
 *
 *  seat 0 = 完全在外，1 = 咬合到底。
 *  ★ 内部对 z 行程取 min(seat,1)：SPRING.snap 的 ζ=0.6 ⇒ 峰值 **1.095**，
 *    不钳制插头会穿透井底。过冲不丢 —— 它被转成棱线短暂提亮（edgeBoost）。 */
export const Plug3D: React.FC<{
  size: number;
  seat: number;
  /** 完全拔出时距咬合位的行程（px） */
  travel?: number;
  skin: SolidSkin;
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({size, seat, travel = 96, skin, position, rotation}) => {
  const s = seat < 0 ? 0 : seat > 1 ? 1 : seat;
  // 过冲量（seat > 1 的部分）转为棱线提亮，绝不转为额外行程
  const edgeBoost = Math.min(1, Math.max(0, seat - 1) * 6);
  const z = (1 - s) * travel;
  const pinW = Math.max(4, Math.round(size * 0.14));
  const pinLen = Math.round(size * 0.42);
  const eop = Math.min(1, (skin.edgeOpacity ?? skin.opacity ?? 1) + edgeBoost * 0.6);
  const body: SolidSkin = {...skin, edgeOpacity: eop};
  return (
    <group position={position} rotation={rotation}>
      <group position={[0, 0, z]}>
        {/* 插头本体 */}
        <Slab3D width={size} height={size} depth={22} skin={body} />
        {/* 两根插脚：先于本体进洞，是「沿轴线进入」的方向指示 */}
        <Slab3D
          width={pinW}
          height={pinW}
          depth={pinLen}
          skin={{face: skin.edge, edge: skin.edge, faceOutline: false, opacity: skin.opacity}}
          position={[-size * 0.22, 0, -11 - pinLen / 2]}
        />
        <Slab3D
          width={pinW}
          height={pinW}
          depth={pinLen}
          skin={{face: skin.edge, edge: skin.edge, faceOutline: false, opacity: skin.opacity}}
          position={[size * 0.22, 0, -11 - pinLen / 2]}
        />
      </group>
    </group>
  );
};
