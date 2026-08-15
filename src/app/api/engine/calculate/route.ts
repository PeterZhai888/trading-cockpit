import { NextResponse } from 'next/server';
import { calculateAccountRisk, calculatePosition, calculateAvgCost } from '@/lib/engine/risk-calc';
import { calculateMarketEnvironment } from '@/lib/engine/market-env';
import { calculateEmotion } from '@/lib/engine/emotion';
import { reconcileLevel } from '@/lib/engine/state-reconcile';
import { calculateThemeScore } from '@/lib/engine/theme-score';
import { calculateLeaderScore } from '@/lib/engine/leader-score';
import { filterStock } from '@/lib/engine/stock-filter';
import { checkTradingRules } from '@/lib/engine/trading-validator';
import { calculateDataQuality } from '@/lib/engine/data-manager';
import type {
  EmotionLight,
  TradeMode,
} from '@/lib/engine/types';
import type { MarketRawData } from '@/lib/engine/market-env';

export const runtime = 'nodejs';

/**
 * POST /api/engine/calculate
 * 统一规则计算入口，支持多种计算类型
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body;

    switch (type) {
      case 'account_risk': {
        const result = calculateAccountRisk({
          total_capital: body.total_capital,
          current_position_amount: body.current_position_amount ?? 0,
          plan_buy_amount: body.plan_buy_amount,
          buy_price: body.buy_price,
          stop_price: body.stop_price,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'position': {
        const result = calculatePosition({
          total_capital: body.total_capital,
          single_risk_pct: body.single_risk_pct,
          stop_loss_pct: body.stop_loss_pct,
          consecutive_losses: body.consecutive_losses ?? 0,
          position_coefficient: body.position_coefficient ?? 1,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'avg_cost': {
        const result = calculateAvgCost(
          body.current_qty,
          body.current_cost,
          body.add_qty,
          body.add_price,
        );
        return NextResponse.json({ success: true, data: { avg_cost: result } });
      }

      case 'market_env': {
        const rawData: MarketRawData = body.raw_data;
        const result = calculateMarketEnvironment(rawData);
        return NextResponse.json({ success: true, data: result });
      }

      case 'emotion': {
        const rawData: MarketRawData = body.raw_data;
        // 先算环境（C级直接红灯，A级绿灯），再算情绪
        const envResult = calculateMarketEnvironment(rawData);
        const result = calculateEmotion(rawData, envResult.environment);
        return NextResponse.json({ success: true, data: result });
      }

      case 'reconcile': {
        const result = reconcileLevel(
          body.environment,
          (body.confirmed_light as EmotionLight | null) ?? null,
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'theme_score': {
        const result = calculateThemeScore(body.input);
        return NextResponse.json({ success: true, data: result });
      }

      case 'leader_score': {
        const result = calculateLeaderScore(body.input);
        return NextResponse.json({ success: true, data: result });
      }

      case 'stock_filter': {
        const result = filterStock(body.input);
        return NextResponse.json({ success: true, data: result });
      }

      case 'trading_check': {
        const result = checkTradingRules({
          date: body.date ? new Date(body.date) : undefined,
          is_suspended: body.is_suspended,
          current_price: body.current_price,
          prev_close: body.prev_close,
          limit_up_pct: body.limit_up_pct ?? 10,
          limit_down_pct: body.limit_down_pct ?? 10,
          sellable_qty: body.sellable_qty,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'data_quality': {
        const result = calculateDataQuality({
          completeness: body.completeness,
          last_fetch_minutes_ago: body.last_fetch_minutes_ago,
          expected_freshness_minutes: body.expected_freshness_minutes,
          source_reliability: body.source_reliability,
        });
        return NextResponse.json({ success: true, data: result });
      }

      default:
        return NextResponse.json(
          { error: `不支持的计算类型：${type}` },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '计算失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
