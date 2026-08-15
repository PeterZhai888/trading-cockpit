import { NextResponse } from 'next/server';
import { fetchMarketFromEastMoney } from '@/lib/services/market-fetcher';

export const runtime = 'nodejs';

/**
 * POST /api/market/fetch
 * 实时从东方财富抓取市场原始数据。
 *
 * 注意：本接口"只抓取不落库"。前端拿到数据后填入表单，
 * 用户确认后再调用 POST /api/market/status 落库并触发计算。
 *
 * Body（可选）:
 *  - date?: 'YYYYMMDD'，不传 = 今天（东八区）
 *  - save?: boolean，true 时直接落库（懒人模式，不推荐在盘中用）
 */
export async function POST(request: Request) {
  let date: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      date?: string;
    };
    if (body.date && /^\d{8}$/.test(body.date)) {
      date = body.date;
    }
  } catch {
    // ignore
  }

  try {
    const data = await fetchMarketFromEastMoney({ date });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '抓取市场数据失败';
    return NextResponse.json(
      {
        success: false,
        error: message,
        hint: '东财接口可能被限流或网络异常，请稍后重试；也可在表单中手工录入。',
      },
      { status: 502 },
    );
  }
}
