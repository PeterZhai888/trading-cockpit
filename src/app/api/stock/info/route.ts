import { NextRequest, NextResponse } from "next/server";
import { getStockByCode } from "@/lib/services/stock-service";

export const dynamic = "force-dynamic";

// GET /api/stock/info?code=600519
// 返回 code/name/market/industry；本地库没有则从东财兜底
export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "code 必须为 6 位数字" },
        { status: 400 }
      );
    }
    const stock = await getStockByCode(code);
    if (!stock) {
      return NextResponse.json(
        { success: false, error: "未找到该股票" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: stock });
  } catch (e) {
    console.error("stock/info error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "查询失败" },
      { status: 500 }
    );
  }
}
