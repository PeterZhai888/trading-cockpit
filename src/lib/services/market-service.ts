import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { MarketEnvLevel, EmotionLight, FinalLevel, MarketRawData, EmotionResult } from '@/lib/engine/types';
import { calculateMarketEnvironment } from '@/lib/engine/market-env';
import { calculateEmotion } from '@/lib/engine/emotion';
import { reconcileLevel, calculatePreviewLevel } from '@/lib/engine/state-reconcile';

export interface MarketStatusRecord {
  date: string;
  score: number | null;
  environment: MarketEnvLevel | null;
  emotion_cycle: string | null;
  emotion_light_suggested: EmotionLight | null;
  emotion_light_confirmed: EmotionLight | null;
  final_level: FinalLevel | null;
  is_preview: boolean;
  confidence: number | null;
  raw_data: MarketRawData | null;
}

/**
 * 获取今日市场状态
 */
export async function getTodayMarketStatus(): Promise<MarketStatusRecord | null> {
  const client = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('market_status')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  if (error) throw new Error(`查询市场状态失败: ${error.message}`);
  return data as MarketStatusRecord | null;
}

/**
 * 保存市场原始数据并自动计算
 */
export async function saveMarketRawData(
  rawData: MarketRawData,
  confirmedLight?: EmotionLight | null,
): Promise<MarketStatusRecord> {
  const client = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  // 计算市场环境
  const envResult = calculateMarketEnvironment(rawData);
  // 计算情绪
  const emotionResult: EmotionResult = calculateEmotion(rawData, confirmedLight ?? null);
  // 状态调和
  const reconcile = reconcileLevel(envResult.environment, emotionResult.light_confirmed);

  const record = {
    date: today,
    score: envResult.score,
    environment: envResult.environment,
    emotion_cycle: emotionResult.cycle,
    emotion_light_suggested: emotionResult.light_suggested,
    emotion_light_confirmed: emotionResult.light_confirmed,
    final_level: reconcile.final_level,
    is_preview: reconcile.is_preview,
    confidence: 80,
    raw_data: rawData,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('market_status')
    .upsert(record, { onConflict: 'date' })
    .select()
    .single();

  if (error) throw new Error(`保存市场数据失败: ${error.message}`);
  return data as MarketStatusRecord;
}

/**
 * 人工确认情绪灯号（传 null 表示撤回确认）
 */
export async function confirmEmotionLight(
  light: EmotionLight | null,
): Promise<MarketStatusRecord> {
  const client = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const existing = await getTodayMarketStatus();
  if (!existing) throw new Error('今日尚无市场数据，请先录入市场数据');

  const envLevel = existing.environment ?? 'B';
  const suggestedLight = existing.emotion_light_suggested ?? 'yellow';

  // 重新计算调和结果；撤回确认时使用 suggestedLight 计算预览等级
  const reconcile = light
    ? reconcileLevel(envLevel, light)
    : {
        final_level: calculatePreviewLevel(envLevel, suggestedLight),
        is_preview: true,
      };

  const { data, error } = await client
    .from('market_status')
    .update({
      emotion_light_confirmed: light,
      final_level: reconcile.final_level,
      is_preview: reconcile.is_preview,
      updated_at: new Date().toISOString(),
    })
    .eq('date', today)
    .select()
    .single();

  if (error) throw new Error(`确认灯号失败: ${error.message}`);
  return data as MarketStatusRecord;
}

/**
 * 获取预览等级（使用建议灯号计算）
 */
export function getPreviewFinalLevel(
  environment: MarketEnvLevel,
  suggestedLight: EmotionLight,
): FinalLevel {
  return calculatePreviewLevel(environment, suggestedLight);
}

/**
 * 清空今日市场数据
 */
export async function clearTodayMarketStatus(): Promise<void> {
  const client = getSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const { error } = await client
    .from('market_status')
    .delete()
    .eq('date', today);

  if (error) throw new Error(`清空市场数据失败: ${error.message}`);
}
