import { NextResponse } from 'next/server';
import { getCurrentTheme, saveTheme, clearTodayTheme, type ThemeInput } from '@/lib/services/theme-service';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const theme = await getCurrentTheme();
    return NextResponse.json({ success: true, data: theme });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询主线失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ThemeInput;
    if (!body.theme_name?.trim()) {
      return NextResponse.json({ error: '主线名称必填' }, { status: 400 });
    }
    const result = await saveTheme(body);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存主线失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/theme
 * 清空今日主线评分
 */
export async function DELETE() {
  try {
    await clearTodayTheme();
    return NextResponse.json({ success: true, message: '主线评分已清空' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '清空主线数据失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
