import type { DataQualityResult, DataAttribute, DataState, DataSource } from './types';

/**
 * 数据管理模块
 * 实现规格书附录A
 */

/**
 * 判断数据状态
 */
export function determineDataState(attr: {
  source: DataSource;
  fetch_time: Date;
  valid_until: Date;
  has_error?: boolean;
}): DataState {
  if (attr.has_error) return 'invalid';
  const now = new Date();
  if (now > attr.valid_until) return 'expired';
  return 'valid';
}

/**
 * 创建数据属性
 */
export function createDataAttribute(
  source: DataSource,
  validMinutes: number,
): DataAttribute {
  const now = new Date();
  return {
    source,
    fetch_time: now,
    valid_until: new Date(now.getTime() + validMinutes * 60 * 1000),
    state: 'valid',
  };
}

/**
 * 计算数据可信度评分
 * 数据可信度 = 行情完整度×0.4 + 更新时效性×0.3 + 来源可靠性×0.3
 */
export function calculateDataQuality(input: {
  completeness: number;  // 0-100 行情完整度
  last_fetch_minutes_ago: number;  // 多少分钟前更新
  expected_freshness_minutes: number; // 期望新鲜度（分钟）
  source_reliability: number; // 0-100 来源可靠性
}): DataQualityResult {
  const completeness = Math.max(0, Math.min(100, input.completeness));

  // 更新时效性：在期望时间内满分，超出线性衰减
  let timeliness: number;
  if (input.last_fetch_minutes_ago <= input.expected_freshness_minutes) {
    timeliness = 100;
  } else {
    const overdue = input.last_fetch_minutes_ago - input.expected_freshness_minutes;
    timeliness = Math.max(0, 100 - (overdue / input.expected_freshness_minutes) * 50);
  }

  const reliability = Math.max(0, Math.min(100, input.source_reliability));
  const total = Math.round(
    completeness * 0.4 + timeliness * 0.3 + reliability * 0.3,
  );

  return {
    completeness: Math.round(completeness),
    timeliness: Math.round(timeliness),
    reliability: Math.round(reliability),
    total,
    cautious_mode: total < 70,
  };
}

/**
 * 数据可信度阈值（低于此值进入谨慎模式）
 */
export const DATA_QUALITY_THRESHOLD = 70;

/**
 * 不同数据类型的有效期（分钟）
 */
export const DATA_FRESHNESS = {
  HIGH_FREQ: 5,      // 股价、成交量（盘中）
  MID_FREQ: 240,     // 市场环境、评分（每日）
  LOW_FREQ: 1440,    // 政策、产业趋势（阶段更新）
} as const;

/**
 * 来源可靠性评分
 */
export const SOURCE_RELIABILITY: Record<DataSource, number> = {
  行情接口: 95,
  AI分析: 70,
  人工输入: 80,
};
