import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface StockSearchItem {
  code: string;
  name: string;
  market?: string;
  industry?: string;
  status?: string;
}

const FALLBACK_STOCKS: StockSearchItem[] = [
  { code: "600519", name: "贵州茅台", market: "sh", industry: "白酒" },
  { code: "601318", name: "中国平安", market: "sh", industry: "保险" },
  { code: "600036", name: "招商银行", market: "sh", industry: "银行" },
  { code: "601899", name: "紫金矿业", market: "sh", industry: "有色金属" },
  { code: "600900", name: "长江电力", market: "sh", industry: "电力" },
  { code: "601012", name: "隆基绿能", market: "sh", industry: "光伏" },
  { code: "600276", name: "恒瑞医药", market: "sh", industry: "医药" },
  { code: "601888", name: "中国中免", market: "sh", industry: "免税" },
  { code: "603259", name: "药明康德", market: "sh", industry: "医药" },
  { code: "601166", name: "兴业银行", market: "sh", industry: "银行" },
  { code: "600030", name: "中信证券", market: "sh", industry: "券商" },
  { code: "600809", name: "山西汾酒", market: "sh", industry: "白酒" },
  { code: "603288", name: "海天味业", market: "sh", industry: "调味品" },
  { code: "600887", name: "伊利股份", market: "sh", industry: "乳业" },
  { code: "601398", name: "工商银行", market: "sh", industry: "银行" },
  { code: "601988", name: "中国银行", market: "sh", industry: "银行" },
  { code: "601288", name: "农业银行", market: "sh", industry: "银行" },
  { code: "601939", name: "建设银行", market: "sh", industry: "银行" },
  { code: "600028", name: "中国石化", market: "sh", industry: "石化" },
  { code: "601857", name: "中国石油", market: "sh", industry: "石油" },
  { code: "600050", name: "中国联通", market: "sh", industry: "通信" },
  { code: "601728", name: "中国电信", market: "sh", industry: "通信" },
  { code: "600104", name: "上汽集团", market: "sh", industry: "汽车" },
  { code: "600690", name: "海尔智家", market: "sh", industry: "家电" },
  { code: "600031", name: "三一重工", market: "sh", industry: "机械" },
  { code: "600585", name: "海螺水泥", market: "sh", industry: "建材" },
  { code: "601668", name: "中国建筑", market: "sh", industry: "建筑" },
  { code: "600048", name: "保利发展", market: "sh", industry: "地产" },
  { code: "600660", name: "福耀玻璃", market: "sh", industry: "汽车零部件" },
  { code: "603501", name: "韦尔股份", market: "sh", industry: "半导体" },
  { code: "000001", name: "平安银行", market: "sz", industry: "银行" },
  { code: "000002", name: "万科A", market: "sz", industry: "地产" },
  { code: "000333", name: "美的集团", market: "sz", industry: "家电" },
  { code: "000651", name: "格力电器", market: "sz", industry: "家电" },
  { code: "000858", name: "五粮液", market: "sz", industry: "白酒" },
  { code: "002594", name: "比亚迪", market: "sz", industry: "新能源车" },
  { code: "002415", name: "海康威视", market: "sz", industry: "安防" },
  { code: "000725", name: "京东方A", market: "sz", industry: "面板" },
  { code: "002475", name: "立讯精密", market: "sz", industry: "电子" },
  { code: "300750", name: "宁德时代", market: "sz", industry: "电池", status: "excluded_non_mainboard" },
  { code: "300059", name: "东方财富", market: "sz", industry: "券商", status: "excluded_non_mainboard" },
  { code: "688981", name: "中芯国际", market: "sh", industry: "半导体", status: "excluded_non_mainboard" },
];

/**
 * 搜索股票：优先查数据库，数据库空时用兜底字典
 * 第二阶段接入行情源后，可在此函数内调用外部接口，前端无需改动
 */
export async function searchStocks(keyword: string, limit = 10): Promise<StockSearchItem[]> {
  const kw = keyword.trim();
  if (!kw) return [];

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('stock')
      .select('code,name,market,industry,status')
      .or(`code.ilike.%${kw}%,name.ilike.%${kw}%`)
      .limit(limit);

    if (!error && data && data.length > 0) {
      return data as StockSearchItem[];
    }
  } catch (e) {
    console.warn('[stock-service] DB query failed, using fallback dict:', e);
  }

  const lower = kw.toLowerCase();
  return FALLBACK_STOCKS.filter(
    (s) => s.code.includes(lower) || s.name.includes(kw)
  ).slice(0, limit);
}

export async function findStockByCode(code: string): Promise<StockSearchItem | null> {
  const c = code.trim();
  if (!c) return null;
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('stock')
      .select('code,name,market,industry,status')
      .eq('code', c)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as StockSearchItem;
  } catch (e) {
    console.warn('[stock-service] findStockByCode DB failed, using fallback:', e);
  }
  return FALLBACK_STOCKS.find((s) => s.code === c) || null;
}
