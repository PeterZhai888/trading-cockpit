import { NextResponse, type NextRequest } from 'next/server';
import { listTrades } from '@/lib/services/trade-service';
import { computeTradeStats, type TradeStats } from '@/lib/engine/stats';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// GET /api/stats/overview
export async function GET(_req: NextRequest) {
  try {
    const trades = await listTrades(undefined, 500);
    const stats: TradeStats = computeTradeStats(trades);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : '统计失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
