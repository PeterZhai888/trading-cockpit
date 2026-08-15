import type {
  MarketEnvResult,
  MarketEnvLevel,
} from './types';

/**
 * 市场原始数据输入。
 */
export interface MarketRawData {
  up_count: number;
  down_count: number;
  limit_up_count: number;
  limit_down_count: number;
  broken_limit_count: number;
  broken_limit_rate: number;
  max_consecutive_boards: number;
  total_turnover: number;
}

/**
 * 市场环境计算模块
 *
 * 基于市场原始数据计算市场环境评分和等级。
 * 评分维度（满分100）：
 * - 涨跌比（30分）
 * - 涨停数量（25分）
 * - 炸板率（20分，反向）
 * - 连板高度（15分）
 * - 成交额（10分）
 */

interface ScoringThreshold {
  excellent: number;
  good: number;
  fair: number;
}

function scoreByThreshold(
  value: number,
  thresholds: ScoringThreshold,
  maxScore: number,
  reverse = false,
): number {
  if (reverse) {
    if (value <= thresholds.excellent) return maxScore;
    if (value <= thresholds.good) return maxScore * 0.7;
    if (value <= thresholds.fair) return maxScore * 0.4;
    return 0;
  }
  if (value >= thresholds.excellent) return maxScore;
  if (value >= thresholds.good) return maxScore * 0.7;
  if (value >= thresholds.fair) return maxScore * 0.4;
  return 0;
}

/**
 * 计算涨跌比得分
 * ratio = up_count / down_count
 */
function scoreAdvanceDeclineRatio(data: MarketRawData): number {
  if (data.down_count === 0) return 30;
  const ratio = data.up_count / data.down_count;
  return scoreByThreshold(ratio, { excellent: 3, good: 1.5, fair: 0.8 }, 30);
}

/**
 * 计算涨停数量得分
 */
function scoreLimitUpCount(data: MarketRawData): number {
  return scoreByThreshold(
    data.limit_up_count,
    { excellent: 60, good: 30, fair: 15 },
    25,
  );
}

/**
 * 计算炸板率得分（反向指标）
 * broken_limit_rate 单位：%
 */
function scoreBrokenLimitRate(data: MarketRawData): number {
  return scoreByThreshold(
    data.broken_limit_rate,
    { excellent: 15, good: 25, fair: 40 },
    20,
    true,
  );
}

/**
 * 计算连板高度得分
 */
function scoreConsecutiveBoards(data: MarketRawData): number {
  return scoreByThreshold(
    data.max_consecutive_boards,
    { excellent: 6, good: 4, fair: 2 },
    15,
  );
}

/**
 * 计算成交额得分（单位：亿元）
 */
function scoreTurnover(data: MarketRawData): number {
  const turnoverYi = data.total_turnover / 100000000;
  return scoreByThreshold(
    turnoverYi,
    { excellent: 10000, good: 7000, fair: 5000 },
    10,
  );
}

/**
 * 根据总分确定市场环境等级
 * >= 70: A级（进攻）
 * 40-69: B级（震荡）
 * < 40:  C级（防守）
 */
function scoreToLevel(score: number): MarketEnvLevel {
  if (score >= 70) return 'A';
  if (score >= 40) return 'B';
  return 'C';
}

function getEnvLabel(level: MarketEnvLevel): string {
  const labels: Record<MarketEnvLevel, string> = {
    A: '进攻',
    B: '震荡',
    C: '防守',
  };
  return labels[level];
}

/**
 * 计算市场环境
 */
export function calculateMarketEnvironment(
  data: MarketRawData,
): MarketEnvResult {
  const s1 = scoreAdvanceDeclineRatio(data);
  const s2 = scoreLimitUpCount(data);
  const s3 = scoreBrokenLimitRate(data);
  const s4 = scoreConsecutiveBoards(data);
  const s5 = scoreTurnover(data);

  const score = Math.round(s1 + s2 + s3 + s4 + s5);
  const environment = scoreToLevel(score);

  return {
    score,
    environment,
    env_label: getEnvLabel(environment),
  };
}

/**
 * 计算市场环境评分明细（用于UI展示）
 */
export function getMarketScoreBreakdown(data: MarketRawData): Record<string, number> {
  return {
    涨跌比: scoreAdvanceDeclineRatio(data),
    涨停数量: scoreLimitUpCount(data),
    炸板率: scoreBrokenLimitRate(data),
    连板高度: scoreConsecutiveBoards(data),
    成交额: scoreTurnover(data),
  };
}
