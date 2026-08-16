import { type NextRequest, NextResponse } from 'next/server';
import { getAnalysisHistory, deleteAnalysisHistory, type AIAnalysisType } from '@/lib/ai/ai-service';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

function isAnalysisType(value: string | null): value is AIAnalysisType {
  return value === 'market' || value === 'stock' || value === 'review';
}

// GET /api/ai/history?analysis_type=market&limit=20&days=7
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get('analysis_type');
    const limit = Math.min(Number(sp.get('limit')) || 20, 100);
    const days = Number(sp.get('days')) || 0;
    const stockCode = sp.get('stock_code');

    let rows = await getAnalysisHistory(isAnalysisType(type) ? type : undefined, limit);

    if (stockCode) {
      rows = rows.filter((row) => {
        const snapshot = (row.input_snapshot ?? {}) as { stock?: { code?: string } };
        return row.stock_code === stockCode || snapshot.stock?.code === stockCode;
      });
    }

    if (days > 0) {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      rows = rows.filter((row) => (row.created_at ?? '') >= since);
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询AI分析历史失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/ai/history?id=xxx  — 删除单条，不传 id 则清空全部
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    await deleteAnalysisHistory(id ?? undefined);
    return NextResponse.json({
      success: true,
      message: id ? '分析记录已删除' : '所有分析记录已清空',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除分析记录失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
