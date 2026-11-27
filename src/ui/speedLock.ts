/**
 * 观感恒速（Speed-Lock）：让「倍速」表示屏幕观感速度，而不再只是时间流速。
 *
 * 根因：地图上的位置由日期唯一决定，屏幕位移速度 = 世界速度 × 2^zoom。
 * 同一倍速下放大一个层级，屏幕上的位移速度就翻一倍，
 * 于是「放大看细节」时部队总是一晃而过，什么也留不住。
 *
 * 对策：把时间推进速率乘以 2^(strength · (refZoom − zoom))。
 * 放大（zoom ↑）即放慢时间，使屏幕上每秒划过的像素量维持在默认视野的水平；
 * 缩小（zoom ↓）方向不做补偿，保持原有手感——缩远看大势时本来就该快。
 *
 * 参考视野 refZoom 取「当前战役的默认相机 zoom」（无战役时取全国总览档），
 * 所以每个战役在它自己的目标视野下仍是 1× 基准手感，只有用户再手动放大才会放慢。
 *
 * 本模块不依赖 maplibre，公式可单独回归：见 speedLockTarget。
 */

export const SPEED_LOCK = {
  /**
   * 补偿强度：1 = 屏幕速度完全恒定（放大多少倍，时间就慢多少倍）。
   * 这正是「要观感一致、不要时间一致」的严格解，最小偏差、最不晃眼。
   */
  strength: 1,
  /** 快速档（≥4×）时减半，避免用户想快进却被观感锁拖住 */
  fastTierStrength: 0.5,
  /**
   * 因子上限 = 1：只在「比参考视野更放大」时放慢，缩小方向不加速。
   * 缩小到全国本来就会显得快，若再主动加速会与既有手感冲突、也让日期跳得太猛。
   */
  maxFactor: 1,
  /** 因子下限：最多放慢到 1/10，防止极深缩放把时间轴冻成静止 */
  minFactor: 0.1,
  /** 每帧向目标因子靠拢的比例，吸收滚轮与运镜造成的 zoom 跳变 */
  smoothing: 0.14,
  /** 无战役接管时的参考视野 zoom（全国总览 / 走廊跟随档） */
  overviewZoom: 5.05,
} as const;

/** 本帧播放速率剖面：最终时间推进速率 = 用户倍速 × time × lock */
export interface PlaybackRateProfile {
  /** 战役节奏压缩（把每个 beat 的历史跨度摊到约 4.6 秒） */
  time: number;
  /** 比例尺观感补偿，< 1 表示当前比参考视野更放大、时间已相应放慢 */
  lock: number;
}

/**
 * 目标补偿因子：zoom 相对 refZoom 每放大一个层级，时间流速减半（strength = 1 时）。
 * 结果落在 [minFactor, maxFactor] 之间，防止极端缩放冻住或飞掠时间轴。
 */
export function speedLockTarget(zoom: number, refZoom: number, strength: number): number {
  const raw = Math.pow(2, strength * (refZoom - zoom));
  return Math.max(SPEED_LOCK.minFactor, Math.min(SPEED_LOCK.maxFactor, raw));
}

/**
 * 一阶指数平滑：把目标因子收拢到当前值。
 * 用于吸收两类跳变——滚轮缩放的阶跃、运镜 flyTo 过程中连续变化的 zoom，
 * 否则时间流速会随镜头一起突跳，反而更晃眼。
 */
export function smoothSpeedLock(current: number | null, target: number): number {
  if (current === null) return target;
  return current + (target - current) * SPEED_LOCK.smoothing;
}
