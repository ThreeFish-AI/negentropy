/** Transcript 共用样式常量。 */

/** 统一徽章胶囊基类（error / verdict / result / gate / evaluation 共用）。 */
export const BADGE_BASE =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";

/** 展开区代码块基类：等宽、可选中、纵向滚动封顶。 */
export const CODE_BLOCK = "max-h-[400px] overflow-auto px-2.5 py-2 font-mono text-[12.5px] leading-relaxed select-text";

/** 机侧 assistant 气泡基类（左上拉直 = 机侧，镜像用户气泡右上拉直 ``rounded-tr-sm``）。 */
export const ASSISTANT_BUBBLE_CLASS = "rounded-2xl rounded-tl-sm bg-muted/30 px-4 py-3";

/** 长消息折叠阈值（字符数）——超过则折叠为限高 + 渐隐 + 「展开全文」（对齐 Conductor Show full message）。 */
export const LONG_MESSAGE_THRESHOLD_CHARS = 1500;

/** 长消息折叠态限高（≈12 行）——与 ``LONG_MESSAGE_THRESHOLD_CHARS`` 配合决定折叠。 */
export const LONG_MESSAGE_COLLAPSED_MAX_HEIGHT = "max-h-[18rem]";
