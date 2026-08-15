import { NextResponse } from 'next/server';
import { confirmEmotionLight } from '@/lib/services/market-service';
import type { EmotionLight } from '@/lib/engine/types';

export const runtime = 'nodejs';

const VALID_LIGHTS: EmotionLight[] = ['green', 'yellow', 'orange', 'red'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stock_code, confirmed, light } = body as {
      stock_code?: string;
      confirmed?: boolean;
      light?: string;
    };

    // stock_code is reserved for future per-stock confirmation;
    // current spec confirms the global market light for the day.
    void stock_code;

    if (confirmed === false) {
      // 撤回确认：将 confirmed 置空
      const updated = await confirmEmotionLight(null);
      return NextResponse.json({ success: true, data: updated });
    }

    if (!light || !VALID_LIGHTS.includes(light as EmotionLight)) {
      return NextResponse.json(
        { error: `light 必须为 ${VALID_LIGHTS.join('/')} 之一` },
        { status: 400 },
      );
    }

    const updated = await confirmEmotionLight(light as EmotionLight);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : '确认灯号失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
