import type { StockFilterStatus } from './types';

/**
 * 股票过滤模块
 * 实现规格书附录B
 *
 * 自动排除：
 * - 非沪深主板（创业板300/301、科创板688、北交所8/4开头）
 * - ST / *ST
 * - 退市整理期
 * - 停牌
 * - 流动性异常（近5日日均成交额低于阈值）
 */

export interface StockFilterInput {
  code: string;
  name: string;
  market: string;
  is_suspended?: boolean;
  is_delisting?: boolean;
  avg_turnover_5d?: number; // 近5日日均成交额（元）
  min_liquidity?: number;   // 最低流动性阈值（元），默认5000万
}

/**
 * 判断股票代码是否属于沪深主板
 *
 * 沪市主板：600/601/603/605开头
 * 深市主板：000/001开头
 * 创业板：300/301
 * 科创板：688
 * 北交所：8/4开头
 */
export function isMainBoard(code: string): boolean {
  return /^(600|601|603|605|000|001)\d{3}$/.test(code);
}

/**
 * 判断是否为ST股票
 */
export function isSTStock(name: string): boolean {
  return /^\*?ST/.test(name) || name.includes('ST');
}

/**
 * 执行股票过滤，返回排除原因
 */
export function filterStock(input: StockFilterInput): {
  status: StockFilterStatus;
  excluded: boolean;
  reason: string;
} {
  const minLiquidity = input.min_liquidity ?? 50000000;

  if (!isMainBoard(input.code)) {
    return {
      status: 'excluded_non_mainboard',
      excluded: true,
      reason: '非沪深主板股票',
    };
  }

  if (isSTStock(input.name)) {
    return {
      status: 'excluded_st',
      excluded: true,
      reason: 'ST/*ST股票',
    };
  }

  if (input.is_delisting) {
    return {
      status: 'excluded_delisting',
      excluded: true,
      reason: '退市整理期股票',
    };
  }

  if (input.is_suspended) {
    return {
      status: 'excluded_suspended',
      excluded: true,
      reason: '停牌股票',
    };
  }

  if (
    input.avg_turnover_5d !== undefined &&
    input.avg_turnover_5d < minLiquidity
  ) {
    return {
      status: 'excluded_liquidity',
      excluded: true,
      reason: `近5日日均成交额${(input.avg_turnover_5d / 100000000).toFixed(2)}亿低于${(minLiquidity / 100000000).toFixed(0)}亿`,
    };
  }

  return {
    status: 'normal',
    excluded: false,
    reason: '通过过滤',
  };
}

/**
 * 批量过滤股票
 */
export function filterStocks(
  stocks: StockFilterInput[],
  minLiquidity?: number,
): Array<StockFilterInput & { status: StockFilterStatus; excluded: boolean; reason: string }> {
  return stocks.map((s) => ({
    ...s,
    ...filterStock({ ...s, min_liquidity: minLiquidity }),
  }));
}

/**
 * 获取股票状态中文标签
 */
export const STOCK_STATUS_LABELS: Record<StockFilterStatus, string> = {
  normal: '正常',
  excluded_st: 'ST排除',
  excluded_delisting: '退市排除',
  excluded_suspended: '停牌排除',
  excluded_non_mainboard: '非主板排除',
  excluded_liquidity: '流动性排除',
};
