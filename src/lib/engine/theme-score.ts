import type { ThemeScoreDetail } from './types';

/**
 * 主线评分模块
 *
 * 六项评分（满分100）：
 * - 资金强度 25分
 * - 板块扩散 20分
 * - 政策逻辑 15分
 * - 持续性 10分
 * - 市场认可 15分
 * - 龙头表现 15分
 *
 * 计算顺序：先主线后龙头（规格书2.5节补充说明）
 */

export interface ThemeInput {
  capital_strength: number;     // 0-100 板块资金流入强度
  spread_count: number;         // 板块内上涨家数
  total_count: number;          // 板块内总家数
  has_policy: boolean;          // 是否有政策/事件催化
  policy_strength: number;      // 0-100 政策力度
  consecutive_days: number;     // 主线持续天数
  limit_up_count: number;       // 板块涨停数
  leader_change_pct: number;    // 龙头涨幅%
  leader_consecutive_boards: number; // 龙头连板数
}

function scoreCapitalStrength(input: ThemeInput): number {
  // 资金强度 0-100 映射到 0-25
  return Math.round((input.capital_strength / 100) * 25);
}

function scoreSpread(input: ThemeInput): number {
  // 板块扩散度 = 上涨家数 / 总家数，映射到 0-20
  if (input.total_count === 0) return 0;
  const ratio = input.spread_count / input.total_count;
  if (ratio >= 0.8) return 20;
  if (ratio >= 0.6) return 15;
  if (ratio >= 0.4) return 10;
  if (ratio >= 0.2) return 5;
  return 0;
}

function scorePolicy(input: ThemeInput): number {
  // 政策逻辑 0-15
  if (!input.has_policy) return 0;
  if (input.policy_strength >= 80) return 15;
  if (input.policy_strength >= 50) return 10;
  return 5;
}

function scoreExpectation(input: ThemeInput): number {
  // 持续性 0-10
  if (input.consecutive_days >= 5) return 10;
  if (input.consecutive_days >= 3) return 7;
  if (input.consecutive_days >= 2) return 4;
  return 2;
}

function scoreRecognition(input: ThemeInput): number {
  // 市场认可 0-15，基于板块涨停数量
  if (input.limit_up_count >= 8) return 15;
  if (input.limit_up_count >= 5) return 12;
  if (input.limit_up_count >= 3) return 8;
  if (input.limit_up_count >= 1) return 4;
  return 0;
}

function scoreLeaderPerformance(input: ThemeInput): number {
  // 龙头表现 0-15
  let score = 0;
  // 连板高度贡献 0-8
  if (input.leader_consecutive_boards >= 5) score += 8;
  else if (input.leader_consecutive_boards >= 3) score += 6;
  else if (input.leader_consecutive_boards >= 2) score += 4;
  else if (input.leader_consecutive_boards >= 1) score += 2;

  // 涨幅贡献 0-7
  if (input.leader_change_pct >= 9) score += 7;
  else if (input.leader_change_pct >= 5) score += 5;
  else if (input.leader_change_pct >= 2) score += 3;

  return score;
}

/**
 * 计算主线评分
 */
export function calculateThemeScore(input: ThemeInput): ThemeScoreDetail {
  const capital_score = scoreCapitalStrength(input);
  const spread_score = scoreSpread(input);
  const policy_score = scorePolicy(input);
  const expectation_score = scoreExpectation(input);
  const recognition_score = scoreRecognition(input);
  const leader_performance_score = scoreLeaderPerformance(input);

  return {
    capital_score,
    spread_score,
    policy_score,
    expectation_score,
    recognition_score,
    leader_performance_score,
    total:
      capital_score +
      spread_score +
      policy_score +
      expectation_score +
      recognition_score +
      leader_performance_score,
  };
}

/**
 * 主线评分中文键名映射（用于JSON存储）
 */
export const THEME_SCORE_LABELS: Record<keyof Omit<ThemeScoreDetail, 'total'>, string> = {
  capital_score: '资金强度',
  spread_score: '板块扩散',
  policy_score: '政策逻辑',
  expectation_score: '持续性',
  recognition_score: '市场认可',
  leader_performance_score: '龙头表现',
};
