import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { TradeRecord, AddRecord, ReduceRecord, FinalLevel, TradeMode, StockRole } from '@/lib/engine/types';

export interface CreateTradeInput {
  stock_code: string;
  stock_name?: string;
  buy_price: number;
  position: number;
  stop_price?: number;
  trade_mode?: TradeMode;
  theme?: string;
  market_env?: string;
  emotion_cycle?: string;
  emotion_light?: string;
  final_level?: FinalLevel;
  buy_reason?: string;
  buy_position_note?: string;
  risk_note?: string;
  exit_plan?: string;
  is_violation?: boolean;
  violation_reason?: string;
  stock_role?: StockRole;
  industry?: string;
}

export interface AddPositionInput {
  trade_id: string;
  price: number;
  qty: number;
}

export interface ReducePositionInput {
  trade_id: string;
  price: number;
  qty: number;
  reason: string;
}

/**
 * 将数据库行转换为TradeRecord
 */
function mapTradeFromDb(row: Record<string, unknown>): TradeRecord {
  return {
    trade_id: String(row.trade_id),
    stock_code: String(row.stock_code),
    stock_name: row.stock_name != null ? String(row.stock_name) : undefined,
    buy_time: String(row.buy_time),
    sell_time: row.sell_time != null ? String(row.sell_time) : undefined,
    buy_price: Number(row.buy_price),
    sell_price: row.sell_price != null ? Number(row.sell_price) : undefined,
    position: Number(row.position),
    stop_price: row.stop_price != null ? Number(row.stop_price) : undefined,
    profit_loss: row.profit_loss != null ? Number(row.profit_loss) : undefined,
    status: row.status as TradeRecord['status'],
    trade_mode: row.trade_mode != null ? (row.trade_mode as TradeMode) : undefined,
    theme: row.theme != null ? String(row.theme) : undefined,
    market_env: row.market_env != null ? String(row.market_env) : undefined,
    emotion_cycle: row.emotion_cycle != null ? String(row.emotion_cycle) : undefined,
    emotion_light: row.emotion_light != null ? String(row.emotion_light) : undefined,
    final_level: row.final_level != null ? (row.final_level as FinalLevel) : undefined,
    buy_reason: row.buy_reason != null ? String(row.buy_reason) : undefined,
    buy_position_note: row.buy_position_note != null ? String(row.buy_position_note) : undefined,
    risk_note: row.risk_note != null ? String(row.risk_note) : undefined,
    exit_plan: row.exit_plan != null ? String(row.exit_plan) : undefined,
    sell_reason: row.sell_reason != null ? String(row.sell_reason) : undefined,
    avg_cost: row.avg_cost != null ? Number(row.avg_cost) : undefined,
    add_records: (row.add_records as AddRecord[]) ?? [],
    reduce_records: (row.reduce_records as ReduceRecord[]) ?? [],
    is_violation: Boolean(row.is_violation),
    violation_reason: row.violation_reason != null ? String(row.violation_reason) : undefined,
    decision_score: row.decision_score != null ? Number(row.decision_score) : undefined,
    stock_role: row.stock_role != null ? (row.stock_role as StockRole) : undefined,
  };
}

/**
 * 创建交易记录
 */
export async function createTrade(input: CreateTradeInput): Promise<TradeRecord> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('trade')
    .insert({
      stock_code: input.stock_code,
      stock_name: input.stock_name,
      industry: input.industry,
      buy_time: now,
      buy_price: input.buy_price,
      position: input.position,
      stop_price: input.stop_price,
      status: 'open',
      trade_mode: input.trade_mode,
      theme: input.theme,
      market_env: input.market_env,
      emotion_cycle: input.emotion_cycle,
      emotion_light: input.emotion_light,
      final_level: input.final_level,
      buy_reason: input.buy_reason,
      buy_position_note: input.buy_position_note,
      risk_note: input.risk_note,
      exit_plan: input.exit_plan,
      avg_cost: input.buy_price,
      add_records: [],
      reduce_records: [],
      is_violation: input.is_violation ?? false,
      violation_reason: input.violation_reason,
      stock_role: input.stock_role,
    })
    .select()
    .single();

  if (error) throw new Error(`创建交易记录失败: ${error.message}`);
  return mapTradeFromDb(data as Record<string, unknown>);
}

/**
 * 查询所有交易记录
 */
export async function listTrades(
  status?: 'open' | 'closed' | 'paused',
  limit = 100,
): Promise<TradeRecord[]> {
  const client = getSupabaseClient();
  let query = client
    .from('trade')
    .select('*')
    .order('buy_time', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(`查询交易记录失败: ${error.message}`);
  return (data as Record<string, unknown>[]).map(mapTradeFromDb);
}

/**
 * 根据ID查询交易记录
 */
export async function getTrade(tradeId: string): Promise<TradeRecord | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('trade')
    .select('*')
    .eq('trade_id', tradeId)
    .maybeSingle();

  if (error) throw new Error(`查询交易失败: ${error.message}`);
  return data ? mapTradeFromDb(data as Record<string, unknown>) : null;
}

/**
 * 加仓：更新add_records和avg_cost
 */
export async function addPosition(input: AddPositionInput): Promise<TradeRecord> {
  const client = getSupabaseClient();
  const trade = await getTrade(input.trade_id);
  if (!trade) throw new Error('交易记录不存在');

  const currentQty = trade.position;
  const currentCost = trade.avg_cost ?? trade.buy_price;
  const newQty = currentQty + input.qty;
  const newAvgCost =
    (currentQty * currentCost + input.qty * input.price) / newQty;

  const newRecord: AddRecord = {
    time: new Date().toISOString(),
    price: input.price,
    qty: input.qty,
  };

  const { data, error } = await client
    .from('trade')
    .update({
      position: newQty,
      avg_cost: newAvgCost,
      add_records: [...trade.add_records, newRecord],
      updated_at: new Date().toISOString(),
    })
    .eq('trade_id', input.trade_id)
    .select()
    .single();

  if (error) throw new Error(`加仓失败: ${error.message}`);
  return mapTradeFromDb(data as Record<string, unknown>);
}

/**
 * 减仓/卖出：更新reduce_records，全部卖完时状态转为closed
 */
export async function reducePosition(input: ReducePositionInput): Promise<TradeRecord> {
  const client = getSupabaseClient();
  const trade = await getTrade(input.trade_id);
  if (!trade) throw new Error('交易记录不存在');

  const remainingQty = trade.position - input.qty;
  if (remainingQty < 0) throw new Error('卖出数量超过持仓数量');

  const newRecord: ReduceRecord = {
    time: new Date().toISOString(),
    price: input.price,
    qty: input.qty,
    reason: input.reason,
  };

  const updateData: Record<string, unknown> = {
    position: remainingQty,
    reduce_records: [...trade.reduce_records, newRecord],
    updated_at: new Date().toISOString(),
  };

  if (remainingQty === 0) {
    updateData.status = 'closed';
    updateData.sell_time = new Date().toISOString();
    updateData.sell_price = input.price;
    // 计算实际盈亏（简化版：用最后卖出价计算）
    const cost = trade.avg_cost ?? trade.buy_price;
    const totalSold = trade.position;
    updateData.profit_loss = (input.price - cost) * totalSold;
  }

  const { data, error } = await client
    .from('trade')
    .update(updateData)
    .eq('trade_id', input.trade_id)
    .select()
    .single();

  if (error) throw new Error(`减仓失败: ${error.message}`);
  return mapTradeFromDb(data as Record<string, unknown>);
}

/**
 * 更新止损价（需记录原因，对应5.2人工修改权限）
 */
export async function updateStopPrice(
  tradeId: string,
  stopPrice: number,
  reason: string,
): Promise<TradeRecord> {
  const client = getSupabaseClient();
  const existingNote = await getTrade(tradeId);
  const notePrefix = existingNote?.risk_note ? `${existingNote.risk_note}\n` : '';

  const { data, error } = await client
    .from('trade')
    .update({
      stop_price: stopPrice,
      risk_note: `${notePrefix}[${new Date().toISOString()}] 止损价修改为${stopPrice}，原因：${reason}`,
      updated_at: new Date().toISOString(),
    })
    .eq('trade_id', tradeId)
    .select()
    .single();

  if (error) throw new Error(`更新止损价失败: ${error.message}`);
  return mapTradeFromDb(data as Record<string, unknown>);
}

/**
 * 删除交易记录
 */
export async function deleteTrade(tradeId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('trade')
    .delete()
    .eq('trade_id', tradeId);

  if (error) throw new Error(`删除交易记录失败: ${error.message}`);
}

/**
 * 获取连续亏损次数
 */
export async function getConsecutiveLosses(): Promise<number> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('trade')
    .select('profit_loss')
    .eq('status', 'closed')
    .order('sell_time', { ascending: false })
    .limit(20);

  if (error) throw new Error(`查询连续亏损失败: ${error.message}`);

  let count = 0;
  for (const row of data as Array<{ profit_loss: number | null }>) {
    if (row.profit_loss != null && row.profit_loss < 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}
