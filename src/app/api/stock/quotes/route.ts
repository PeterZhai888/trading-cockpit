import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codes = searchParams.get('codes') || '';
    if (!codes) {
      return NextResponse.json({ success: false, error: '缺少 codes 参数' }, { status: 400 });
    }

    const codeList = codes.split(',').map(c => c.trim()).filter(Boolean);
    if (codeList.length === 0) {
      return NextResponse.json({ success: false, error: 'codes 参数为空' }, { status: 400 });
    }

    // Build secids: 沪市 1.xxx, 深市 0.xxx
    const secids = codeList.map(code => {
      if (code.startsWith('6') || code.startsWith('9')) return `1.${code}`;
      return `0.${code}`;
    }).join(',');

    const url = `https://push2delay.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f6,f8,f10,f12,f14&secids=${secids}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ success: false, error: '行情接口异常' }, { status: 502 });
    }

    const raw = await response.text();
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        json = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ success: false, error: '行情数据解析失败' }, { status: 502 });
      }
    }

    const dataList = json?.data?.diff || [];
    const map: Record<string, { price: number; changePct: number; volumeRatio: number | null; turnoverRate: number | null; amount: number | null }> = {};

    for (const item of dataList) {
      const code = String(item.f12 || '');
      map[code] = {
        price: item.f2 ?? 0,
        changePct: item.f3 ?? 0,
        volumeRatio: item.f10 ?? null,
        turnoverRate: item.f8 ?? null,
        amount: item.f6 ?? null,
      };
    }

    return NextResponse.json({ success: true, data: map });
  } catch (error) {
    console.error('获取行情失败:', error);
    return NextResponse.json({ success: false, error: '获取行情失败' }, { status: 500 });
  }
}