import type { TradingSession, TradingCheckResult } from './types';

/**
 * 交易制度校验模块
 * 实现规格书附录C
 */

/**
 * 判断是否为交易日（简化版：排除周末）
 * 节假日数据需接入交易日历API
 */
export function isTradingDay(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * 判断当前交易时段
 * 9:15-9:25  集合竞价
 * 9:30-11:30 上午盘
 * 13:00-15:00 下午盘
 * 14:57-15:00 收盘集合竞价（包含在下午盘中）
 */
export function getTradingSession(date: Date = new Date()): TradingSession {
  if (!isTradingDay(date)) return 'closed';

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const time = hours * 60 + minutes;

  if (time >= 9 * 60 + 15 && time < 9 * 60 + 25) return 'call_auction';
  if (time >= 9 * 60 + 30 && time < 11 * 60 + 30) return 'morning';
  if (time >= 11 * 60 + 30 && time < 13 * 60) return 'lunch_break';
  if (time >= 13 * 60 && time < 15 * 60) return 'afternoon';
  if (time < 9 * 60 + 15) return 'pre_market';
  return 'after_hours';
}

/**
 * 判断时段是否允许新开仓
 * 仅盘中（上午+下午，排除收盘集合竞价14:57-15:00）允许生成BUY候选
 */
export function canOpenInSession(session: TradingSession): boolean {
  return session === 'morning' || session === 'afternoon';
}

export interface TradingCheckInput {
  date?: Date;
  is_suspended: boolean;
  current_price: number;
  prev_close: number;
  limit_up_pct: number;   // 涨停幅度（主板10%）
  limit_down_pct: number; // 跌停幅度
  sellable_qty: number;   // 可卖数量（T+1后）
}

/**
 * 执行交易制度校验
 */
export function checkTradingRules(input: TradingCheckInput): TradingCheckResult {
  const date = input.date ?? new Date();
  const session = getTradingSession(date);
  const messages: string[] = [];

  const isTradingDayResult = isTradingDay(date);
  if (!isTradingDayResult) {
    messages.push('非交易日');
  }

  const canOpen = canOpenInSession(session);
  if (!canOpen && isTradingDayResult) {
    const sessionLabels: Record<string, string> = {
      pre_market: '盘前',
      call_auction: '集合竞价',
      lunch_break: '午间休市',
      closing_auction: '收盘集合竞价',
      after_hours: '盘后',
      closed: '休市',
    };
    messages.push(`当前${sessionLabels[session] ?? session}时段，不可新开仓`);
  }

  if (input.is_suspended) {
    messages.push('股票停牌中');
  }

  // 涨跌停判断
  const upperLimit = input.prev_close * (1 + input.limit_up_pct / 100);
  const lowerLimit = input.prev_close * (1 - input.limit_down_pct / 100);
  const isLimitUp = input.current_price >= upperLimit - 0.001;
  const isLimitDown = input.current_price <= lowerLimit + 0.001;

  // 一字板判断：开盘价=最高价=最低价=涨停价（简化为当前价等于涨停价）
  const isOneWordLimit = isLimitUp;

  if (isLimitUp) {
    messages.push('涨停价，不可买入');
  }
  if (isLimitDown) {
    messages.push('跌停价，不可卖出');
  }
  if (isOneWordLimit) {
    messages.push('一字涨停板，无法成交');
  }

  if (input.sellable_qty < 0) {
    messages.push('可卖数量异常');
  }

  return {
    is_trading_day: isTradingDayResult,
    session,
    can_open_position: canOpen && !input.is_suspended && !isLimitUp,
    is_suspended: input.is_suspended,
    is_limit_up: isLimitUp,
    is_limit_down: isLimitDown,
    is_one_word_limit: isOneWordLimit,
    sellable_qty: input.sellable_qty,
    messages,
  };
}

/**
 * 计算交易费用
 * 佣金（双向，默认万2.5，最低5元）+ 印花税（卖出千1）+ 过户费（双向十万分之1.5）
 */
export function calculateTradingFees(
  amount: number,
  side: 'buy' | 'sell',
  commissionRate = 0.00025,
): {
  commission: number;
  stamp_tax: number;
  transfer_fee: number;
  total: number;
} {
  const commission = Math.max(5, amount * commissionRate);
  const stampTax = side === 'sell' ? amount * 0.001 : 0;
  const transferFee = amount * 0.000015;
  return {
    commission,
    stamp_tax: stampTax,
    transfer_fee: transferFee,
    total: commission + stampTax + transferFee,
  };
}

/**
 * A股最小交易单位检查
 * 买入必须100股整数倍，卖出允许零股
 */
export function isValidBuyQty(qty: number): boolean {
  return qty > 0 && qty % 100 === 0;
}

/**
 * 交易时段中文标签
 */
export const SESSION_LABELS: Record<TradingSession, string> = {
  pre_market: '盘前',
  call_auction: '集合竞价',
  morning: '上午盘',
  lunch_break: '午间休市',
  afternoon: '下午盘',
  closing_auction: '收盘集合竞价',
  after_hours: '盘后',
  closed: '休市',
};
