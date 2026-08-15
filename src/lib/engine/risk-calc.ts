import type {
  AccountRiskInput,
  AccountRiskResult,
  PositionCalcInput,
  PositionCalcResult,
} from './types';

/**
 * 账户风险计算模块
 * 实现规格书4.1节
 */

/**
 * 计算账户风险
 *
 * 止损幅度 = |买入价格 - 止损价格| ÷ 买入价格
 * 预计最大亏损 = 持仓金额 × 止损幅度
 * 账户风险比例 = 预计最大亏损 ÷ 账户总资金
 * T+1调整后风险 = 预计最大亏损 × 1.2 ÷ 账户总资金（仅UI提示）
 */
export function calculateAccountRisk(input: AccountRiskInput): AccountRiskResult {
  const { total_capital, plan_buy_amount, buy_price, stop_price } = input;

  if (buy_price <= 0) {
    throw new Error('买入价格必须大于0');
  }
  if (total_capital <= 0) {
    throw new Error('账户总资金必须大于0');
  }

  const stopLossPct = Math.abs(buy_price - stop_price) / buy_price;
  const estimatedMaxLoss = plan_buy_amount * stopLossPct;
  const accountRiskPct = estimatedMaxLoss / total_capital;
  const t1AdjustedRiskPct = (estimatedMaxLoss * 1.2) / total_capital;

  let riskStatus: AccountRiskResult['risk_status'] = '正常';
  if (accountRiskPct >= 0.02) {
    riskStatus = '危险';
  } else if (accountRiskPct >= 0.01) {
    riskStatus = '警告';
  }

  return {
    stop_loss_pct: stopLossPct,
    estimated_max_loss: estimatedMaxLoss,
    account_risk_pct: accountRiskPct,
    t1_adjusted_risk_pct: t1AdjustedRiskPct,
    risk_status: riskStatus,
  };
}

/**
 * 仓位计算模块
 * 实现规格书4.2节
 *
 * 最大仓位金额 = 账户资金 × 单笔风险 ÷ 止损幅度
 * 连续3笔亏损：仓位上限 × 50%
 * 等级仓位系数：L3=100%, L2=70%, L1=40%, L0=0%
 */
export function calculatePosition(input: PositionCalcInput): PositionCalcResult {
  const {
    total_capital,
    single_risk_pct,
    stop_loss_pct,
    consecutive_losses,
    position_coefficient,
  } = input;

  if (stop_loss_pct <= 0) {
    return {
      raw_max_position: 0,
      after_consecutive_loss: 0,
      after_level_coefficient: 0,
      final_max_position: 0,
      halved_by_losses: consecutive_losses >= 3,
    };
  }

  const rawMax = (total_capital * single_risk_pct) / stop_loss_pct;

  const halvedByLosses = consecutive_losses >= 3;
  const afterLoss = halvedByLosses ? rawMax * 0.5 : rawMax;
  const afterCoefficient = afterLoss * position_coefficient;

  return {
    raw_max_position: rawMax,
    after_consecutive_loss: afterLoss,
    after_level_coefficient: afterCoefficient,
    final_max_position: Math.min(afterCoefficient, total_capital),
    halved_by_losses: halvedByLosses,
  };
}

/**
 * 计算加仓后的加权平均成本
 *
 * avg_cost = (原持仓数量×原成本 + 加仓数量×加仓价格) ÷ (原持仓数量 + 加仓数量)
 */
export function calculateAvgCost(
  currentQty: number,
  currentCost: number,
  addQty: number,
  addPrice: number,
): number {
  const totalQty = currentQty + addQty;
  if (totalQty === 0) return 0;
  return (currentQty * currentCost + addQty * addPrice) / totalQty;
}

/**
 * 格式化百分比显示
 */
export function formatPct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * 格式化金额显示（元）
 */
export function formatCurrency(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
