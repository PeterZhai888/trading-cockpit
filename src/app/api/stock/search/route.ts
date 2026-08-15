import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/services/stock-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/search?keyword=xxx
 * 股票代码/名称模糊搜索，返回匹配列表
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword") || "";
    if (!keyword.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }
    const list = await searchStocks(keyword.trim(), 10);
    return NextResponse.json({ success: true, data: list });
  } catch (e) {
    const message = e instanceof Error ? e.message : "搜索失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
