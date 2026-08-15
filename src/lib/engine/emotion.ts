/**
 * 情绪计算模块
 * 基于市场原始数据计算：
 * 1. 情绪周期（六阶段：冰点/修复/启动/分歧/高潮/退潮）
 * 2. 情绪灯号（green/yellow/orange/red）
 * 3. 数据可信度
 *
 * v0.6 修正（用户确认的标准六阶段）：
 * - 冰点：涨停<20，跌停>10，连板≤2
 * - 修复：涨停20-40，跌停<10，连板3-4
 * - 启动：涨停40-60，连板≥4，主线出现
 * - 分歧：涨停维持但炸板率>30%，高位股分化
 * - 高潮：涨停>60，板块全面扩散，龙头加速
 * - 退潮：涨停<30，跌停增多，高位股批量杀跌
 *
 * 所有阈值通过 EMOTION_THRESHOLDS 集中配置，便于后续根据市场环境微调。
 */

import type { EmotionCycle, EmotionLight, MarketEnvLevel } from "./types";

// ====== 阈值配置（可调） ======
export const EMOTION_THRESHOLDS = {
  icepoint: {
    limitUpMax: 20,    // 涨停数 < 20
    limitDownMin: 10,  // 跌停数 > 10
    maxConsecutiveMax: 2, // 连板高度 ≤ 2
  },
  recovery: {
    limitUpMin: 20,
    limitUpMax: 40,    // 涨停 20-40
    limitDownMax: 10,  // 跌停 < 10
    consecutiveMin: 3,
    consecutiveMax: 4, // 连板 3-4
  },
  launch: {
    limitUpMin: 40,
    limitUpMax: 60,    // 涨停 40-60
    consecutiveMin: 4, // 连板 ≥ 4
  },
  divergence: {
    brokenRateMin: 30, // 炸板率 > 30%
  },
  climax: {
    limitUpMin: 60,    // 涨停 > 60
  },
  retreat: {
    limitUpMax: 30,    // 涨停 < 30
    limitDownMin: 10,  // 跌停 > 10
    netHeatMax: 0,     // 涨停-跌停 ≤ 0（走弱）
  },
} as const;

// ====== 原始数据结构 ======
export interface MarketRawData {
  up_count?: number;
  down_count?: number;
  limit_up_count?: number;
  limit_down_count?: number;
  broken_limit_count?: number;
  broken_limit_rate?: number;
  max_consecutive_boards?: number;
  total_turnover?: number;
}

// ====== 输出结构（对齐 types.EmotionResult） ======
export interface EmotionCalcResult {
  cycle: EmotionCycle;
  light_suggested: EmotionLight;
  light_confirmed: EmotionLight | null;
  confidence: number;
  reason: string;
  thresholds: typeof EMOTION_THRESHOLDS;
  votes?: Record<string, number>;
}

/**
 * 计算情绪周期（六阶段）
 * 优先级：冰点 > 退潮 > 高潮 > 分歧 > 启动 > 修复 > 观察(兜底)
 */
export function determineCycle(raw: MarketRawData): {
  cycle: EmotionCycle;
  reason: string;
} {
  const limitUp = raw.limit_up_count ?? 0;
  const limitDown = raw.limit_down_count ?? 0;
  const brokenRate = raw.broken_limit_rate ?? 0;
  const boards = raw.max_consecutive_boards ?? 0;
  const netHeat = limitUp - limitDown;
  const t = EMOTION_THRESHOLDS;

  // 1. 冰点：涨停低 + 跌停多 + 连板低
  if (
    limitUp < t.icepoint.limitUpMax &&
    limitDown > t.icepoint.limitDownMin &&
    boards <= t.icepoint.maxConsecutiveMax
  ) {
    return {
      cycle: "冰点",
      reason: `涨停${limitUp}<20，跌停${limitDown}>10，连板高度${boards}≤2，赚钱效应极差`,
    };
  }

  // 2. 退潮：涨停骤降 + 跌停增多 + 高位股杀跌（netHeat≤0）
  if (
    limitUp < t.retreat.limitUpMax &&
    limitDown > t.retreat.limitDownMin &&
    netHeat <= t.retreat.netHeatMax
  ) {
    return {
      cycle: "退潮",
      reason: `涨停${limitUp}<30，跌停${limitDown}>10，净热度${netHeat}≤0，高位股批量杀跌`,
    };
  }

  // 3. 高潮：涨停爆发 + 板块扩散
  if (limitUp > t.climax.limitUpMin) {
    return {
      cycle: "高潮",
      reason: `涨停${limitUp}>60，板块全面扩散，龙头加速`,
    };
  }

  // 4. 分歧：涨停维持但炸板率高
  if (brokenRate > t.divergence.brokenRateMin) {
    return {
      cycle: "分歧",
      reason: `炸板率${brokenRate.toFixed(1)}%>30%，高位股分化，跟风减少`,
    };
  }

  // 5. 启动：涨停明显增加 + 连板≥4（原"发酵"阶段，按用户定案改名"启动"）
  if (
    limitUp >= t.launch.limitUpMin &&
    limitUp <= t.launch.limitUpMax &&
    boards >= t.launch.consecutiveMin
  ) {
    return {
      cycle: "启动",
      reason: `涨停${limitUp}在40-60区间，连板高度${boards}≥4，主线开始出现`,
    };
  }

  // 6. 修复：涨停回升 + 跌停减少 + 连板恢复
  if (
    limitUp >= t.recovery.limitUpMin &&
    limitUp <= t.recovery.limitUpMax &&
    limitDown < t.recovery.limitDownMax &&
    boards >= t.recovery.consecutiveMin &&
    boards <= t.recovery.consecutiveMax
  ) {
    return {
      cycle: "修复",
      reason: `涨停${limitUp}回升至20-40，跌停${limitDown}<10，连板${boards}恢复至3-4板`,
    };
  }

  // 兜底：观察（数据不满足任一明确阶段）
  return {
    cycle: "观察",
    reason: `数据不满足六阶段典型特征（涨停${limitUp}/跌停${limitDown}/炸板${brokenRate.toFixed(1)}%/连板${boards}），维持观察`,
  };
}

/**
 * 根据市场环境等级计算建议灯号
 * - C级（防守）：红灯
 * - A级（进攻）：绿灯
 * - B级（震荡）：看炸板率，>30%橙灯，否则黄灯
 */
export function determineLight(
  envLevel: MarketEnvLevel,
  brokenRate: number,
): EmotionLight {
  if (envLevel === "C") return "red";
  if (envLevel === "A") return "green";
  // B级震荡
  return brokenRate > 30 ? "orange" : "yellow";
}

/**
 * 计算数据可信度（0-100）
 * - 数据完整度 40%
 * - 数值合理性 30%
 * - 数据新鲜度由调用方传入
 */
export function calcConfidence(raw: MarketRawData): number {
  const fields = [
    raw.up_count,
    raw.down_count,
    raw.limit_up_count,
    raw.limit_down_count,
    raw.broken_limit_count,
    raw.broken_limit_rate,
    raw.max_consecutive_boards,
    raw.total_turnover,
  ];
  const filled = fields.filter((f) => f != null && f >= 0).length;
  const completeness = (filled / fields.length) * 40;

  // 合理性：涨跌家数之和应该在合理范围
  const total = (raw.up_count ?? 0) + (raw.down_count ?? 0);
  const reasonableness = total > 1000 ? 30 : total > 100 ? 15 : 0;

  // 新鲜度默认满分（调用方可以根据时间衰减）
  const freshness = 30;

  return Math.round(completeness + reasonableness + freshness);
}

/**
 * 主函数：计算情绪
 * @param raw 市场原始数据
 * @param envLevel 市场环境等级（A/B/C），由市场环境计算模块提供
 */
export function calculateEmotion(
  raw: MarketRawData,
  envLevel: MarketEnvLevel,
): EmotionCalcResult {
  const { cycle, reason } = determineCycle(raw);
  const brokenRate = raw.broken_limit_rate ?? 0;
  const lightSuggested = determineLight(envLevel, brokenRate);
  const confidence = calcConfidence(raw);

  return {
    cycle,
    light_suggested: lightSuggested,
    light_confirmed: null, // AI建议值，需人工确认
    confidence,
    reason,
    thresholds: EMOTION_THRESHOLDS,
  };
}
