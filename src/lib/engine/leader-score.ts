import type { LeaderScoreDetail } from './types';

/**
 * 龙头评分模块
 *
 * 六项评分（满分100）：
 * - 辨识度 20分
 * - 资金强度 25分
 * - 带动能力 15分
 * - 技术形态 15分
 * - 情绪匹配 15分
 * - 风险收益 10分
 *
 * 注意：必须在主线评分之后计算（规格书2.5节）
 */

export interface LeaderInput {
  is_first_to_limit: boolean;     // 是否首只涨停
  consecutive_boards: number;     // 连板数
  name_recognition: number;       // 0-100 市场辨识度
  turnover_rate: number;          // 换手率%
  net_inflow: number;             // 主力净流入（万元）
  market_cap: number;             // 流通市值（亿元）
  followers_limit_up: number;     // 带动涨停数
  sector_change_pct: number;      // 板块涨幅%
  technical_score: number;        // 0-100 技术形态评分（AI辅助）
  emotion_cycle_match: number;    // 0-100 与当前情绪周期匹配度
  current_price: number;
  stop_price: number;
  target_price: number;
}

function scoreRecognition(input: LeaderInput): number {
  // 辨识度 0-20
  let score = 0;
  if (input.is_first_to_limit) score += 8;
  if (input.consecutive_boards >= 3) score += 6;
  else if (input.consecutive_boards >= 2) score += 4;
  else if (input.consecutive_boards >= 1) score += 2;
  score += Math.round((input.name_recognition / 100) * 6);
  return Math.min(20, score);
}

function scoreCapital(input: LeaderInput): number {
  // 资金强度 0-25
  let score = 0;
  // 换手率适度（5-20%为佳）
  if (input.turnover_rate >= 5 && input.turnover_rate <= 20) score += 8;
  else if (input.turnover_rate >= 3 && input.turnover_rate <= 25) score += 5;
  else if (input.turnover_rate > 0) score += 2;

  // 主力净流入
  if (input.net_inflow >= 10000) score += 10;
  else if (input.net_inflow >= 5000) score += 7;
  else if (input.net_inflow >= 1000) score += 4;
  else if (input.net_inflow > 0) score += 2;

  // 流通市值适中（50-300亿为佳）
  if (input.market_cap >= 50 && input.market_cap <= 300) score += 7;
  else if (input.market_cap >= 30 && input.market_cap <= 500) score += 4;
  else if (input.market_cap > 0) score += 2;

  return Math.min(25, score);
}

function scoreDrive(input: LeaderInput): number {
  // 带动能力 0-15
  let score = 0;
  if (input.followers_limit_up >= 5) score += 10;
  else if (input.followers_limit_up >= 3) score += 7;
  else if (input.followers_limit_up >= 1) score += 4;

  if (input.sector_change_pct >= 3) score += 5;
  else if (input.sector_change_pct >= 1) score += 3;
  else if (input.sector_change_pct > 0) score += 1;

  return Math.min(15, score);
}

function scoreTechnical(input: LeaderInput): number {
  // 技术形态 0-15，AI辅助评分
  return Math.round((input.technical_score / 100) * 15);
}

function scoreEmotion(input: LeaderInput): number {
  // 情绪匹配 0-15
  return Math.round((input.emotion_cycle_match / 100) * 15);
}

function scoreRiskReward(input: LeaderInput): number {
  // 风险收益比 0-10
  const risk = input.current_price - input.stop_price;
  const reward = input.target_price - input.current_price;
  if (risk <= 0 || reward <= 0) return 0;

  const ratio = reward / risk;
  if (ratio >= 3) return 10;
  if (ratio >= 2) return 7;
  if (ratio >= 1.5) return 5;
  if (ratio >= 1) return 3;
  return 0;
}

/**
 * 计算龙头评分
 */
export function calculateLeaderScore(input: LeaderInput): LeaderScoreDetail {
  const recognition = scoreRecognition(input);
  const capital = scoreCapital(input);
  const drive = scoreDrive(input);
  const technical = scoreTechnical(input);
  const emotion = scoreEmotion(input);
  const risk_reward = scoreRiskReward(input);

  return {
    recognition,
    capital,
    drive,
    technical,
    emotion,
    risk_reward,
    total: recognition + capital + drive + technical + emotion + risk_reward,
  };
}
