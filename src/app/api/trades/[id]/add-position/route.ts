import { NextResponse } from 'next/server';
import { addPosition } from '@/lib/services/trade-service';

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

    if (body.price == null || body.qty == null) {
      return NextResponse.json(
        { error: '缺少 price 或 qty 参数' },
        { status: 400 },
      );
    }

    const trade = await addPosition({
      trade_id: id,
      price: Number(body.price),
      qty: Number(body.qty),
    });

    return NextResponse.json({ success: true, data: trade }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '加仓失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
