import type {
  MarketEnvLevel,
  EmotionLight,
  FinalLevel,
  LevelParams,
  ReconcileResult,
} from './types';

/**
 * 市场环境等级数值映射（数字越大越激进）
 */
const ENV_RANK: Record<MarketEnvLevel, number> = {
  A: 3,
  B: 2,
  C: 1,
};

/**
 * 情绪灯号数值映射（数字越大越激进）
 */
const LIGHT_RANK: Record<EmotionLight, number> = {
  green: 3,
  yellow: 2,
  orange: 1,
  red: 0,
};

/**
 * 最终等级数值映射
 */
const LEVEL_RANK: Record<FinalLevel, number> = {
  L3: 3,
  L2: 2,
  L1: 1,
  L0: 0,
};

/**
 * 各等级对应的执行参数（规格书2.3节）
 */
const LEVEL_PARAMS: Record<FinalLevel, LevelParams> = {
  L3: {
    risk_threshold_min: 0.008,
    risk_threshold_max: 0.010,
    can_open: true,
    requires_approval: false,
    position_coefficient: 1.0,
    allowed_modes: ['强势跟随', '分歧低吸', '弱转强'],
  },
  L2: {
    risk_threshold_min: 0.005,
    risk_threshold_max: 0.008,
    can_open: true,
    requires_approval: false,
    position_coefficient: 0.7,
    allowed_modes: ['分歧低吸', '弱转强'],
  },
  L1: {
    risk_threshold_min: 0,
    risk_threshold_max: 0.003,
    can_open: false,
    requires_approval: true,
    position_coefficient: 0.4,
    allowed_modes: [],
  },
  L0: {
    risk_threshold_min: 0,
    risk_threshold_max: 0,
    can_open: false,
    requires_approval: false,
    position_coefficient: 0,
    allowed_modes: [],
  },
};

/**
 * 市场环境×情绪灯号 调和矩阵（规格书2.3节）
 * 取两者中较低（更保守）的一档
 */
const RECONCILE_MATRIX: Record<MarketEnvLevel, Record<EmotionLight, FinalLevel>> = {
  A: {
    green: 'L3',
    yellow: 'L2',
    orange: 'L1',
    red: 'L0',
  },
  B: {
    green: 'L2',
    yellow: 'L2',
    orange: 'L1',
    red: 'L0',
  },
  C: {
    green: 'L1',
    yellow: 'L1',
    orange: 'L0',
    red: 'L0',
  },
};

/**
 * 状态调和模块
 * 实现规格书2.3节保守原则：取市场环境与情绪灯号中较低的一档
 *
 * @param environment 市场环境等级 A/B/C
 * @param lightConfirmed 人工确认后的情绪灯号（未确认为null）
 * @returns 调和结果，未确认时is_preview=true
 */
export function reconcileLevel(
  environment: MarketEnvLevel,
  lightConfirmed: EmotionLight | null,
): ReconcileResult {
  // 未确认灯号：只返回预览等级，不得生成正式BUY候选
  if (lightConfirmed === null) {
    return {
      final_level: 'L1',
      is_preview: true,
      risk_threshold_min: 0,
      risk_threshold_max: 0.003,
      position_coefficient: 0.4,
      can_open: false,
      requires_approval: false,
      allowed_modes: [],
    };
  }

  const finalLevel = RECONCILE_MATRIX[environment][lightConfirmed];
  const params = LEVEL_PARAMS[finalLevel];

  return {
    final_level: finalLevel,
    is_preview: false,
    ...params,
  };
}

/**
 * 计算预览等级（未确认灯号时展示用，使用建议灯号代入）
 * 注意：此结果仅供参考展示，不得用于生成BUY候选
 */
export function calculatePreviewLevel(
  environment: MarketEnvLevel,
  lightSuggested: EmotionLight,
): FinalLevel {
  return RECONCILE_MATRIX[environment][lightSuggested];
}

/**
 * 获取等级参数
 */
export function getLevelParams(level: FinalLevel): LevelParams {
  return LEVEL_PARAMS[level];
}

/**
 * 获取等级数值（用于比较）
 */
export function getLevelRank(level: FinalLevel): number {
  return LEVEL_RANK[level];
}

/**
 * 获取环境等级数值
 */
export function getEnvRank(env: MarketEnvLevel): number {
  return ENV_RANK[env];
}

/**
 * 获取灯号数值
 */
export function getLightRank(light: EmotionLight): number {
  return LIGHT_RANK[light];
}

/**
 * 将数值等级转回FinalLevel
 */
export function rankToLevel(rank: number): FinalLevel {
  if (rank >= 3) return 'L3';
  if (rank === 2) return 'L2';
  if (rank === 1) return 'L1';
  return 'L0';
}
