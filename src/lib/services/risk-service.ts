import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface DailyRiskRecord {
  date: string;
  total_risk_amount: number;
  total_risk_pct: number;
  trade_count: number;
}

/**
 * 获取今日风险记录
 */
export async function getTodayRisk(): Promise<DailyRiskRecord> {
  const client = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('daily_risk')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  if (error) throw new Error(`查询每日风险失败: ${error.message}`);

  if (!data) {
    return {
      date: today,
      total_risk_amount: 0,
      total_risk_pct: 0,
      trade_count: 0,
    };
  }

  return {
    date: String(data.date),
    total_risk_amount: Number(data.total_risk_amount),
    total_risk_pct: Number(data.total_risk_pct),
    trade_count: Number(data.trade_count),
  };
}

/**
 * 累加今日风险（新开仓时调用）
 */
export async function addDailyRisk(
  riskAmount: number,
  totalCapital: number,
): Promise<DailyRiskRecord> {
  const client = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const current = await getTodayRisk();

  const newAmount = current.total_risk_amount + riskAmount;
  const newPct = totalCapital > 0 ? newAmount / totalCapital : 0;
  const newCount = current.trade_count + 1;

  const record = {
    date: today,
    total_risk_amount: newAmount,
    total_risk_pct: newPct,
    trade_count: newCount,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('daily_risk')
    .upsert(record, { onConflict: 'date' })
    .select()
    .single();

  if (error) throw new Error(`更新每日风险失败: ${error.message}`);

  return {
    date: String(data.date),
    total_risk_amount: Number(data.total_risk_amount),
    total_risk_pct: Number(data.total_risk_pct),
    trade_count: Number(data.trade_count),
  };
}
