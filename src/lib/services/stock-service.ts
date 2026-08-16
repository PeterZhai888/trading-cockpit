import { getSupabaseClient } from "@/storage/database/supabase-client";

// 主板股票池种子数据（沪深主板常见标的，用于代码/名称联动）
// 第一阶段内置常用样本；后续可接入实时行情接口自动更新
const SEED_STOCKS: Array<{
  code: string;
  name: string;
  market: "SH" | "SZ";
  industry: string;
}> = [
  { code: "600519", name: "贵州茅台", market: "SH", industry: "白酒" },
  { code: "601318", name: "中国平安", market: "SH", industry: "保险" },
  { code: "600036", name: "招商银行", market: "SH", industry: "银行" },
  { code: "601888", name: "中国中免", market: "SH", industry: "免税零售" },
  { code: "600276", name: "恒瑞医药", market: "SH", industry: "医药" },
  { code: "601012", name: "隆基绿能", market: "SH", industry: "光伏" },
  { code: "600900", name: "长江电力", market: "SH", industry: "电力" },
  { code: "601398", name: "工商银行", market: "SH", industry: "银行" },
  { code: "600030", name: "中信证券", market: "SH", industry: "券商" },
  { code: "600887", name: "伊利股份", market: "SH", industry: "乳业" },
  { code: "601899", name: "紫金矿业", market: "SH", industry: "有色" },
  { code: "600050", name: "中国联通", market: "SH", industry: "通信" },
  { code: "601728", name: "中国电信", market: "SH", industry: "通信" },
  { code: "600028", name: "中国石化", market: "SH", industry: "石化" },
  { code: "601857", name: "中国石油", market: "SH", industry: "石油" },
  { code: "600000", name: "浦发银行", market: "SH", industry: "银行" },
  { code: "600019", name: "宝钢股份", market: "SH", industry: "钢铁" },
  { code: "600048", name: "保利发展", market: "SH", industry: "地产" },
  { code: "600690", name: "海尔智家", market: "SH", industry: "家电" },
  { code: "600438", name: "通威股份", market: "SH", industry: "光伏" },
  { code: "600809", name: "山西汾酒", market: "SH", industry: "白酒" },
  { code: "603259", name: "药明康德", market: "SH", industry: "CXO" },
  { code: "603288", name: "海天味业", market: "SH", industry: "调味品" },
  { code: "603501", name: "韦尔股份", market: "SH", industry: "半导体" },
  { code: "601127", name: "赛力斯", market: "SH", industry: "新能源车" },
  { code: "600585", name: "海螺水泥", market: "SH", industry: "建材" },
  { code: "600104", name: "上汽集团", market: "SH", industry: "汽车" },
  { code: "601225", name: "陕西煤业", market: "SH", industry: "煤炭" },
  { code: "601668", name: "中国建筑", market: "SH", industry: "建筑" },
  { code: "601600", name: "中国铝业", market: "SH", industry: "有色" },
  { code: "601669", name: "中国电建", market: "SH", industry: "建筑" },
  { code: "600150", name: "中国船舶", market: "SH", industry: "船舶" },
  { code: "600406", name: "国电南瑞", market: "SH", industry: "电网" },
  { code: "600436", name: "片仔癀", market: "SH", industry: "中药" },
  { code: "603986", name: "兆易创新", market: "SH", industry: "半导体" },
  { code: "603899", name: "晨光股份", market: "SH", industry: "文具" },
  { code: "000001", name: "平安银行", market: "SZ", industry: "银行" },
  { code: "000002", name: "万科A", market: "SZ", industry: "地产" },
  { code: "000333", name: "美的集团", market: "SZ", industry: "家电" },
  { code: "000651", name: "格力电器", market: "SZ", industry: "家电" },
  { code: "000858", name: "五粮液", market: "SZ", industry: "白酒" },
  { code: "002594", name: "比亚迪", market: "SZ", industry: "新能源车" },
  { code: "002475", name: "立讯精密", market: "SZ", industry: "消费电子" },
  { code: "002415", name: "海康威视", market: "SZ", industry: "安防" },
  { code: "000725", name: "京东方A", market: "SZ", industry: "面板" },
  { code: "002230", name: "科大讯飞", market: "SZ", industry: "AI" },
  { code: "002371", name: "北方华创", market: "SZ", industry: "半导体设备" },
  { code: "002241", name: "歌尔股份", market: "SZ", industry: "声学" },
  { code: "000063", name: "中兴通讯", market: "SZ", industry: "通信" },
  { code: "002714", name: "牧原股份", market: "SZ", industry: "养殖" },
  { code: "000568", name: "泸州老窖", market: "SZ", industry: "白酒" },
  { code: "000596", name: "古井贡酒", market: "SZ", industry: "白酒" },
  { code: "002304", name: "洋河股份", market: "SZ", industry: "白酒" },
  { code: "000338", name: "潍柴动力", market: "SZ", industry: "动力总成" },
  { code: "002460", name: "赣锋锂业", market: "SZ", industry: "锂矿" },
  { code: "002466", name: "天齐锂业", market: "SZ", industry: "锂矿" },
];

let seeded = false;

async function ensureSeed() {
  if (seeded) return;
  const supabase = getSupabaseClient();
  // 去重
  const seen = new Set<string>();
  const rows = SEED_STOCKS.filter((s) => {
    if (seen.has(s.code)) return false;
    seen.add(s.code);
    return true;
  }).map((s) => ({
    stock_id: s.code,
    code: s.code,
    name: s.name,
    market: s.market,
    industry: s.industry,
    status: "normal",
  }));
  // upsert，忽略重复
  const { error } = await supabase
    .from("stock")
    .upsert(rows, { onConflict: "code" });
  if (error) {
    console.error("stock seed error:", error);
  }
  seeded = true;
}

export interface StockSearchResult {
  code: string;
  name: string;
  market: string;
  industry: string | null;
}

/**
 * 搜索股票：优先通过东方财富实时搜索，失败后降级到本地数据库
 */
export async function searchStocks(
  keyword: string
): Promise<StockSearchResult[]> {
  const kw = (keyword || "").trim();
  if (!kw) return [];

  // 先尝试东方财富实时搜索（覆盖全市场）
  try {
    const remote = await searchStockFromEastMoney(kw);
    if (remote.length > 0) return remote;
  } catch {
    // 远程搜索失败，降级到本地
  }

  // 本地兜底
  await ensureSeed();
  const supabase = getSupabaseClient();
  const isCode = /^\d+$/.test(kw);
  let query = supabase
    .from("stock")
    .select("code, name, market, industry")
    .eq("status", "normal")
    .limit(50);

  if (isCode) {
    query = query.like("code", `${kw}%`);
  } else {
    query = query.like("name", `%${kw}%`);
  }
  const { data, error } = await query.order("code", { ascending: true });
  if (error) {
    console.error("searchStocks fallback error:", error);
    return [];
  }
  return (data || []) as unknown as StockSearchResult[];
}

/** 东方财富实时股票搜索 */
async function searchStockFromEastMoney(
  keyword: string
): Promise<StockSearchResult[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(
      `https://searchadapter.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=20`,
      { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    clearTimeout(t);
    if (!r.ok) return [];

    const j = (await r.json()) as {
      QuotationCodeTable?: {
        Data?: Array<{
          Code?: string;
          Name?: string;
          MarketType?: string;
          QuoteID?: string;
        }>;
      };
    };
    const data = j?.QuotationCodeTable?.Data;
    if (!data || data.length === 0) return [];

    return data
      .filter((d) => d.Code && d.Name)
      .map((d) => ({
        code: d.Code!,
        name: d.Name!,
        market: d.MarketType === "1" ? "SH" : "SZ",
        industry: null,
      }));
  } catch {
    clearTimeout(t);
    return [];
  }
}

/**
 * 精确查询单只股票：本地库没有时调东财兜底，并返回行业字段
 */
export async function getStockByCode(code: string): Promise<StockSearchResult | null> {
  const c = (code || "").trim();
  if (!/^\d{6}$/.test(c)) return null;
  await ensureSeed();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stock")
    .select("code, name, market, industry")
    .eq("code", c)
    .maybeSingle();
  if (error) {
    console.error("getStockByCode error:", error);
  }
  if (data && data.name && data.industry) {
    return data as unknown as StockSearchResult;
  }
  // 东财兜底
  const remote = await fetchStockFromEastMoney(c);
  if (remote) {
    // 异步落库
    supabase
      .from("stock")
      .upsert({
        stock_id: c,
        code: c,
        name: remote.name,
        market: remote.market,
        industry: remote.industry,
        status: "normal",
      }, { onConflict: "code" })
      .then((res: { error?: { message?: string } | null }) => {
        if (res.error) console.error("stock upsert error:", res.error.message);
      });
    return remote;
  }
  return (data as unknown as StockSearchResult) || null;
}

async function fetchStockFromEastMoney(
  code: string
): Promise<StockSearchResult | null> {
  const secid = code.startsWith("6") ? `1.${code}` : `0.${code}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(
      `https://push2delay.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f127`,
      { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const j = (await r.json()) as {
      data?: { f57?: string; f58?: string; f127?: string } | null;
    };
    const d = j.data;
    if (!d || !d.f58) return null;
    return {
      code,
      name: d.f58,
      market: code.startsWith("6") ? "SH" : "SZ",
      industry: (d.f127 || "").replace(/[ⅠⅡⅢⅣⅤ]/g, "").trim() || "未知",
    };
  } catch (e) {
    console.warn("fetchStockFromEastMoney failed:", code, e);
    return null;
  }
}

/**
 * 批量获取实时行情（最新价、涨跌幅、量比、换手率、成交额）
 */
export async function fetchStockQuotes(codes: string[]): Promise<Record<string, {
  price: number | null;
  change_pct: number | null;
  volume_ratio: number | null;
  turnover_rate: number | null;
  turnover_amount: number | null;
}>> {
  if (!codes.length) return {};
  const secids = codes.map(c => c.startsWith("6") ? `1.${c}` : `0.${c}`).join(",");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(
      `https://push2delay.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f6,f8,f10,f12,f14&secids=${secids}`,
      { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    clearTimeout(t);
    if (!r.ok) return {};
    const j = await r.json() as { data?: { diff?: Array<{
      f12?: string; f2?: number; f3?: number; f6?: number; f8?: number; f10?: number;
    }> } | null };
    const diff = j.data?.diff;
    if (!diff) return {};
    const result: Record<string, any> = {};
    for (const item of diff) {
      if (item.f12) {
        result[item.f12] = {
          price: item.f2 ?? null,
          change_pct: item.f3 ?? null,
          turnover_amount: item.f6 ?? null,
          turnover_rate: item.f8 ?? null,
          volume_ratio: item.f10 ?? null,
        };
      }
    }
    return result;
  } catch (e) {
    console.warn("fetchStockQuotes failed:", e);
    return {};
  }
}
