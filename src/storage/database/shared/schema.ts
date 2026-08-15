import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  boolean,
  numeric,
  text,
  jsonb,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";

export const healthCheck = pgTable("health_check", {
  id: integer().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

// 6.1 股票表
export const stock = pgTable(
  "stock",
  {
    stock_id: varchar("stock_id", { length: 10 }).primaryKey(),
    code: varchar("code", { length: 10 }).notNull().unique(),
    name: varchar("name", { length: 50 }).notNull(),
    market: varchar("market", { length: 20 }).notNull(),
    industry: varchar("industry", { length: 100 }),
    status: varchar("status", { length: 30 }).notNull().default("normal"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("stock_status_idx").on(table.status),
  ]
);

// 6.2 市场环境表
export const marketStatus = pgTable(
  "market_status",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    date: date("date").notNull().unique(),
    score: integer("score"),
    environment: varchar("environment", { length: 10 }),
    emotion_cycle: varchar("emotion_cycle", { length: 20 }),
    emotion_light_suggested: varchar("emotion_light_suggested", { length: 10 }),
    emotion_light_confirmed: varchar("emotion_light_confirmed", { length: 10 }),
    final_level: varchar("final_level", { length: 5 }),
    is_preview: boolean("is_preview").default(true).notNull(),
    confidence: integer("confidence"),
    raw_data: jsonb("raw_data"),
    data_quality: integer("data_quality"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("market_status_date_idx").on(table.date),
  ]
);

// 6.3 主线表
export const theme = pgTable(
  "theme",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    date: date("date").notNull(),
    theme_name: varchar("theme_name", { length: 100 }).notNull(),
    score: integer("score").notNull().default(0),
    capital_score: integer("capital_score").notNull().default(0),
    spread_score: integer("spread_score").notNull().default(0),
    policy_score: integer("policy_score").notNull().default(0),
    expectation_score: integer("expectation_score").notNull().default(0),
    recognition_score: integer("recognition_score").notNull().default(0),
    leader_performance_score: integer("leader_performance_score").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("theme_date_idx").on(table.date),
    index("theme_name_idx").on(table.theme_name),
  ]
);

// 6.4 股票评分表
export const stockScore = pgTable(
  "stock_score",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    date: date("date").notNull(),
    stock_code: varchar("stock_code", { length: 10 }).notNull(),
    theme: varchar("theme", { length: 100 }),
    leader_score: integer("leader_score").notNull().default(0),
    recognition: integer("recognition").notNull().default(0),
    capital: integer("capital").notNull().default(0),
    drive: integer("drive").notNull().default(0),
    technical: integer("technical").notNull().default(0),
    emotion: integer("emotion").notNull().default(0),
    risk_reward: integer("risk_reward").notNull().default(0),
    is_leader: boolean("is_leader").default(false).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("stock_score_date_idx").on(table.date),
    index("stock_score_code_idx").on(table.stock_code),
    index("stock_score_theme_idx").on(table.theme),
  ]
);

// 6.5 交易记录表
export const trade = pgTable(
  "trade",
  {
    trade_id: varchar("trade_id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    stock_code: varchar("stock_code", { length: 10 }).notNull(),
    stock_name: varchar("stock_name", { length: 50 }),
    buy_time: timestamp("buy_time", { withTimezone: true }).notNull(),
    sell_time: timestamp("sell_time", { withTimezone: true }),
    buy_price: numeric("buy_price", { precision: 10, scale: 3 }).notNull(),
    sell_price: numeric("sell_price", { precision: 10, scale: 3 }),
    position: integer("position").notNull(),
    stop_price: numeric("stop_price", { precision: 10, scale: 3 }),
    profit_loss: numeric("profit_loss", { precision: 12, scale: 2 }),
    status: varchar("status", { length: 10 }).notNull().default("open"),
    trade_mode: varchar("trade_mode", { length: 20 }),
    theme: varchar("theme", { length: 100 }),
    market_env: varchar("market_env", { length: 5 }),
    emotion_cycle: varchar("emotion_cycle", { length: 20 }),
    emotion_light: varchar("emotion_light", { length: 10 }),
    final_level: varchar("final_level", { length: 5 }),
    buy_reason: text("buy_reason"),
    buy_position_note: text("buy_position_note"),
    risk_note: text("risk_note"),
    exit_plan: text("exit_plan"),
    sell_reason: text("sell_reason"),
    avg_cost: numeric("avg_cost", { precision: 10, scale: 3 }),
    add_records: jsonb("add_records").default([]),
    reduce_records: jsonb("reduce_records").default([]),
    is_violation: boolean("is_violation").default(false).notNull(),
    violation_reason: text("violation_reason"),
    decision_score: integer("decision_score"),
    stock_role: varchar("stock_role", { length: 10 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("trade_stock_code_idx").on(table.stock_code),
    index("trade_status_idx").on(table.status),
    index("trade_buy_time_idx").on(table.buy_time),
    index("trade_final_level_idx").on(table.final_level),
  ]
);

// 账户配置表
export const accountConfig = pgTable(
  "account_config",
  {
    id: integer("id").primaryKey().default(1),
    total_capital: numeric("total_capital", { precision: 15, scale: 2 }).notNull().default("100000"),
    single_trade_risk_pct: numeric("single_trade_risk_pct", { precision: 5, scale: 3 }).notNull().default("0.008"),
    daily_risk_limit_pct: numeric("daily_risk_limit_pct", { precision: 5, scale: 3 }).notNull().default("0.02"),
    min_liquidity_amount: numeric("min_liquidity_amount", { precision: 15, scale: 2 }).notNull().default("50000000"),
    suspension_end_date: date("suspension_end_date"),
    consecutive_losses: integer("consecutive_losses").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

// AI分析记录表（市场分析/个股分析/交易复盘）
export const aiAnalysis = pgTable(
  "ai_analysis",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    analysis_type: varchar("analysis_type", { length: 20 }).notNull(), // market / stock / review
    stock_code: varchar("stock_code", { length: 10 }), // 个股分析/复盘时关联
    trade_id: varchar("trade_id", { length: 36 }), // 复盘时关联
    input_snapshot: jsonb("input_snapshot").notNull(), // 分析时的输入快照
    result: jsonb("result"), // 结构化分析结果
    raw_content: text("raw_content"), // AI原始流式输出
    model_id: varchar("model_id", { length: 100 }),
    tokens_used: integer("tokens_used"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_analysis_type_idx").on(table.analysis_type),
    index("ai_analysis_stock_idx").on(table.stock_code),
    index("ai_analysis_created_idx").on(table.created_at),
  ]
);

// 每日风险记录表
export const dailyRisk = pgTable(
  "daily_risk",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    date: date("date").notNull().unique(),
    total_risk_amount: numeric("total_risk_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total_risk_pct: numeric("total_risk_pct", { precision: 8, scale: 5 }).notNull().default("0"),
    trade_count: integer("trade_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("daily_risk_date_idx").on(table.date),
  ]
);
