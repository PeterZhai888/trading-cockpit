/**
 * 交易统计引擎（第四阶段）
 *
 * 基于已平仓交易计算：
 * - 总交易数 / 胜率 / 平均盈亏 / 盈亏比
 * - 连续亏损/连胜
 * - 按交易模式、主线、等级、违规维度统计
 * - 月度收益统计
 * - 最大回撤
 *
 * 规格书第 9.10："连续亏损按已完成交易结果统计，不是单次卖出"
 */

import type { TradeRecord } from '../engine/types';

export interface OverviewStats {
  total: number;
  wins: number;
  losses: number;
  scratch: number; // 平盘（|pnl| < 手续费门槛）
  win_rate: number; // 0-1
  total_pnl: number;
  avg_pnl: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number; // 总盈利 / 总亏损绝对值
  expectancy: number; // 期望收益 = winRate * avgWin - (1-winRate) * |avgLoss|
  max_win: number;
  max_loss: number;
  violation_count: number;
  violation_win_count: number;
  violation_loss_count: number;
  current_consecutive_losses: number;
  current_consecutive_wins: number;
  max_consecutive_losses: number;
  max_consecutive_wins: number;
}

export interface ModeStat {
  mode: string;
  count: number;
  wins: number;
  win_rate: number;
  total_pnl: number;
  avg_pnl: number;
}

export interface ThemeStat {
  theme: string;
  count: number;
  wins: number;
  win_rate: number;
  total_pnl: number;
}

export interface LevelStat {
  level: string;
  count: number;
  wins: number;
  win_rate: number;
  total_pnl: number;
}

export interface MonthlyStat {
  month: string; // YYYY-MM
  count: number;
  wins: number;
  pnl: number;
}

export interface DrawdownPoint {
  date: string;
  equity: number;
  drawdown: number; // 回撤金额
  drawdown_pct: number; // 0-1
}

export interface TradeStats {
  overview: OverviewStats;
  by_mode: ModeStat[];
  by_theme: ThemeStat[];
  by_level: LevelStat[];
  monthly: MonthlyStat[];
  equity_curve: Array<{ date: string; equity: number }>;
  drawdown: {
    max_drawdown: number;
    max_drawdown_pct: number;
    peak: number;
    trough: number;
    points: DrawdownPoint[];
  };
  recent: TradeRecord[];
}

const SCRATCH_THRESHOLD = 5; // |盈亏| < 5 元视为平盘

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pnlOf(t: TradeRecord): number {
  return safeNumber(t.profit_loss);
}

function sellTimeOf(t: TradeRecord): number {
  const d = t.sell_time ? new Date(t.sell_time).getTime() : NaN;
  return Number.isFinite(d) ? d : new Date(t.buy_time).getTime();
}

export function computeTradeStats(allTrades: TradeRecord[]): TradeStats {
  // 仅统计已平仓
  const closed = allTrades
    .filter((t) => t.status === 'closed')
    .slice()
    .sort((a, b) => sellTimeOf(a) - sellTimeOf(b));

  const total = closed.length;
  const wins = closed.filter((t) => pnlOf(t) > SCRATCH_THRESHOLD);
  const losses = closed.filter((t) => pnlOf(t) < -SCRATCH_THRESHOLD);
  const scratch = total - wins.length - losses.length;

  const totalPnl = closed.reduce((s, t) => s + pnlOf(t), 0);
  const grossProfit = wins.reduce((s, t) => s + pnlOf(t), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + pnlOf(t), 0));
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  const winRate = total ? wins.length / total : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;
  const expectancy = total ? totalPnl / total : 0;

  // 连续统计（按时间倒序：当前→历史）
  let curWin = 0;
  let curLoss = 0;
  let maxWin = 0;
  let maxLoss = 0;
  // 从最近往回数当前连胜/连败
  for (let i = closed.length - 1; i >= 0; i--) {
    const v = pnlOf(closed[i]);
    if (curLoss === 0 && v > SCRATCH_THRESHOLD) curWin++;
    else if (curWin === 0 && v < -SCRATCH_THRESHOLD) curLoss++;
    else if (v > SCRATCH_THRESHOLD || v < -SCRATCH_THRESHOLD) break;
  }
  // 历史最大连胜/连败
  let runWin = 0;
  let runLoss = 0;
  for (const t of closed) {
    const v = pnlOf(t);
    if (v > SCRATCH_THRESHOLD) {
      runWin++;
      runLoss = 0;
      maxWin = Math.max(maxWin, runWin);
    } else if (v < -SCRATCH_THRESHOLD) {
      runLoss++;
      runWin = 0;
      maxLoss = Math.max(maxLoss, runLoss);
    }
  }

  // 违规统计
  const violations = closed.filter((t) => t.is_violation);
  const violationWins = violations.filter((t) => pnlOf(t) > SCRATCH_THRESHOLD);
  const violationLosses = violations.filter((t) => pnlOf(t) < -SCRATCH_THRESHOLD);

  // 按模式
  const byModeMap = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const t of closed) {
    const key = t.trade_mode || '未记录';
    const cur = byModeMap.get(key) ?? { count: 0, wins: 0, pnl: 0 };
    cur.count++;
    if (pnlOf(t) > SCRATCH_THRESHOLD) cur.wins++;
    cur.pnl += pnlOf(t);
    byModeMap.set(key, cur);
  }
  const by_mode: ModeStat[] = Array.from(byModeMap.entries()).map(([mode, v]) => ({
    mode,
    count: v.count,
    wins: v.wins,
    win_rate: v.count ? v.wins / v.count : 0,
    total_pnl: v.pnl,
    avg_pnl: v.count ? v.pnl / v.count : 0,
  }));

  // 按主线
  const byThemeMap = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const t of closed) {
    const key = t.theme || '未记录';
    const cur = byThemeMap.get(key) ?? { count: 0, wins: 0, pnl: 0 };
    cur.count++;
    if (pnlOf(t) > SCRATCH_THRESHOLD) cur.wins++;
    cur.pnl += pnlOf(t);
    byThemeMap.set(key, cur);
  }
  const by_theme: ThemeStat[] = Array.from(byThemeMap.entries())
    .map(([theme, v]) => ({
      theme,
      count: v.count,
      wins: v.wins,
      win_rate: v.count ? v.wins / v.count : 0,
      total_pnl: v.pnl,
    }))
    .sort((a, b) => b.total_pnl - a.total_pnl);

  // 按等级
  const byLevelMap = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const t of closed) {
    const key = t.final_level || '未记录';
    const cur = byLevelMap.get(key) ?? { count: 0, wins: 0, pnl: 0 };
    cur.count++;
    if (pnlOf(t) > SCRATCH_THRESHOLD) cur.wins++;
    cur.pnl += pnlOf(t);
    byLevelMap.set(key, cur);
  }
  const by_level: LevelStat[] = Array.from(byLevelMap.entries()).map(([level, v]) => ({
    level,
    count: v.count,
    wins: v.wins,
    win_rate: v.count ? v.wins / v.count : 0,
    total_pnl: v.pnl,
  }));

  // 月度
  const monthlyMap = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const t of closed) {
    const d = new Date(sellTimeOf(t));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = monthlyMap.get(key) ?? { count: 0, wins: 0, pnl: 0 };
    cur.count++;
    if (pnlOf(t) > SCRATCH_THRESHOLD) cur.wins++;
    cur.pnl += pnlOf(t);
    monthlyMap.set(key, cur);
  }
  const monthly: MonthlyStat[] = Array.from(monthlyMap.entries())
    .map(([month, v]) => ({ month, count: v.count, wins: v.wins, pnl: v.pnl }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 权益曲线 & 最大回撤
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  let maxDDPct = 0;
  let trough = 0;
  const equityCurve: Array<{ date: string; equity: number }> = [];
  const ddPoints: DrawdownPoint[] = [];
  for (const t of closed) {
    equity += pnlOf(t);
    if (equity > peak) peak = equity;
    const dd = equity - peak; // <= 0
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd < maxDD) {
      maxDD = dd;
      maxDDPct = ddPct;
      trough = equity;
    }
    const d = new Date(sellTimeOf(t)).toISOString().slice(0, 10);
    equityCurve.push({ date: d, equity });
    ddPoints.push({ date: d, equity, drawdown: dd, drawdown_pct: ddPct });
  }

  return {
    overview: {
      total,
      wins: wins.length,
      losses: losses.length,
      scratch,
      win_rate: winRate,
      total_pnl: totalPnl,
      avg_pnl: expectancy,
      avg_win: avgWin,
      avg_loss: avgLoss,
      profit_factor: profitFactor,
      expectancy,
      max_win: wins.length ? Math.max(...wins.map(pnlOf)) : 0,
      max_loss: losses.length ? Math.min(...losses.map(pnlOf)) : 0,
      violation_count: violations.length,
      violation_win_count: violationWins.length,
      violation_loss_count: violationLosses.length,
      current_consecutive_losses: curLoss,
      current_consecutive_wins: curWin,
      max_consecutive_losses: maxLoss,
      max_consecutive_wins: maxWin,
    },
    by_mode,
    by_theme,
    by_level,
    monthly,
    equity_curve: equityCurve,
    drawdown: {
      max_drawdown: maxDD,
      max_drawdown_pct: maxDDPct,
      peak,
      trough,
      points: ddPoints,
    },
    recent: closed.slice(-10).reverse(),
  };
}
