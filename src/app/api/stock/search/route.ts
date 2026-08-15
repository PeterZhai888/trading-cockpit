import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/services/stock-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/search?keyword=xxx
 * 关键字可以是股票代码（前缀匹配）或名称（模糊匹配）
 */
export async function GET(req: NextRequest) {
  try {
    const keyword = req.nextUrl.searchParams.get("keyword") || "";
    if (!keyword.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }
    const list = await searchStocks(keyword);
    return NextResponse.json({ success: true, data: list });
  } catch (e) {
    console.error("stock/search error:", e);
    const message = e instanceof Error ? e.message : "搜索失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
