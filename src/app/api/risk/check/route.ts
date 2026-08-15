import { NextResponse } from 'next/server';
import { checkRiskInterception } from '@/lib/engine/risk-interceptor';
import { getAccountConfig, getSuspensionRemainingDays } from '@/lib/services/account-service';
import { getTodayMarketStatus } from '@/lib/services/market-service';
import { getTodayRisk } from '@/lib/services/risk-service';
import { getConsecutiveLosses } from '@/lib/services/trade-service';
import { getLevelParams } from '@/lib/engine/state-reconcile';

export const runtime = 'nodejs';

interface RiskCheckRequestBody {
  stock_code: string;
  buy_price: number;
  stop_price: number;
  plan_buy_amount: number;
  has_approval_reason?: boolean;
  has_sellable_qty?: boolean;
  has_holding_time?: boolean;
}

/**
 * POST /api/risk/check
 * 执行8条风险拦截检查
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RiskCheckRequestBody;

    if (!body.stock_code || !body.buy_price || !body.stop_price) {
      return NextResponse.json(
        { error: '缺少必填参数：stock_code, buy_price, stop_price' },
        { status: 400 },
      );
    }

    const [accountConfig, marketStatus, dailyRisk, suspensionDays, consecutiveLosses] =
      await Promise.all([
        getAccountConfig(),
        getTodayMarketStatus(),
        getTodayRisk(),
        getSuspensionRemainingDays(),
        getConsecutiveLosses(),
      ]);

    const finalLevel = marketStatus?.final_level ?? 'L1';
    const levelParams = getLevelParams(finalLevel);
    const isPreview = marketStatus?.is_preview ?? true;

    const result = checkRiskInterception({
      has_current_price: body.buy_price > 0,
      has_total_capital: accountConfig.total_capital > 0,
      has_stop_price: body.stop_price > 0,
      has_sellable_qty: body.has_sellable_qty ?? true,
      has_holding_time: body.has_holding_time ?? true,
      account_risk_input: {
        total_capital: accountConfig.total_capital,
        current_position_amount: 0,
        plan_buy_amount: body.plan_buy_amount,
        buy_price: body.buy_price,
        stop_price: body.stop_price,
      },
      consecutive_losses: consecutiveLosses,
      suspension_remaining_days: suspensionDays,
      final_level: finalLevel,
      is_preview: isPreview,
      daily_risk_pct: dailyRisk.total_risk_pct,
      position_input: {
        total_capital: accountConfig.total_capital,
        single_risk_pct: accountConfig.single_trade_risk_pct,
        stop_loss_pct: Math.abs(body.buy_price - body.stop_price) / body.buy_price,
        consecutive_losses: consecutiveLosses,
        position_coefficient: levelParams.position_coefficient,
      },
      has_approval_reason: body.has_approval_reason ?? false,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '风险检查失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
