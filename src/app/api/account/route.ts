import { NextResponse } from 'next/server';
import {
  getAccountConfig,
  updateAccountConfig,
  getSuspensionRemainingDays,
  resetConsecutiveLosses,
  resetAccountConfig,
} from '@/lib/services/account-service';

export const runtime = 'nodejs';

/**
 * GET /api/account
 * 获取账户配置
 */
export async function GET() {
  try {
    const [config, suspensionDays] = await Promise.all([
      getAccountConfig(),
      getSuspensionRemainingDays(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        suspension_remaining_days: suspensionDays,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询账户配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/account
 * 更新账户配置
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const allowedFields = [
      'total_capital',
      'single_trade_risk_pct',
      'daily_risk_limit_pct',
      'min_liquidity_amount',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '没有可更新的字段' },
        { status: 400 },
      );
    }

    const config = await updateAccountConfig(updates);
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新账户配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/account/reset-losses
 * 人工确认恢复交易（连续亏损计数归零）
 */
export async function POST() {
  try {
    await resetConsecutiveLosses();
    return NextResponse.json({ success: true, message: '连续亏损计数已重置' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '重置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/account
 * 清空账户配置，重置为默认值
 */
export async function DELETE() {
  try {
    const config = await resetAccountConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    const message = err instanceof Error ? err.message : '重置账户配置失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
