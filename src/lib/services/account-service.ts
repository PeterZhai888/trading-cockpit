import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface AccountConfig {
  id: number;
  total_capital: number;
  single_trade_risk_pct: number;
  daily_risk_limit_pct: number;
  min_liquidity_amount: number;
  suspension_end_date: string | null;
  consecutive_losses: number;
}

const DEFAULT_CONFIG = {
  total_capital: 100000,
  single_trade_risk_pct: 0.008,
  daily_risk_limit_pct: 0.02,
  min_liquidity_amount: 50000000,
  suspension_end_date: null,
  consecutive_losses: 0,
};

function mapConfig(row: Record<string, unknown>): AccountConfig {
  return {
    id: Number(row.id),
    total_capital: Number(row.total_capital),
    single_trade_risk_pct: Number(row.single_trade_risk_pct),
    daily_risk_limit_pct: Number(row.daily_risk_limit_pct),
    min_liquidity_amount: Number(row.min_liquidity_amount),
    suspension_end_date: row.suspension_end_date != null ? String(row.suspension_end_date) : null,
    consecutive_losses: Number(row.consecutive_losses),
  };
}

/**
 * 获取账户配置（不存在则创建默认配置，is_initialized=false）
 */
export async function getAccountConfig(): Promise<AccountConfig> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('account_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`查询账户配置失败: ${error.message}`);

  if (!data) {
    // 创建默认配置，标记为未初始化
    const { data: inserted, error: insertErr } = await client
      .from('account_config')
      .insert({ id: 1, ...DEFAULT_CONFIG, is_initialized: false })
      .select()
      .single();

    if (insertErr) throw new Error(`初始化账户配置失败: ${insertErr.message}`);
    return mapConfig(inserted as Record<string, unknown>);
  }

  return mapConfig(data as Record<string, unknown>);
}

/**
 * 获取账户配置，未初始化或不存在时返回 null
 * 用于前端展示，区分"从未保存"和"已保存默认值"
 */
export async function getAccountConfigOrNull(): Promise<AccountConfig | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('account_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`查询账户配置失败: ${error.message}`);
  if (!data) return null;
  // 未初始化（引擎自动创建的默认值）视为空
  if (!data.is_initialized) return null;
  return mapConfig(data as Record<string, unknown>);
}

/**
 * 更新账户配置
 */
export async function updateAccountConfig(
  updates: Partial<Omit<AccountConfig, 'id'>>,
): Promise<AccountConfig> {
  const client = getSupabaseClient();

  // 先尝试更新
  const { error: updateErr } = await client
    .from('account_config')
    .update({ ...updates, is_initialized: true, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (updateErr) throw new Error(`更新账户配置失败: ${updateErr.message}`);

  // 查询更新结果
  const { data, error: selectErr } = await client
    .from('account_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (selectErr) throw new Error(`查询账户配置失败: ${selectErr.message}`);

  if (data) return mapConfig(data as Record<string, unknown>);

  // 不存在则创建新行
  const { data: inserted, error: insertErr } = await client
    .from('account_config')
    .insert({ id: 1, ...updates, is_initialized: true })
    .select()
    .single();

  if (insertErr) throw new Error(`创建账户配置失败: ${insertErr.message}`);
  return mapConfig(inserted as Record<string, unknown>);
}

/**
 * 更新连续亏损次数
 */
export async function updateConsecutiveLosses(count: number): Promise<void> {
  await updateAccountConfig({ consecutive_losses: count });

  // 连续5笔亏损：暂停3个交易日
  if (count >= 5) {
    const suspendUntil = new Date();
    suspendUntil.setDate(suspendUntil.getDate() + 3);
    // 跳过周末
    while (suspendUntil.getDay() === 0 || suspendUntil.getDay() === 6) {
      suspendUntil.setDate(suspendUntil.getDate() + 1);
    }
    await updateAccountConfig({
      suspension_end_date: suspendUntil.toISOString().split('T')[0],
    });
  }
}

/**
 * 检查是否处于暂停期，返回剩余暂停天数（0表示不在暂停期）
 */
export async function getSuspensionRemainingDays(): Promise<number> {
  const config = await getAccountConfig();
  if (!config.suspension_end_date) return 0;

  const today = new Date().toISOString().split('T')[0];
  if (today >= config.suspension_end_date) {
    // 暂停期已过，清除标记
    await updateAccountConfig({ suspension_end_date: null });
    return 0;
  }

  const end = new Date(config.suspension_end_date);
  const now = new Date(today);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 人工确认恢复交易（连续亏损计数归零）
 */
export async function resetConsecutiveLosses(): Promise<void> {
  await updateAccountConfig({
    consecutive_losses: 0,
    suspension_end_date: null,
  });
}

/**
 * 清空账户配置，删除配置行（前端显示为"暂无数据"）
 */
export async function resetAccountConfig(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('account_config')
    .delete()
    .eq('id', 1);

  if (error) throw new Error(`重置账户配置失败: ${error.message}`);
}
