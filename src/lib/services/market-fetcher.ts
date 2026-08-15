/**
 * 市场原始数据实时抓取
 *
 * 数据源：东方财富 push2/push2ex 公开接口（与同花顺底层数据同源）
 * 口径（与用户确认后）：
 *  - 仅沪深 A 股，不含北交所
 *  - 涨跌停统计剔除 ST、*ST、退市股
 *  - 涨跌家数、成交额仍把 ST/退市计入（它们对情绪有影响）
 *  - 最高连板：使用"连续涨停天数 lbc"（更严格口径，同花顺 6 板会算成 5）
 *  - 炸板率 = 炸板数 / (涨停数 + 炸板数) × 100%，与同花顺涨停复盘口径一致
 */

export interface FetchedMarketData {
  trade_date: string; // YYYY-MM-DD
  up_count: number;
  down_count: number;
  flat_count: number;
  limit_up_count: number;
  limit_down_count: number;
  broken_limit_count: number;
  broken_limit_rate: number; // 百分比，保留 2 位
  max_consecutive_boards: number;
  total_amount_yi: number; // 亿元，保留 2 位
  /** 与 MarketRawData.total_turnover 对齐，单位元 */
  total_turnover: number;
  source: "eastmoney";
  fetched_at: string; // ISO
  warnings: string[];
}

interface EMReqOptions {
  timeout?: number;
  retries?: number;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function emJson<T>(url: string, opts: EMReqOptions = {}): Promise<T> {
  const timeout = opts.timeout ?? 8000;
  const retries = opts.retries ?? 2;
  let lastErr: unknown = null;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Referer: "https://quote.eastmoney.com/center/gridlist.html",
          Accept: "application/json, text/plain, */*",
        },
        signal: ctrl.signal,
        // @ts-expect-error - nextjs fetch polyfill supports keepAlive
        keepAlive: true,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      return JSON.parse(txt) as T;
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error
    ? new Error(`东财接口请求失败: ${lastErr.message}`)
    : new Error("东财接口请求失败");
}

function todayInCN(): string {
  // 东财接口按东八区自然日
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const cn = new Date(utc + 8 * 3600 * 1000);
  const y = cn.getFullYear();
  const m = String(cn.getMonth() + 1).padStart(2, "0");
  const d = String(cn.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function isExcludedFromLimit(name: string | undefined): boolean {
  if (!name) return false;
  return /ST|退|\*ST/i.test(name);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "-") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * 拉取涨跌停/炸板/最高连板
 * 接口 push2ex.eastmoney.com
 */
async function fetchLimitPools(date: string, warnings: string[]): Promise<{
  limitUp: number;
  limitDown: number;
  broken: number;
  maxLBC: number;
  rawUpTotal: number;
}> {
  const common =
    `ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=500` +
    `&sort=fbt:asc&date=${date}`;
  const [zt, dt, zb] = await Promise.all([
    emJson<{
      data?: { tc?: number; pool?: Array<{ n?: string; lbc?: number }> };
    }>(`https://push2ex.eastmoney.com/getTopicZTPool?${common}`),
    emJson<{ data?: { tc?: number } }>(
      `https://push2ex.eastmoney.com/getTopicDTPool?${common}`
    ),
    emJson<{ data?: { tc?: number } }>(
      `https://push2ex.eastmoney.com/getTopicZBPool?${common}`
    ),
  ]);

  const rawUpTotal = zt.data?.tc ?? 0;
  const upPool = zt.data?.pool ?? [];
  // 剔除 ST/退市
  const filteredUp = upPool.filter((x) => !isExcludedFromLimit(x.n));
  const excludedCount = upPool.length - filteredUp.length;
  if (excludedCount > 0) {
    warnings.push(`涨停池已剔除 ${excludedCount} 只 ST/退市股`);
  }
  const maxLBC = filteredUp.reduce((mx, x) => {
    const v = toNum(x.lbc) ?? 0;
    return v > mx ? v : mx;
  }, 0);

  return {
    limitUp: filteredUp.length,
    limitDown: dt.data?.tc ?? 0,
    broken: zb.data?.tc ?? 0,
    maxLBC,
    rawUpTotal,
  };
}

/**
 * 拉取全 A 涨跌家数 + 两市成交额
 * 用 push2delay（沙箱网络下更稳定）分页并发
 */
async function fetchMarketBreadth(): Promise<{
  up: number;
  down: number;
  flat: number;
  amountYi: number;
  total: number;
}> {
  const base =
    `https://push2delay.eastmoney.com/api/qt/clist/get` +
    `?pn={PN}&pz=100&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281` +
    `&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23` +
    `&fields=f2,f3,f6,f12,f14`;

  const first = await emJson<{
    data?: { total?: number; diff?: Array<{ f3?: unknown; f6?: unknown }> };
  }>(base.replace("{PN}", "1"));
  const total = first.data?.total ?? 0;
  if (!total) throw new Error("全 A 列表为空（可能非交易时段或数据源异常）");
  const pages = Math.ceil(total / 100);

  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);
  // 第一页已经拿到，直接复用
  const restPages = pageNumbers.slice(1);
  const results = await Promise.all(
    restPages.map((pn) =>
      emJson<{
        data?: { diff?: Array<{ f3?: unknown; f6?: unknown }> };
      }>(base.replace("{PN}", String(pn)), { retries: 1, timeout: 10000 })
    )
  );
  const allDiff = [
    ...(first.data?.diff ?? []),
    ...results.flatMap((r) => r.data?.diff ?? []),
  ];

  let up = 0;
  let down = 0;
  let flat = 0;
  let amount = 0;
  let valid = 0;
  for (const x of allDiff) {
    const pct = toNum(x.f3);
    const amt = toNum(x.f6);
    if (amt) amount += amt;
    if (pct === null) continue;
    valid++;
    if (pct > 0) up++;
    else if (pct < 0) down++;
    else flat++;
  }
  if (valid < total * 0.9) {
    // 数据不完整，不抛错但告警
    console.warn(
      `[market-fetcher] breadth 有效记录 ${valid}/${total}，可能存在缺失`
    );
  }
  return {
    up,
    down,
    flat,
    amountYi: Number((amount / 1e8).toFixed(2)),
    total: valid,
  };
}

export interface FetchMarketOptions {
  /** YYYYMMDD，不传则按东八区今天 */
  date?: string;
}

export async function fetchMarketFromEastMoney(
  options: FetchMarketOptions = {}
): Promise<FetchedMarketData> {
  const date = options.date ?? todayInCN();
  const warnings: string[] = [];

  const [limit, breadth] = await Promise.all([
    fetchLimitPools(date, warnings),
    fetchMarketBreadth(),
  ]);

  // 同花顺/东财涨停复盘标准口径：炸板率 = 炸板数 / (涨停数 + 炸板数)
  const ztForRate = limit.limitUp; // 已剔除 ST
  const brokenRate =
    ztForRate + limit.broken > 0
      ? Number(((limit.broken / (ztForRate + limit.broken)) * 100).toFixed(2))
      : 0;

  if (limit.rawUpTotal !== limit.limitUp) {
    warnings.push(
      `涨停原始 ${limit.rawUpTotal} 只，剔除 ST/退市后 ${limit.limitUp} 只`
    );
  }

  return {
    trade_date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    up_count: breadth.up,
    down_count: breadth.down,
    flat_count: breadth.flat,
    limit_up_count: limit.limitUp,
    limit_down_count: limit.limitDown,
    broken_limit_count: limit.broken,
    broken_limit_rate: brokenRate,
    max_consecutive_boards: limit.maxLBC,
    total_amount_yi: breadth.amountYi,
    total_turnover: Math.round(breadth.amountYi * 1e8),
    source: "eastmoney",
    fetched_at: new Date().toISOString(),
    warnings,
  };
}
