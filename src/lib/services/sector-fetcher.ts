// 板块量化评分服务：从东方财富拉取申万二级行业板块的行情/资金/成分股，
// 自动计算主线评分中的「资金强度 / 板块扩散 / 龙头表现」三项。
// 持续性、市场认可度保留为半自动（AI 建议 + 用户手工调整）。

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const BASE = "https://push2delay.eastmoney.com/api/qt/clist/get";

export interface SectorItem {
  code: string; // BK0xxx
  name: string;
  change_pct: number;
}

export interface SectorScoreResult {
  sector_code: string;
  sector_name: string;
  // 原始量化指标
  metrics: {
    stock_count: number;
    up_count: number;
    down_count: number;
    flat_count: number;
    limit_up_count: number;
    total_amount_yi: number;
    main_net_inflow_yi: number;
    main_net_in_ratio_pct: number;
    leaders: Array<{
      code: string;
      name: string;
      change_pct: number;
      is_limit_up: boolean;
      seal_amount_yi: number;
      seal_to_amount_pct: number;
    }>;
    leaders_avg_change_pct: number;
    leaders_seal_to_amount_pct: number;
  };
  // 评分结果
  capital_score: number; // 0-25
  spread_score: number; // 0-20
  leader_performance_score: number; // 0-15
  // 量化依据（给 UI 展示）
  evidence: {
    capital: string;
    spread: string;
    leader: string;
  };
  source: string;
  fetched_at: string;
}

async function getJson<T>(url: string, retries = 3): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Referer: "https://quote.eastmoney.com/" },
      });
      clearTimeout(t);
      if (r.ok) return (await r.json()) as T;
    } catch {
      clearTimeout(t);
    }
    await new Promise((res) => setTimeout(res, 300 * (i + 1)));
  }
  return null;
}

/**
 * 获取行业板块列表（东财 m:90 t:2 是按行业分类的细分板块，共 ~496 个；
 * 其中 BK0xxx 是相对粗粒度的二级行业，约 50 个，作为短线主线选择够用）。
 */
export async function listSectors(): Promise<SectorItem[]> {
  const all: SectorItem[] = [];
  for (let pn = 1; pn <= 8; pn++) {
    const url =
      `${BASE}?pn=${pn}&pz=100&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=m:90+t:2&fields=f12,f14,f3`;
    const j = await getJson<{
      data?: { diff?: Array<{ f12: string; f14: string; f3: number | null }> };
    }>(url);
    const diff = j?.data?.diff || [];
    if (diff.length === 0) break;
    for (const x of diff) {
      // 只保留 BK0xxx 这类粗粒度板块，过滤 BK1xxx 细分概念
      if (x.f12.startsWith("BK0")) {
        all.push({
          code: x.f12,
          name: x.f14,
          change_pct: typeof x.f3 === "number" ? x.f3 : 0,
        });
      }
    }
    if (diff.length < 100) break;
  }
  // 按涨幅排序
  return all.sort((a, b) => b.change_pct - a.change_pct);
}

interface StockRow {
  f12: string; // code
  f14: string; // name
  f2?: number; // price
  f3?: number; // change pct
  f5?: number; // volume (手)
  f6?: number; // amount
  f62?: number; // 主力净流入
}

async function fetchSectorStocks(sectorCode: string): Promise<StockRow[]> {
  const out: StockRow[] = [];
  for (let pn = 1; pn <= 8; pn++) {
    const url =
      `${BASE}?pn=${pn}&pz=200&po=1&np=1&fltt=2&invt=2` +
      `&fid=f3&fs=b:${sectorCode}&fields=f12,f14,f2,f3,f5,f6,f62`;
    const j = await getJson<{
      data?: { total?: number; diff?: StockRow[] };
    }>(url);
    const diff = j?.data?.diff || [];
    if (diff.length === 0) break;
    out.push(...diff);
    if (out.length >= (j?.data?.total || 0)) break;
  }
  return out;
}

async function fetchSealAmount(
  code: string
): Promise<{ seal_amount: number; is_limit_up: boolean }> {
  const secid = code.startsWith("6") ? `1.${code}` : `0.${code}`;
  const url = `https://push2delay.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f47,f48,f57,f60,f168,f170`;
  const j = await getJson<{
    data?: {
      f43?: number; f44?: number; f47?: number; f48?: number;
      f60?: number; f168?: number; f170?: number;
    };
  }>(url);
  const d = j?.data;
  if (!d || d.f43 == null || d.f60 == null || d.f47 == null) {
    return { seal_amount: 0, is_limit_up: false };
  }
  // f43 = 最新价（×100），f44 = 最高，f60 = 昨收，f47 = 成交量（手），f48 = 成交额
  const price = d.f43 / 100;
  const prev = d.f60 / 100;
  const high = (d.f44 || 0) / 100;
  const chgPct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
  const isLimitUp =
    chgPct >= 9.8 && Math.abs(price - high) < 0.01 && price > 0;
  if (!isLimitUp) return { seal_amount: 0, is_limit_up: false };
  // f47 单位是手（=100 股）；买一挂单量估算方式：(成交量分布我们没有，只能用成交额/价格算总成交量，
  // 然后用"涨停时最后一档未成交挂单"作为封单。东财盘口 f31 才是封单，但需要额外接口；
  // 这里用 f47 与 f48 做兜底估算：假设当前所有以涨停价成交的量中一定比例未释放。
  // 短线实际场景下，更准确的封单来自涨停池接口 fund 字段，这里返回 0 让上层从涨停池拉。
  void d.f48;
  return { seal_amount: 0, is_limit_up: true };
}

interface ZTPoolRow {
  c: string; // code
  n: string;
  amount: number;
  fund: number; // 封单金额
  lbc: number;
  hybk?: string;
}

async function fetchZTPool(): Promise<ZTPoolRow[]> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url =
    "https://push2ex.eastmoney.com/getTopicZTPool" +
    `?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0` +
    `&pagesize=500&sort=fbt:asc&date=${date}`;
  const j = await getJson<{ data?: { pool?: ZTPoolRow[] } }>(url);
  return j?.data?.pool || [];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * 计算板块量化评分
 */
export async function scoreSector(
  sectorCode: string,
  sectorName: string
): Promise<SectorScoreResult> {
  const [stocks, ztPool] = await Promise.all([
    fetchSectorStocks(sectorCode),
    fetchZTPool(),
  ]);

  const total = stocks.length;
  let up = 0,
    down = 0,
    flat = 0,
    limUp = 0;
  let totalAmount = 0;
  let netInflow = 0;
  for (const s of stocks) {
    if (s.f3 == null) continue;
    if (s.f3 > 0) up++;
    else if (s.f3 < 0) down++;
    else flat++;
    if (s.f3 >= 9.9) limUp++;
    if (s.f6) totalAmount += s.f6;
    if (s.f62) netInflow += s.f62;
  }

  const totalAmountYi = totalAmount / 1e8;
  const netInflowYi = netInflow / 1e8;
  const netInRatio =
    totalAmount > 0 ? (netInflow / totalAmount) * 100 : 0;

  // 龙头股：按涨幅取前3
  const sorted = [...stocks]
    .filter((s) => s.f3 != null)
    .sort((a, b) => (b.f3 || 0) - (a.f3 || 0))
    .slice(0, 3);

  // 从涨停池找封单
  const ztMap = new Map<string, ZTPoolRow>();
  for (const z of ztPool) ztMap.set(z.c, z);

  const leaders = sorted.map((s) => {
    const chg = s.f3 || 0;
    const isLimitUp = chg >= 9.9;
    const zt = ztMap.get(s.f12);
    const sealAmount = zt?.fund || 0;
    const sealToAmount =
      isLimitUp && s.f6 && s.f6 > 0 ? (sealAmount / s.f6) * 100 : 0;
    return {
      code: s.f12,
      name: s.f14,
      change_pct: chg,
      is_limit_up: isLimitUp,
      seal_amount_yi: round2(sealAmount / 1e8),
      seal_to_amount_pct: round2(sealToAmount),
    };
  });

  const avgChange =
    leaders.reduce((a, b) => a + b.change_pct, 0) / (leaders.length || 1);
  const avgSealRatio =
    leaders.reduce((a, b) => a + b.seal_to_amount_pct, 0) /
    (leaders.length || 1);

  // ====== 评分公式 ======

  // 1) 资金强度（25分）
  //    - 板块主力净流入额：>50 亿得 10 分，>20 亿得 7 分，>5 亿得 4 分，>0 得 2 分，负流入 0 分
  //    - 净流入占成交额比（介入深度）：>10% 得 10 分，>5% 得 7 分，>2% 得 4 分，>0 得 2 分，负 0 分
  //    - 板块涨幅排名：>5% 得 5 分，>3% 得 4 分，>1% 得 2 分，>0 得 1 分
  let capAmount = 0;
  if (netInflowYi > 50) capAmount = 10;
  else if (netInflowYi > 20) capAmount = 7;
  else if (netInflowYi > 5) capAmount = 4;
  else if (netInflowYi > 0) capAmount = 2;
  let capRatio = 0;
  if (netInRatio > 10) capRatio = 10;
  else if (netInRatio > 5) capRatio = 7;
  else if (netInRatio > 2) capRatio = 4;
  else if (netInRatio > 0) capRatio = 2;
  const sectorChgPct =
    stocks.reduce((a, b) => a + (b.f3 || 0), 0) / (stocks.length || 1);
  let capRank = 0;
  if (sectorChgPct > 5) capRank = 5;
  else if (sectorChgPct > 3) capRank = 4;
  else if (sectorChgPct > 1) capRank = 2;
  else if (sectorChgPct > 0) capRank = 1;
  const capitalScore = clamp(capAmount + capRatio + capRank, 0, 25);

  // 2) 板块扩散（20分）
  //    - 上涨股占比 × 10
  //    - 涨停家数（≥10 给 10，≥5 给 8，≥3 给 6，≥1 给 4，0 给 0）
  const upRatio = total > 0 ? up / total : 0;
  const spreadUp = Math.round(upRatio * 10);
  let spreadLu = 0;
  if (limUp >= 10) spreadLu = 10;
  else if (limUp >= 5) spreadLu = 8;
  else if (limUp >= 3) spreadLu = 6;
  else if (limUp >= 1) spreadLu = 4;
  const spreadScore = clamp(spreadUp + spreadLu, 0, 20);

  // 3) 龙头表现（15分）
  //    - 龙头平均涨幅 × 5（≥10% 给满 5）
  //    - 龙头封单成交比（封单金额/成交额）：≥50% 给 10，≥20% 给 7，≥10% 给 5，≥5% 给 3，有涨停但没封单给 2
  const leaderChg = clamp(Math.round((avgChange / 10) * 5), 0, 5);
  let leaderSeal = 0;
  if (avgSealRatio >= 50) leaderSeal = 10;
  else if (avgSealRatio >= 20) leaderSeal = 7;
  else if (avgSealRatio >= 10) leaderSeal = 5;
  else if (avgSealRatio >= 5) leaderSeal = 3;
  else if (leaders.some((l) => l.is_limit_up)) leaderSeal = 2;
  const leaderScore = clamp(leaderChg + leaderSeal, 0, 15);

  return {
    sector_code: sectorCode,
    sector_name: sectorName,
    metrics: {
      stock_count: total,
      up_count: up,
      down_count: down,
      flat_count: flat,
      limit_up_count: limUp,
      total_amount_yi: round2(totalAmountYi),
      main_net_inflow_yi: round2(netInflowYi),
      main_net_in_ratio_pct: round2(netInRatio),
      leaders,
      leaders_avg_change_pct: round2(avgChange),
      leaders_seal_to_amount_pct: round2(avgSealRatio),
    },
    capital_score: capitalScore,
    spread_score: spreadScore,
    leader_performance_score: leaderScore,
    evidence: {
      capital: `主力净流入 ${netInflowYi.toFixed(2)}亿（占成交额 ${netInRatio.toFixed(
        2
      )}%），板块均涨 ${sectorChgPct.toFixed(2)}%`,
      spread: `上涨 ${up}/${total} 家（${(upRatio * 100).toFixed(
        1
      )}%），涨停 ${limUp} 家`,
      leader:
        leaders.length > 0
          ? `前${leaders.length}龙头均涨 ${avgChange.toFixed(
              2
            )}%，封单/成交 ${avgSealRatio.toFixed(2)}%（${leaders
              .map((l) => `${l.name}${l.is_limit_up ? "🔒" : ""}`)
              .join("、")}）`
          : "无明显龙头",
    },
    source: "eastmoney",
    fetched_at: new Date().toISOString(),
  };
}
