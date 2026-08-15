import type {
  MarketRawData,
  EmotionCycle,
  EmotionLight,
  EmotionResult,
} from './types';

/**
 * 情绪计算模块
 *
 * 基于市场数据推断情绪周期和建议灯号。
 * 注意：此模块输出的是"建议值"，必须经人工确认后才能用于状态调和。
 *
 * 情绪周期六阶段判定逻辑（v0.6 标准命名）：
 * - 冰点：涨停<10，跌停>20，炸板率>40%
 * - 修复：涨停15-30，昨日涨停反馈转好，连板高度从低位回升（原"启动20-40"）
 * - 启动：涨停30-60，连板高度3-5板，炸板率下降（原"发酵"）
 * - 高潮：涨停>60，连板高度≥6板，市场一致性强
 * - 分歧：涨停数量开始下降，炸板率上升，高位股出现亏钱效应
 * - 退潮：跌停增加，连板高度下降，高位股补跌
 */

export interface EmotionInput extends MarketRawData {
  prev_limit_up_count?: number;
  prev_limit_up_performance?: number; // 昨日涨停股今日平均涨幅%
}

function determineCycle(data: EmotionInput): EmotionCycle {
  const {
    limit_up_count,
    limit_down_count,
    broken_limit_rate,
    max_consecutive_boards,
    prev_limit_up_count,
    prev_limit_up_performance,
  } = data;

  // 冰点条件
  if (
    limit_up_count < 10 &&
    (limit_down_count > 20 || broken_limit_rate > 40)
  ) {
    return '冰点';
  }

  // 高潮条件
  if (
    limit_up_count >= 60 &&
    max_consecutive_boards >= 6 &&
    broken_limit_rate < 20
  ) {
    return '高潮';
  }

  // 退潮条件
  if (
    limit_down_count > 15 ||
    (prev_limit_up_performance !== undefined &&
      prev_limit_up_performance < -2) ||
    (max_consecutive_boards <= 2 && limit_up_count < 20)
  ) {
    return '退潮';
  }

  // 修复条件（原"启动"）：从冰点低位回升
  if (
    limit_up_count >= 15 &&
    limit_up_count <= 30 &&
    (prev_limit_up_count === undefined ||
      limit_up_count > prev_limit_up_count) &&
    max_consecutive_boards <= 3
  ) {
    return '修复';
  }

  // 启动条件（原"发酵"）：情绪持续扩散
  if (
    limit_up_count >= 30 &&
    limit_up_count <= 60 &&
    max_consecutive_boards >= 3 &&
    max_consecutive_boards <= 5 &&
    broken_limit_rate < 30
  ) {
    return '启动';
  }

  // 分歧条件：涨停开始下降或炸板率上升
  if (
    broken_limit_rate >= 25 ||
    (prev_limit_up_count !== undefined &&
      limit_up_count < prev_limit_up_count * 0.8)
  ) {
    return '分歧';
  }

  // 默认根据涨停数量粗判：≥40归启动，15-39归修复，<15归冰点
  if (limit_up_count >= 40) return '启动';
  if (limit_up_count >= 15) return '修复';
  return '冰点';
}

/**
 * 情绪周期映射建议灯号
 */
const CYCLE_TO_LIGHT: Record<EmotionCycle, EmotionLight> = {
  冰点: 'red',
  修复: 'green',
  启动: 'green',
  分歧: 'yellow',
  高潮: 'yellow',   // 高潮期需要注意风险，黄灯
  退潮: 'orange',
};

/**
 * 计算情绪状态
 * @param data 市场数据
 * @param confirmedLight 人工已确认的灯号（如有）
 */
export function calculateEmotion(
  data: EmotionInput,
  confirmedLight: EmotionLight | null = null,
): EmotionResult {
  const cycle = determineCycle(data);
  const suggested = CYCLE_TO_LIGHT[cycle];

  return {
    cycle,
    light_suggested: suggested,
    light_confirmed: confirmedLight,
  };
}

/**
 * 灯号中文标签
 */
export const LIGHT_LABELS: Record<EmotionLight, string> = {
  green: '绿灯',
  yellow: '黄灯',
  orange: '橙灯',
  red: '红灯',
};

/**
 * 情绪周期描述
 */
export const CYCLE_DESCRIPTIONS: Record<EmotionCycle, string> = {
  冰点: '市场极度低迷，观望为主',
  修复: '情绪从冰点回升，赚钱效应初现',
  启动: '情绪持续扩散，主线逐渐清晰',
  分歧: '资金出现分歧，高位股波动加大',
  高潮: '市场一致性强，但需警惕高位风险',
  退潮: '赚钱效应消退，控制仓位为主',
};
