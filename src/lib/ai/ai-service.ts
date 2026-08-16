// AI 分析服务层 - 统一封装 LLM 调用
import { LLMClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  buildMarketAnalysisPrompt,
  buildStockAnalysisPrompt,
  buildReviewPrompt,
  type MarketPromptData,
  type StockPromptData,
  type ReviewPromptData,
  type AIAnalysisResult,
} from './prompts';

export type AIAnalysisType = 'market' | 'stock' | 'review';

const MODEL_ID = 'doubao-seed-2-0-mini-260215';

export interface AIStreamEvent {
  type: 'start' | 'delta' | 'done' | 'error';
  content?: string;
  delta?: string;
  result?: AIAnalysisResult | null;
  error?: string;
  meta?: {
    analysis_type: AIAnalysisType;
    related_trade_id?: string;
    related_stock_code?: string;
  };
}

function parseAIOutput(content: string): AIAnalysisResult | null {
  if (!content) return null;
  let jsonStr = content.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const missing = parsed['数据不足项'];
    return {
      判断类型: (parsed['判断类型'] as AIAnalysisResult['判断类型']) || '市场分析',
      市场环境: String(parsed['市场环境'] ?? ''),
      情绪周期: String(parsed['情绪周期'] ?? ''),
      情绪灯号: String(parsed['情绪灯号'] ?? ''),
      核心逻辑: String(parsed['核心逻辑'] ?? ''),
      风险提示: String(parsed['风险提示'] ?? ''),
      建议状态: (parsed['建议状态'] as AIAnalysisResult['建议状态']) || '观察',
      数据不足项: Array.isArray(missing) ? missing.map(String) : [],
      是否需要人工确认: parsed['是否需要人工确认'] === '是' ? '是' : '否',
    };
  } catch {
    return null;
  }
}

async function saveAnalysisRecord(params: {
  analysisType: AIAnalysisType;
  inputSnapshot: unknown;
  rawContent: string;
  result: AIAnalysisResult | null;
  relatedTradeId?: string;
  relatedStockCode?: string;
}): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('ai_analysis').insert({
      analysis_type: params.analysisType,
      stock_code: params.relatedStockCode ?? null,
      trade_id: params.relatedTradeId ?? null,
      input_snapshot: params.inputSnapshot,
      result: params.result,
      raw_content: params.rawContent,
      model_id: MODEL_ID,
    });
    if (error) {
      console.error('保存AI分析记录失败:', error.message);
    }
  } catch (error) {
    console.error('保存AI分析记录异常:', error);
  }
}

async function* runLLMStream(systemPrompt: string, userPrompt: string): AsyncGenerator<AIStreamEvent> {
  const client = new LLMClient();
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  let fullContent = '';
  yield { type: 'start' };

  try {
    const stream = client.stream(messages, {
      model: MODEL_ID,
      temperature: 0.3,
      thinking: 'disabled',
    });

    for await (const chunk of stream) {
      const delta = typeof chunk.content === 'string' ? chunk.content : '';
      if (delta) {
        fullContent += delta;
        yield { type: 'delta', delta, content: fullContent };
      }
    }

    yield { type: 'done', content: fullContent, result: parseAIOutput(fullContent) };
  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'AI分析失败',
      content: fullContent,
    };
  }
}

export async function* analyzeMarket(data: MarketPromptData): AsyncGenerator<AIStreamEvent> {
  const { systemPrompt, userPrompt } = buildMarketAnalysisPrompt(data);
  const meta = { analysis_type: 'market' as const };
  yield { type: 'start', meta };

  let rawContent = '';
  let result: AIAnalysisResult | null = null;
  let failed = false;

  for await (const event of runLLMStream(systemPrompt, userPrompt)) {
    if (event.type === 'delta') {
      rawContent = event.content ?? rawContent;
      yield event;
    } else if (event.type === 'done') {
      rawContent = event.content ?? rawContent;
      result = event.result ?? null;
    } else if (event.type === 'error') {
      failed = true;
      yield event;
    }
  }

  if (!failed) {
    await saveAnalysisRecord({
      analysisType: 'market',
      inputSnapshot: data,
      rawContent,
      result,
    });
  }

  yield { type: 'done', content: rawContent, result, meta };
}

export async function* analyzeStock(data: StockPromptData): AsyncGenerator<AIStreamEvent> {
  const { systemPrompt, userPrompt } = buildStockAnalysisPrompt(data);
  const meta = {
    analysis_type: 'stock' as const,
    related_stock_code: data.stock.code,
  };
  yield { type: 'start', meta };

  let rawContent = '';
  let result: AIAnalysisResult | null = null;
  let failed = false;

  for await (const event of runLLMStream(systemPrompt, userPrompt)) {
    if (event.type === 'delta') {
      rawContent = event.content ?? rawContent;
      yield event;
    } else if (event.type === 'done') {
      rawContent = event.content ?? rawContent;
      result = event.result ?? null;
    } else if (event.type === 'error') {
      failed = true;
      yield event;
    }
  }

  if (!failed) {
    await saveAnalysisRecord({
      analysisType: 'stock',
      inputSnapshot: data,
      rawContent,
      result,
      relatedStockCode: data.stock.code,
    });
  }

  yield { type: 'done', content: rawContent, result, meta };
}

export async function* analyzeReview(data: ReviewPromptData): AsyncGenerator<AIStreamEvent> {
  const { systemPrompt, userPrompt } = buildReviewPrompt(data);
  const meta = {
    analysis_type: 'review' as const,
    related_trade_id: data.trade.trade_id,
    related_stock_code: data.trade.stock_code,
  };
  yield { type: 'start', meta };

  let rawContent = '';
  let result: AIAnalysisResult | null = null;
  let failed = false;

  for await (const event of runLLMStream(systemPrompt, userPrompt)) {
    if (event.type === 'delta') {
      rawContent = event.content ?? rawContent;
      yield event;
    } else if (event.type === 'done') {
      rawContent = event.content ?? rawContent;
      result = event.result ?? null;
    } else if (event.type === 'error') {
      failed = true;
      yield event;
    }
  }

  if (!failed) {
    await saveAnalysisRecord({
      analysisType: 'review',
      inputSnapshot: data,
      rawContent,
      result,
      relatedTradeId: data.trade.trade_id,
      relatedStockCode: data.trade.stock_code,
    });
  }

  yield { type: 'done', content: rawContent, result, meta };
}

export async function deleteAnalysisHistory(id?: string): Promise<void> {
  const client = getSupabaseClient();
  if (id) {
    const { error } = await client.from('ai_analysis').delete().eq('id', id);
    if (error) throw new Error(`删除分析记录失败: ${error.message}`);
  } else {
    const { error } = await client.from('ai_analysis').delete().neq('id', '');
    if (error) throw new Error(`清空分析记录失败: ${error.message}`);
  }
}

export async function getAnalysisHistory(analysisType?: AIAnalysisType, limit = 20) {
  const client = getSupabaseClient();
  let query = client
    .from('ai_analysis')
    .select('id, analysis_type, input_snapshot, result, model_id, trade_id, stock_code, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (analysisType) {
    query = query.eq('analysis_type', analysisType);
  }

  const { data, error } = await query;
  if (error) throw new Error(`查询AI分析历史失败: ${error.message}`);
  return data;
}
