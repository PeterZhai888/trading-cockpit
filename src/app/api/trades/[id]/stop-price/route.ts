import { NextResponse } from 'next/server';
import { updateStopPrice } from '@/lib/services/trade-service';

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

    if (body.stop_price == null || !body.reason) {
      return NextResponse.json(
        { error: '缺少 stop_price 或 reason 参数' },
        { status: 400 },
      );
    }

    const trade = await updateStopPrice(
      id,
      Number(body.stop_price),
      String(body.reason),
    );

    return NextResponse.json({ success: true, data: trade }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新止损价失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
