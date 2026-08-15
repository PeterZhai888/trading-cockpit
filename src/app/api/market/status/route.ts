import { NextResponse } from 'next/server';
import {
  getTodayMarketStatus,
  saveMarketRawData,
  confirmEmotionLight,
} from '@/lib/services/market-service';
import type { EmotionLight } from '@/lib/engine/types';
import type { MarketRawData } from '@/lib/engine/market-env';

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

    const rawData: MarketRawData = {
      up_count: body.up_count ?? 0,
      down_count: body.down_count ?? 0,
      limit_up_count: body.limit_up_count ?? 0,
      limit_down_count: body.limit_down_count ?? 0,
      broken_limit_count: body.broken_limit_count ?? 0,
      broken_limit_rate: body.broken_limit_rate ?? 0,
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
