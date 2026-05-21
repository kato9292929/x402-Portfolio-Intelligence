import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "x402-next";
import { analyzeHistory } from "@/lib/engine";
import { FACILITATOR, PAYMENT_NETWORK, PAY_TO_ADDRESS } from "@/lib/x402";

export const runtime = "nodejs";

/**
 * POST /api/portfolio/history — protected by withX402 ($0.30).
 * Body: { walletAddress: string }
 * Returns 90 days of portfolio value history and its smart money correlation.
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const walletAddress =
    body && typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress は必須です" }, { status: 400 });
  }

  try {
    const result = await analyzeHistory(walletAddress);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "履歴分析中にエラーが発生しました" }, { status: 500 });
  }
}

export const POST = withX402(
  handler,
  PAY_TO_ADDRESS,
  {
    price: "$0.30",
    network: PAYMENT_NETWORK,
    config: {
      description: "90日間のポートフォリオ価値変動とスマートマネーとの相関分析",
      mimeType: "application/json",
    },
  },
  FACILITATOR,
);
