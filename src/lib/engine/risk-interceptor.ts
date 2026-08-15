import type {
  FinalLevel,
  InterceptResult,
  RiskCheckResult,
  AccountRiskInput,
  PositionCalcInput,
} from './types';
import { calculateAccountRisk, calculatePosition } from './risk-calc';
import { getLevelParams } from './state-reconcile';

/**
 * 风险拦截引擎
 * 实现规格书4.3节8条拦截规则
 *
 * 优先级（严格按照流程图）：
 * ① 条件4：关键数据缺失
 * ② 条件3：T+1数据缺失
 * ③ 条件5：连续5笔亏损暂停期
 * ④ 条件7：final_level = L0
 * ⑤ 条件6：当日累计风险 ≥ 2%
 * ⑥ 条件2：无止损价格
 * ⑦ 条件1：单笔风险超阈值
 * ⑧ 条件8：L1未特批
 */

export interface RiskCheckInput {
  // 数据完整性
  has_current_price: boolean;
  has_total_capital: boolean;
  has_stop_price: boolean;
  has_sellable_qty: boolean;
  has_holding_time: boolean;

  // 账户与交易参数
  account_risk_input: AccountRiskInput;

  // 连续亏损
  consecutive_losses: number;
  suspension_remaining_days: number;

  // 状态
  final_level: FinalLevel;
  is_preview: boolean;

  // 当日风险
  daily_risk_pct: number;

  // 仓位计算
  position_input: PositionCalcInput;

  // L1特批
  has_approval_reason: boolean;
}

function condition4_MissingData(input: RiskCheckInput): InterceptResult {
  const missing: string[] = [];
  if (!input.has_current_price) missing.push('现价');
  if (!input.has_total_capital) missing.push('账户资金');
  if (!input.has_stop_price) missing.push('止损价');

  return {
    condition: 4,
    triggered: missing.length > 0,
    intercept_type: 'hard',
    message:
      missing.length > 0
        ? `关键数据缺失：${missing.join('、')}`
        : '关键数据完整',
    details: missing.length > 0 ? `缺失字段：${missing.join(', ')}` : undefined,
  };
}

function condition3_T1DataMissing(input: RiskCheckInput): InterceptResult {
  const missing: string[] = [];
  if (!input.has_sellable_qty) missing.push('可卖数量');
  if (!input.has_holding_time) missing.push('持仓时间');

  return {
    condition: 3,
    triggered: missing.length > 0,
    intercept_type: 'hard',
    message:
      missing.length > 0
        ? `T+1风险无法评估：${missing.join('、')}数据缺失`
        : 'T+1数据完整',
  };
}

function condition5_Suspension(input: RiskCheckInput): InterceptResult {
  const triggered = input.suspension_remaining_days > 0;
  return {
    condition: 5,
    triggered,
    intercept_type: 'hard_no_exception',
    message: triggered
      ? `连续5笔亏损暂停期，剩余${input.suspension_remaining_days}个交易日`
      : '不在暂停期',
  };
}

function condition7_L0(input: RiskCheckInput): InterceptResult {
  return {
    condition: 7,
    triggered: input.final_level === 'L0',
    intercept_type: 'hard',
    message:
      input.final_level === 'L0'
        ? '最终交易等级L0（停止），禁止新开仓'
        : `当前等级${input.final_level}，非L0`,
  };
}

function condition6_DailyRisk(input: RiskCheckInput): InterceptResult {
  const dailyLimit = 0.02;
  return {
    condition: 6,
    triggered: input.daily_risk_pct >= dailyLimit,
    intercept_type: 'hard',
    message:
      input.daily_risk_pct >= dailyLimit
        ? `当日累计风险${(input.daily_risk_pct * 100).toFixed(2)}%已达2%上限`
        : `当日累计风险${(input.daily_risk_pct * 100).toFixed(2)}%`,
  };
}

function condition2_NoStopPrice(input: RiskCheckInput): InterceptResult {
  return {
    condition: 2,
    triggered: !input.has_stop_price,
    intercept_type: 'hard',
    message: input.has_stop_price ? '已设置止损价格' : '未设置止损价格',
  };
}

function condition1_SingleRisk(
  input: RiskCheckInput,
): InterceptResult & { current_risk_pct?: number; threshold_max?: number } {
  const params = getLevelParams(input.final_level);
  const risk = calculateAccountRisk(input.account_risk_input);
  const exceeds = risk.account_risk_pct > params.risk_threshold_max;

  return {
    condition: 1,
    triggered: exceeds,
    intercept_type: 'hard',
    message: exceeds
      ? `账户风险${(risk.account_risk_pct * 100).toFixed(2)}%超过${input.final_level}阈值上限${(params.risk_threshold_max * 100).toFixed(2)}%`
      : `账户风险${(risk.account_risk_pct * 100).toFixed(2)}%在阈值范围内`,
    current_risk_pct: risk.account_risk_pct,
    threshold_max: params.risk_threshold_max,
  };
}

function condition8_L1Approval(input: RiskCheckInput): InterceptResult {
  if (input.final_level !== 'L1') {
    return {
      condition: 8,
      triggered: false,
      intercept_type: 'approvable',
      message: `当前等级${input.final_level}，非L1`,
    };
  }

  return {
    condition: 8,
    triggered: !input.has_approval_reason,
    intercept_type: 'approvable',
    message: input.has_approval_reason
      ? 'L1已填写特批理由，允许放行（标记违规）'
      : 'L1防守等级需填写特批理由后才可开仓',
  };
}

/**
 * 执行完整风险拦截检查
 * 严格按照优先级顺序：条件4→3→5→7→6→2→1→8
 */
export function checkRiskInterception(
  input: RiskCheckInput,
): RiskCheckResult {
  const violations: InterceptResult[] = [];

  // 预览状态：不生成正式BUY候选
  if (input.is_preview) {
    violations.push({
      condition: 4,
      triggered: true,
      intercept_type: 'hard',
      message: '情绪灯号尚未人工确认，当前为预览等级，不生成正式BUY候选',
    });
  }

  // 按优先级依次检查
  const c4 = condition4_MissingData(input);
  if (c4.triggered) violations.push(c4);

  const c3 = condition3_T1DataMissing(input);
  if (c3.triggered) violations.push(c3);

  const c5 = condition5_Suspension(input);
  if (c5.triggered) violations.push(c5);

  const c7 = condition7_L0(input);
  if (c7.triggered) violations.push(c7);

  const c6 = condition6_DailyRisk(input);
  if (c6.triggered) violations.push(c6);

  const c2 = condition2_NoStopPrice(input);
  if (c2.triggered) violations.push(c2);

  // 条件1需要数据完整才能计算
  let c1: ReturnType<typeof condition1_SingleRisk> | null = null;
  if (input.has_stop_price && input.has_total_capital && input.account_risk_input.buy_price > 0) {
    c1 = condition1_SingleRisk(input);
    if (c1.triggered) violations.push(c1);
  }

  const c8 = condition8_L1Approval(input);
  if (c8.triggered) violations.push(c8);

  // 计算风险和仓位（数据完整时）
  let accountRisk;
  try {
    accountRisk = calculateAccountRisk(input.account_risk_input);
  } catch {
    accountRisk = {
      stop_loss_pct: 0,
      estimated_max_loss: 0,
      account_risk_pct: 0,
      t1_adjusted_risk_pct: 0,
      risk_status: '危险' as const,
    };
  }

  let position;
  try {
    position = calculatePosition(input.position_input);
  } catch {
    position = {
      raw_max_position: 0,
      after_consecutive_loss: 0,
      after_level_coefficient: 0,
      final_max_position: 0,
      halved_by_losses: false,
    };
  }

  // 判断是否有纯硬拦截（不含可特批的条件8）
  const hardBlocked = violations.some(
    (v) => v.intercept_type === 'hard' || v.intercept_type === 'hard_no_exception',
  );
  const approvable = violations.some(
    (v) => v.intercept_type === 'approvable' && v.triggered,
  );

  return {
    passed: !hardBlocked && !approvable,
    blocked: hardBlocked,
    approvable: !hardBlocked && approvable,
    violations,
    account_risk: accountRisk,
    position,
    final_level: input.final_level,
  };
}
