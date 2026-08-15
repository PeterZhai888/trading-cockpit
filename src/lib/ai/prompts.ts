/**
 * AI 提示词模板（规格书第3.2、8章）
 *
 * 核心原则：
 * 1. AI 不是交易员，是分析助手
 * 2. 禁止输出"明天必涨"、"可以买入"、"涨停概率90%"、"保证盈利"等确定性预测
 * 3. 必须结构化 JSON 输出
 * 4. 数据不足时必须明确指出，不得强行判断
 */

export const AI_SYSTEM_PROMPT = `你是一名A股短线交易辅助分析AI，严格遵守以下规则：

【角色定位】
- 你是分析助手，不是交易员，不进行自动交易
- 你不预测未来涨跌，不给出"必涨/必跌"的判断
- 你只根据提供的数据和既定交易规则进行结构化分析

【严格禁止输出】
- "明天必涨"、"可以买入"、"涨停概率90%"、"保证盈利"、"稳赚"
- 任何价格预测、点位预测、收益承诺
- 绕过风控规则的建议（如"L0也可小仓位试错"）

【正确的表述方式】
- "符合观察条件" / "存在交易机会" / "风险需要关注"
- "数据不足以判断" / "需要等待XX确认"
- "规则要求XX，当前状态为XX，因此建议XX"

【输出格式】
必须输出合法JSON（不要包裹在markdown代码块中），字段如下：
{
  "判断类型": "市场分析" | "个股分析" | "交易复盘",
  "市场环境": "A级进攻/B级震荡/C级防守/数据不足",
  "情绪周期": "冰点/启动/修复/分歧/高潮/退潮/数据不足",
  "情绪灯号": "绿灯/黄灯/橙灯/红灯/未确认",
  "核心逻辑": "（一段话，100字以内，基于数据的事实陈述）",
  "风险提示": "（一段话，列出主要风险因素）",
  "建议状态": "观察/BUY候选/HOLD/REDUCE/EXIT/NO DATA",
  "数据不足项": ["（列出缺失或过期的字段）"],
  "是否需要人工确认": "是/否"
}

【交易规则背景】
- 六层等级：L0停止(红或C+橙) / L1防守(C或黄+橙) / L2谨慎(B+黄) / L3积极(A+绿)
- 保守原则：市场环境与情绪灯号取较低（更保守）等级
- 情绪灯号必须人工确认后才能生成正式BUY候选，未确认时只能作为"预览等级"
- L0硬拦截禁止开仓；L1可特批但标记违规；L2仅限核心池；L3允许开仓`;

export type AIAnalysisResult = {
  判断类型: '市场分析' | '个股分析' | '交易复盘';
  市场环境: string;
  情绪周期: string;
  情绪灯号: string;
  核心逻辑: string;
  风险提示: string;
  建议状态: '观察' | 'BUY候选' | 'HOLD' | 'REDUCE' | 'EXIT' | 'NO DATA';
  数据不足项: string[];
  是否需要人工确认: '是' | '否';
};

export type MarketPromptData = {
  market: {
    date: string;
    score: number | null;
    environment: string | null;
    emotion_cycle: string | null;
    emotion_light_suggested: string | null;
    emotion_light_confirmed: string | null;
    final_level: string | null;
    is_preview: boolean;
    raw_data: unknown;
  } | null;
  theme: {
    theme_name: string;
    score: number;
    capital_score: number;
    spread_score: number;
    policy_score: number;
    expectation_score: number;
    recognition_score: number;
    leader_performance_score: number;
  } | null;
  account: {
    total_capital: number;
    consecutive_losses: number;
    suspension_remaining_days: number;
  } | null;
  openPositions: number;
};

export type StockPromptData = {
  stock: {
    code: string;
    name: string;
    industry: string;
  };
  market: {
    environment: string | null;
    emotion_cycle: string | null;
    emotion_light_confirmed: string | null;
    final_level: string | null;
    is_preview: boolean;
  } | null;
  theme: {
    theme_name: string;
    score: number;
  } | null;
  stockScore: {
    leader_score: number;
    recognition: number;
    capital: number;
    drive: number;
    technical: number;
    emotion: number;
    risk_reward: number;
  } | null;
};

export type ReviewPromptData = {
  trade: {
    trade_id: string;
    stock_code: string;
    stock_name: string;
    trade_mode: string | null;
    buy_price: number | string;
    sell_price: number | string | null;
    position: number;
    stop_price: number | string | null;
    profit_loss: number | string | null;
    final_level: string | null;
    buy_reason: string | null;
    buy_position_note: string | null;
    risk_note: string | null;
    exit_plan: string | null;
    sell_reason: string | null;
    is_violation: boolean;
    violation_reason: string | null;
    decision_score: number | null;
    add_records: unknown;
    reduce_records: unknown;
  };
};

export type PromptBundle = {
  systemPrompt: string;
  userPrompt: string;
};

export function buildMarketAnalysisPrompt(data: MarketPromptData): PromptBundle {
  const missing: string[] = [];
  if (!data.market) missing.push('市场环境数据');
  if (!data.theme) missing.push('主线评分');
  if (!data.account) missing.push('账户配置');

  const marketBlock = data.market
    ? `- 交易日：${data.market.date}
- 市场环境评分：${data.market.score ?? '--'}分（${data.market.environment ?? '--'}级）
- 情绪周期：${data.market.emotion_cycle || '未识别'}
- AI建议灯号：${data.market.emotion_light_suggested || '未生成'}
- 人工确认灯号：${data.market.emotion_light_confirmed || '【未确认】'}
- 最终交易等级：${data.market.final_level || '--'}${data.market.is_preview ? '（预览等级，未确认）' : ''}
- 原始数据：${JSON.stringify(data.market.raw_data)}`
    : '- 市场环境数据：【缺失】';

  const themeBlock = data.theme
    ? `【主线情况】
- 主线名称：${data.theme.theme_name}
- 主线总分：${data.theme.score}/100
- 资金强度：${data.theme.capital_score}/25
- 板块扩散：${data.theme.spread_score}/20
- 政策逻辑：${data.theme.policy_score}/15
- 持续性：${data.theme.expectation_score}/10
- 市场认可：${data.theme.recognition_score}/15
- 龙头表现：${data.theme.leader_performance_score}/15`
    : '【主线情况】：未录入';

  const accountBlock = data.account
    ? `【账户状态】
- 账户总资金：${data.account.total_capital}
- 连续亏损笔数：${data.account.consecutive_losses}
- 暂停期剩余：${data.account.suspension_remaining_days}个交易日`
    : '【账户状态】：未配置';

  const userPrompt = `请进行【市场综合分析】。

【当前数据】
${marketBlock}

${themeBlock}

${accountBlock}

【持仓】当前持仓数：${data.openPositions}

请基于以上数据进行分析。${missing.length ? `注意：${missing.join('、')}缺失，数据不足项必须列出。` : ''}
判断类型填"市场分析"。`;

  return { systemPrompt: AI_SYSTEM_PROMPT, userPrompt };
}

export function buildStockAnalysisPrompt(data: StockPromptData): PromptBundle {
  const missing: string[] = [];
  if (!data.market) missing.push('市场环境');
  if (!data.theme) missing.push('主线归属');
  if (!data.stockScore) missing.push('龙头评分');

  const marketBlock = data.market
    ? `- 市场环境：${data.market.environment ?? '--'}级
- 情绪周期：${data.market.emotion_cycle || '未识别'}
- 人工确认灯号：${data.market.emotion_light_confirmed || '未确认'}
- 最终等级：${data.market.final_level || '--'}${data.market.is_preview ? '（预览，不能生成正式BUY候选）' : ''}`
    : '【市场背景】：缺失';

  const themeBlock = data.theme
    ? `【所属主线】
- 主线：${data.theme.theme_name}（${data.theme.score}/100分）`
    : '【所属主线】：未确定';

  const scoreBlock = data.stockScore
    ? `【龙头评分】
- 总分：${data.stockScore.leader_score}/100
- 辨识度：${data.stockScore.recognition}/20
- 资金强度：${data.stockScore.capital}/25
- 带动能力：${data.stockScore.drive}/15
- 技术形态：${data.stockScore.technical}/15
- 情绪匹配：${data.stockScore.emotion}/15
- 风险收益比：${data.stockScore.risk_reward}/10`
    : '【龙头评分】：未评分';

  const userPrompt = `请进行【个股分析】。

【目标股票】
- 代码：${data.stock.code}
- 名称：${data.stock.name}
- 行业：${data.stock.industry}

${marketBlock}

${themeBlock}

${scoreBlock}

请分析该股在当前市场背景下是否符合观察条件。
- 若最终等级为L0或预览状态，建议状态必须为"观察"或"NO DATA"
- 不得给出"可以买入"指令，只能输出"符合观察条件"或"存在交易机会"
${missing.length ? `注意：${missing.join('、')}数据缺失。` : ''}
判断类型填"个股分析"。`;

  return { systemPrompt: AI_SYSTEM_PROMPT, userPrompt };
}

export function buildReviewPrompt(data: ReviewPromptData): PromptBundle {
  const t = data.trade;
  const buyPrice = Number(t.buy_price);
  const sellPrice = t.sell_price != null ? Number(t.sell_price) : null;
  const plPct = sellPrice != null && buyPrice > 0
    ? (((sellPrice - buyPrice) / buyPrice) * 100).toFixed(2)
    : '--';

  const userPrompt = `请进行【交易复盘】。

【交易记录】
- 股票：${t.stock_name}（${t.stock_code}）
- 交易模式：${t.trade_mode || '未记录'}
- 买入价：${t.buy_price}
- 止损价：${t.stop_price ?? '未记录'}
- 卖出价：${t.sell_price ?? '未平仓'}
- 持仓量：${t.position}
- 实际盈亏：${t.profit_loss != null ? t.profit_loss : '未结算'}元（${plPct}%）
- 买入时等级：${t.final_level || '未记录'}
- 是否违规：${t.is_violation ? `是（${t.violation_reason || ''}）` : '否'}
- 决策质量分：${t.decision_score != null ? `${t.decision_score}/100` : '未评分'}

【买点四要素】
- 买入逻辑：${t.buy_reason || '未记录'}
- 买入位置：${t.buy_position_note || '未记录'}
- 风险位/止损：${t.risk_note || '未记录'}
- 退出计划：${t.exit_plan || '未记录'}

【加仓记录】${JSON.stringify(t.add_records ?? [])}
【减仓记录】${JSON.stringify(t.reduce_records ?? [])}
【卖出理由】${t.sell_reason || '未记录'}

请基于以上数据进行客观复盘：
1. 区分"决策质量"与"实际盈亏"——赚钱的交易不一定是好决策，亏钱的交易也可能是好决策
2. 指出买点四要素中哪些完整、哪些缺失
3. 如果是违规交易，评估违规是否值得
4. 给出可执行的改进建议（不超过3条）
判断类型填"交易复盘"。建议状态根据平仓情况填"EXIT"。`;

  return { systemPrompt: AI_SYSTEM_PROMPT, userPrompt };
}
