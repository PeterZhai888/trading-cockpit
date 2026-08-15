import { NextResponse } from 'next/server';
import {
  getTodayMarketStatus,
  saveMarketRawData,
  confirmEmotionLight,
  clearTodayMarketStatus,
} from '@/lib/services/market-service';
import type { MarketRawData, EmotionLight } from '@/lib/engine/types';

export const runtime = 'nodejs';

/**
 * GET /api/market/status
 * 获取今日市场状态
 */
export async function GET() {
  try {
    const status = await getTodayMarketStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询市场状态失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/market/raw-data
 * 录入市场原始数据，自动计算市场环境和情绪
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MarketRawData & {
      confirmed_light?: EmotionLight | null;
    };

    const up = body.up_count ?? 0;
    const down = body.down_count ?? 0;
    const limitUp = body.limit_up_count ?? 0;
    const limitDown = body.limit_down_count ?? 0;
    const broken = body.broken_limit_count ?? 0;
    // 炸板率兜底：若前端未传或为 0，但炸板数 > 0，按同花顺口径自动计算
    // 公式 = 炸板数 / (涨停数 + 炸板数) × 100%
    let brokenRate = body.broken_limit_rate ?? 0;
    if ((!brokenRate || brokenRate <= 0) && broken > 0) {
      brokenRate = Number(((broken / (limitUp + broken)) * 100).toFixed(2));
    }
    const rawData: MarketRawData = {
      up_count: up,
      down_count: down,
      limit_up_count: limitUp,
      limit_down_count: limitDown,
      broken_limit_count: broken,
      broken_limit_rate: brokenRate,
      max_consecutive_boards: body.max_consecutive_boards ?? 0,
      total_turnover: body.total_turnover ?? 0,
    };

    const result = await saveMarketRawData(rawData, body.confirmed_light ?? null);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存市场数据失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/market/confirm-light
 * 人工确认情绪灯号
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { light: EmotionLight };
    if (!body.light || !['green', 'yellow', 'orange', 'red'].includes(body.light)) {
      return NextResponse.json(
        { error: '灯号值无效，必须是 green/yellow/orange/red' },
        { status: 400 },
      );
    }

    const result = await confirmEmotionLight(body.light);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '确认灯号失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/market/status
 * 清空今日市场数据
 */
export async function DELETE() {
  try {
    await clearTodayMarketStatus();
    return NextResponse.json({ success: true, message: '市场数据已清空' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '清空市场数据失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
