import { NextResponse } from "next/server";
import { listSectors } from "@/lib/services/sector-fetcher";

export const dynamic = "force-dynamic";

// GET /api/sector/list
// 获取行业板块列表（东财 BK0xxx 粗粒度板块），供前端选择主线板块
export async function GET() {
  try {
    const sectors = await listSectors();
    return NextResponse.json({
      success: true,
      data: { sectors, fetched_at: new Date().toISOString() },
    });
  } catch (e) {
    console.error("sector list error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "拉取板块列表失败" },
      { status: 502 }
    );
  }
}
