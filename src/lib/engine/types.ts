// 核心类型定义 - A股短线交易驾驶舱 v0.6

// ============ 枚举类型 ============

/** 市场环境等级 */
export type MarketEnvLevel = 'A' | 'B' | 'C';

/** 情绪灯号 */
export type EmotionLight = 'green' | 'yellow' | 'orange' | 'red';

/** 情绪周期六阶段 */
export type EmotionCycle =
  | '启动'
  | '发酵'
  | '高潮'
  | '分歧'
  | '退潮'
  | '冰点';

/** 最终交易等级 */
export type FinalLevel = 'L0' | 'L1' | 'L2' | 'L3';

/** 交易状态 */
export type TradeStatus = 'open' | 'closed' | 'paused';

/** 系统状态（六选一） */
export type SystemStatus =
  | '观察'
  | 'BUY候选'
  | 'HOLD'
  | 'REDUCE'
  | 'EXIT'
  | 'NO DATA';

/** 交易模式 */
export type TradeMode = '强势跟随' | '分歧低吸' | '弱转强';

/** 股票角色 */
export type StockRole = '龙头' | '核心' | '跟风';

/** 股票过滤状态 */
export type StockFilterStatus =
  | 'normal'
  | 'excluded_st'
  | 'excluded_delisting'
  | 'excluded_suspended'
  | 'excluded_non_mainboard'
  | 'excluded_liquidity';

/** 数据状态 */
export type DataState = 'valid' | 'expired' | 'missing' | 'invalid';

/** 数据来源 */
export type DataSource = '行情接口' | 'AI分析' | '人工输入';

// ============ 数据结构 ============

/** 市场原始数据 */
export interface MarketRawData {
  up_count: number;
  down_count: number;
  limit_up_count: number;
  limit_down_count: number;
  broken_limit_count: number;
  broken_limit_rate: number;
  max_consecutive_boards: number;
  total_turnover: number;
}

/** 市场环境计算结果 */
export interface MarketEnvResult {
  score: number;
  environment: MarketEnvLevel;
  env_label: string;
}

/** 情绪计算结果 */
export interface EmotionResult {
  cycle: EmotionCycle;
  light_suggested: EmotionLight;
  light_confirmed: EmotionLight | null;
}

/** 主线评分明细 */
export interface ThemeScoreDetail {
  capital_score: number;       // 资金强度 25
  spread_score: number;        // 板块扩散 20
  policy_score: number;        // 政策逻辑 15
  expectation_score: number;   // 持续性 10
  recognition_score: number;   // 市场认可 15
  leader_performance_score: number; // 龙头表现 15
  total: number;
}

/** 龙头评分明细 */
export interface LeaderScoreDetail {
  recognition: number;   // 辨识度 20
  capital: number;       // 资金强度 25
  drive: number;         // 带动能力 15
  technical: number;     // 技术形态 15
  emotion: number;       // 情绪匹配 15
  risk_reward: number;   // 风险收益 10
  total: number;
}

/** 状态调和结果 */
export interface ReconcileResult {
  final_level: FinalLevel;
  is_preview: boolean;
  risk_threshold_min: number;
  risk_threshold_max: number;
  position_coefficient: number;
  can_open: boolean;
  requires_approval: boolean;
  allowed_modes: TradeMode[];
}

/** 等级参数 */
export interface LevelParams {
  risk_threshold_min: number;
  risk_threshold_max: number;
  can_open: boolean;
  requires_approval: boolean;
  position_coefficient: number;
  allowed_modes: TradeMode[];
}

// ============ 风险计算 ============

/** 账户风险输入 */
export interface AccountRiskInput {
  total_capital: number;
  current_position_amount: number;
  plan_buy_amount: number;
  buy_price: number;
  stop_price: number;
}

/** 账户风险结果 */
export interface AccountRiskResult {
  stop_loss_pct: number;
  estimated_max_loss: number;
  account_risk_pct: number;
  t1_adjusted_risk_pct: number;
  risk_status: '正常' | '警告' | '危险';
}

/** 仓位计算输入 */
export interface PositionCalcInput {
  total_capital: number;
  single_risk_pct: number;
  stop_loss_pct: number;
  consecutive_losses: number;
  position_coefficient: number;
}

/** 仓位计算结果 */
export interface PositionCalcResult {
  raw_max_position: number;
  after_consecutive_loss: number;
  after_level_coefficient: number;
  final_max_position: number;
  halved_by_losses: boolean;
}

// ============ 风险拦截 ============

export type InterceptCondition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type InterceptType = 'hard' | 'hard_no_exception' | 'approvable';

/** 单条拦截结果 */
export interface InterceptResult {
  condition: InterceptCondition;
  triggered: boolean;
  intercept_type: InterceptType;
  message: string;
  details?: string;
}

/** 完整拦截检查结果 */
export interface RiskCheckResult {
  passed: boolean;
  blocked: boolean;
  approvable: boolean;
  violations: InterceptResult[];
  account_risk: AccountRiskResult;
  position: PositionCalcResult;
  final_level: FinalLevel;
}

// ============ 数据管理 ============

export interface DataAttribute {
  source: DataSource;
  fetch_time: Date;
  valid_until: Date;
  state: DataState;
}

export interface DataQualityResult {
  completeness: number;
  timeliness: number;
  reliability: number;
  total: number;
  cautious_mode: boolean;
}

// ============ 交易记录 ============

export interface AddRecord {
  time: string;
  price: number;
  qty: number;
}

export interface ReduceRecord {
  time: string;
  price: number;
  qty: number;
  reason: string;
}

export interface TradeRecord {
  trade_id: string;
  stock_code: string;
  stock_name?: string;
  buy_time: string;
  sell_time?: string;
  buy_price: number;
  sell_price?: number;
  position: number;
  stop_price?: number;
  profit_loss?: number;
  status: TradeStatus;
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
  sell_reason?: string;
  avg_cost?: number;
  add_records: AddRecord[];
  reduce_records: ReduceRecord[];
  is_violation: boolean;
  violation_reason?: string;
  decision_score?: number;
  stock_role?: StockRole;
}

// ============ 交易制度校验 ============

export type TradingSession =
  | 'pre_market'
  | 'call_auction'
  | 'morning'
  | 'lunch_break'
  | 'afternoon'
  | 'closing_auction'
  | 'after_hours'
  | 'closed';

export interface TradingCheckResult {
  is_trading_day: boolean;
  session: TradingSession;
  can_open_position: boolean;
  is_suspended: boolean;
  is_limit_up: boolean;
  is_limit_down: boolean;
  is_one_word_limit: boolean;
  sellable_qty: number;
  messages: string[];
}
