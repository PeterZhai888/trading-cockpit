import { NextResponse } from "next/server";
import { scoreSector } from "@/lib/services/sector-fetcher";

export const dynamic = "force-dynamic";

// POST /api/sector/score
// body: { sector_code: string; sector_name: string }
// 返回量化后的 3 项分数 + 依据，不直接保存主线
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sector_code?: string;
      sector_name?: string;
    };
    const code = (body.sector_code || "").trim();
    const name = (body.sector_name || "").trim();
    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: "sector_code 和 sector_name 必填" },
        { status: 400 }
      );
    }
    const result = await scoreSector(code, name);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error("sector score error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "板块评分失败" },
      { status: 502 }
    );
  }
}
