import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface ThemeInput {
  theme_name: string;
  capital_score?: number;
  spread_score?: number;
  policy_score?: number;
  expectation_score?: number;
  recognition_score?: number;
  leader_performance_score?: number;
}

export interface ThemeRecord extends ThemeInput {
  id: string;
  date: string;
  score: number;
  created_at?: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export async function getCurrentTheme(): Promise<ThemeRecord | null> {
  const client = getSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from('theme')
    .select('*')
    .eq('date', today)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`查询主线失败: ${error.message}`);
  return (data as ThemeRecord) ?? null;
}

export async function getThemesByDate(date: string): Promise<ThemeRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('theme')
    .select('*')
    .eq('date', date)
    .order('score', { ascending: false });

  if (error) throw new Error(`查询主线失败: ${error.message}`);
  return (data as ThemeRecord[]) ?? [];
}

export async function saveTheme(input: ThemeInput): Promise<ThemeRecord> {
  const client = getSupabaseClient();
  const score =
    clamp(input.capital_score ?? 0, 0, 25) +
    clamp(input.spread_score ?? 0, 0, 20) +
    clamp(input.policy_score ?? 0, 0, 15) +
    clamp(input.expectation_score ?? 0, 0, 10) +
    clamp(input.recognition_score ?? 0, 0, 15) +
    clamp(input.leader_performance_score ?? 0, 0, 15);

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from('theme')
    .insert({
      date: today,
      theme_name: input.theme_name,
      score,
      capital_score: input.capital_score ?? 0,
      spread_score: input.spread_score ?? 0,
      policy_score: input.policy_score ?? 0,
      expectation_score: input.expectation_score ?? 0,
      recognition_score: input.recognition_score ?? 0,
      leader_performance_score: input.leader_performance_score ?? 0,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`保存主线失败: ${error?.message ?? '未知错误'}`);
  return data as ThemeRecord;
}
