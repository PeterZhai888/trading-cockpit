import { NextResponse } from 'next/server';
import { deleteTrade } from '@/lib/services/trade-service';

export const runtime = 'nodejs';

/**
 * DELETE /api/trades/[id]
 * 删除指定交易记录
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteTrade(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除交易记录失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}