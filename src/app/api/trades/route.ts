import { NextResponse } from 'next/server';
import {
  createTrade,
  listTrades,
  addPosition,
  reducePosition,
  updateStopPrice,
  clearTradesByStatus,
} from '@/lib/services/trade-service';
import { addDailyRisk } from '@/lib/services/risk-service';
import { getAccountConfig } from '@/lib/services/account-service';
import { calculateAccountRisk } from '@/lib/engine/risk-calc';
import type { TradeMode, FinalLevel, StockRole } from '@/lib/engine/types';

export const runtime = 'nodejs';

interface CreateTradeBody {
  stock_code: string;
  stock_name?: string;
  buy_price: number;
  position: number;
  stop_price?: number;
  trade_mode?: TradeMode;
  theme?: string;
  market_env?: string;
  emotion_cycle?: string;
  emotion_light?: string;
  final_level?: FinalLevel;
  buy_reason?: string;
  buy_position_note?: string;
  risk_note?: string;
  exit_plan?: string;
  is_violation?: boolean;
  violation_reason?: string;
  stock_role?: StockRole;
}

/**
 * GET /api/trades
 * 查询交易列表，可按status过滤
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'open' | 'closed' | 'paused' | null;
    const limit = Number(searchParams.get('limit') ?? '100');

    const trades = await listTrades(status ?? undefined, limit);
    return NextResponse.json({ success: true, data: trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询交易列表失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/trades
 * 创建新交易记录
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateTradeBody;

    if (!body.stock_code || !body.buy_price || !body.position) {
      return NextResponse.json(
        { error: '缺少必填参数：stock_code, buy_price, position' },
        { status: 400 },
      );
    }

    // 计算风险并累加到当日风险
    if (body.stop_price) {
      const config = await getAccountConfig();
      const risk = calculateAccountRisk({
        total_capital: config.total_capital,
        current_position_amount: 0,
        plan_buy_amount: body.buy_price * body.position,
        buy_price: body.buy_price,
        stop_price: body.stop_price,
      });
      await addDailyRisk(risk.estimated_max_loss, config.total_capital);
    }

    const trade = await createTrade(body);
    return NextResponse.json({ success: true, data: trade }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建交易失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/trades
 * 加仓/减仓/更新止损价
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      action: 'add' | 'reduce' | 'update_stop';
      trade_id: string;
      price?: number;
      qty?: number;
      reason?: string;
      stop_price?: number;
    };

    if (!body.trade_id || !body.action) {
      return NextResponse.json(
        { error: '缺少必填参数：trade_id, action' },
        { status: 400 },
      );
    }

    let result;
    switch (body.action) {
      case 'add':
        if (!body.price || !body.qty) {
          return NextResponse.json(
            { error: '加仓需要 price 和 qty 参数' },
            { status: 400 },
          );
        }
        result = await addPosition({
          trade_id: body.trade_id,
          price: body.price,
          qty: body.qty,
        });
        break;

      case 'reduce':
        if (!body.price || !body.qty || !body.reason) {
          return NextResponse.json(
            { error: '减仓需要 price、qty 和 reason 参数' },
            { status: 400 },
          );
        }
        result = await reducePosition({
          trade_id: body.trade_id,
          price: body.price,
          qty: body.qty,
          reason: body.reason,
        });
        break;

      case 'update_stop':
        if (!body.stop_price || !body.reason) {
          return NextResponse.json(
            { error: '更新止损价需要 stop_price 和 reason 参数' },
            { status: 400 },
          );
        }
        result = await updateStopPrice(
          body.trade_id,
          body.stop_price,
          body.reason,
        );
        break;

      default:
        return NextResponse.json(
          { error: `不支持的操作：${body.action}` },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '操作失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/trades?type=open 或 ?type=closed
 * 批量清空持仓记录
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'open' | 'closed' | null;
    if (!type || !['open', 'closed'].includes(type)) {
      return NextResponse.json(
        { error: '参数 type 必填，取值 open 或 closed' },
        { status: 400 },
      );
    }
    const count = await clearTradesByStatus(type);
    return NextResponse.json({ success: true, data: { deleted: count } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '清空交易记录失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
