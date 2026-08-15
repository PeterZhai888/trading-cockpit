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
 * 搜索股票：关键字可以是代码（前缀匹配）或名称（模糊匹配）
 */
export async function searchStocks(
  keyword: string
): Promise<StockSearchResult[]> {
  const kw = (keyword || "").trim();
  if (!kw) return [];
  await ensureSeed();
  const supabase = getSupabaseClient();

  const isCode = /^\d+$/.test(kw);
  let query = supabase
    .from("stock")
    .select("code, name, market, industry")
    .eq("status", "normal")
    .limit(15);

  if (isCode) {
    query = query.like("code", `${kw}%`);
  } else {
    query = query.like("name", `%${kw}%`);
  }
  const { data, error } = await query.order("code", { ascending: true });
  if (error) {
    console.error("searchStocks error:", error);
    return [];
  }
  return (data || []) as unknown as StockSearchResult[];
}
