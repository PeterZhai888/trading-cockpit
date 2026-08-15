import { NextResponse } from 'next/server';
import { reducePosition } from '@/lib/services/trade-service';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (body.price == null || body.qty == null || !body.reason) {
      return NextResponse.json(
        { error: '缺少 price、qty 或 reason 参数' },
        { status: 400 },
      );
    }

    const trade = await reducePosition({
      trade_id: id,
      price: Number(body.price),
      qty: Number(body.qty),
      reason: String(body.reason),
    });

    return NextResponse.json({ success: true, data: trade }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '减仓失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
