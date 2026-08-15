import { NextRequest } from 'next/server';
import { getTodayMarketStatus } from '@/lib/services/market-service';
import { getCurrentTheme } from '@/lib/services/theme-service';
import { getTrade, listTrades } from '@/lib/services/trade-service';
import { getAccountConfig, getSuspensionRemainingDays } from '@/lib/services/account-service';
import { searchStocks } from '@/lib/services/stock-service';
import { analyzeMarket, analyzeStock, analyzeReview, type AIAnalysisType } from '@/lib/ai/ai-service';
import type { MarketPromptData, StockPromptData, ReviewPromptData } from '@/lib/ai/prompts';

function isValidAnalysisType(v: unknown): v is AIAnalysisType {
  return v === 'market' || v === 'stock' || v === 'review';
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const analysisType = body.analysis_type;
  if (!isValidAnalysisType(analysisType)) {
    return Response.json(
      { success: false, error: 'analysis_type 必须为 market / stock / review' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  let finished = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        if (finished) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const close = () => {
        if (finished) return;
        finished = true;
        if (heartbeat) clearInterval(heartbeat);
        send({ type: 'done' });
        try {
          controller.close();
        } catch {
          // noop
        }
      };

      heartbeat = setInterval(() => {
        send({ type: 'heartbeat', time: Date.now() });
      }, 15000);

      request.signal.addEventListener('abort', close);

      try {
        let generator: AsyncGenerator<{
          type: string;
          content?: string;
          delta?: string;
          result?: unknown;
          error?: string;
          meta?: { analysis_type: AIAnalysisType; related_trade_id?: string; related_stock_code?: string };
        }>;

        if (analysisType === 'market') {
          const [market, theme, accountConfig, openTrades] = await Promise.all([
            getTodayMarketStatus(),
            getCurrentTheme(),
            getAccountConfig().catch(() => null),
            listTrades('open').catch(() => []),
          ]);

          if (!market) {
            send({ type: 'error', message: '暂无市场数据，请先在数据录入中计算市场环境' });
            close();
            return;
          }

          const suspensionRemainingDays = await getSuspensionRemainingDays().catch(() => 0);
          const promptData: MarketPromptData = {
            market: {
              date: market.date,
              score: market.score,
              environment: market.environment,
              emotion_cycle: market.emotion_cycle,
              emotion_light_suggested: market.emotion_light_suggested,
              emotion_light_confirmed: market.emotion_light_confirmed,
              final_level: market.final_level,
              is_preview: market.is_preview,
              raw_data: market.raw_data,
            },
            theme: theme
              ? {
                  theme_name: theme.theme_name,
                  score: theme.score,
                  capital_score: theme.capital_score ?? 0,
                  spread_score: theme.spread_score ?? 0,
                  policy_score: theme.policy_score ?? 0,
                  expectation_score: theme.expectation_score ?? 0,
                  recognition_score: theme.recognition_score ?? 0,
                  leader_performance_score: theme.leader_performance_score ?? 0,
                }
              : null,
            account: accountConfig
              ? {
                  total_capital: accountConfig.total_capital,
                  consecutive_losses: accountConfig.consecutive_losses,
                  suspension_remaining_days: suspensionRemainingDays,
                }
              : null,
            openPositions: openTrades.length,
          };
          generator = analyzeMarket(promptData);
        } else if (analysisType === 'stock') {
          const stockCode = String(body.stock_code || '').trim();
          if (!stockCode) {
            send({ type: 'error', message: 'stock_code 不能为空' });
            close();
            return;
          }

          const stockResults = await searchStocks(stockCode);
          const matched = stockResults.find((s) => s.code === stockCode) ?? stockResults[0] ?? null;
          if (!matched) {
            send({ type: 'error', message: `未找到股票 ${stockCode}` });
            close();
            return;
          }

          const [market, theme] = await Promise.all([
            getTodayMarketStatus(),
            getCurrentTheme(),
          ]);

          const promptData: StockPromptData = {
            stock: {
              code: matched.code,
              name: matched.name,
              industry: matched.industry ?? '未分类',
            },
            market: market
              ? {
                  environment: market.environment,
                  emotion_cycle: market.emotion_cycle,
                  emotion_light_confirmed: market.emotion_light_confirmed,
                  final_level: market.final_level,
                  is_preview: market.is_preview,
                }
              : null,
            theme: theme
              ? { theme_name: theme.theme_name, score: theme.score }
              : null,
            stockScore: null,
          };
          generator = analyzeStock(promptData);
        } else {
          const tradeId = String(body.trade_id || '').trim();
          if (!tradeId) {
            send({ type: 'error', message: 'trade_id 不能为空' });
            close();
            return;
          }

          const trade = await getTrade(tradeId);
          if (!trade) {
            send({ type: 'error', message: `未找到交易 ${tradeId}` });
            close();
            return;
          }

          const promptData: ReviewPromptData = {
            trade: {
              trade_id: trade.trade_id,
              stock_code: trade.stock_code,
              stock_name: trade.stock_name ?? '',
              trade_mode: trade.trade_mode ?? null,
              buy_price: trade.buy_price,
              sell_price: trade.sell_price ?? null,
              position: trade.position,
              stop_price: trade.stop_price ?? null,
              profit_loss: trade.profit_loss ?? null,
              final_level: trade.final_level ?? null,
              buy_reason: trade.buy_reason ?? null,
              buy_position_note: trade.buy_position_note ?? null,
              risk_note: trade.risk_note ?? null,
              exit_plan: trade.exit_plan ?? null,
              sell_reason: trade.sell_reason ?? null,
              is_violation: trade.is_violation,
              violation_reason: trade.violation_reason ?? null,
              decision_score: trade.decision_score ?? null,
              add_records: trade.add_records,
              reduce_records: trade.reduce_records,
            },
          };
          generator = analyzeReview(promptData);
        }

        for await (const event of generator) {
          if (finished) break;
          if (event.type === 'start') {
            send({ type: 'meta', ...(event.meta ? event.meta : { analysis_type: analysisType }) });
          } else if (event.type === 'delta') {
            send({ type: 'chunk', delta: event.delta, content: event.content });
          } else if (event.type === 'error') {
            send({ type: 'error', message: event.error || 'AI 分析失败' });
          } else if (event.type === 'done') {
            send({ type: 'result', result: event.result ?? null, content: event.content ?? '' });
          }
        }

        close();
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : 'AI 分析失败' });
        close();
      }
    },
    cancel() {
      finished = true;
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
