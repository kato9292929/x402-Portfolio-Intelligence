import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "x402-next";
import { simulateRebalance } from "@/lib/engine";
import { FACILITATOR, PAYMENT_NETWORK, PAY_TO_ADDRESS } from "@/lib/x402";

export const runtime = "nodejs";

/**
 * POST /api/portfolio/simulate — protected by withX402 ($0.50).
 * Body: { currentPortfolio: object, proposedChanges: object }
 * Projects risk / return / smart money alignment after a proposed rebalance.
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.currentPortfolio == null || body.proposedChanges == null) {
    return NextResponse.json(
      { error: "currentPortfolio と proposedChanges は必須です" },
      { status: 400 },
    );
  }

  try {
    const result = await simulateRebalance(body.currentPortfolio, body.proposedChanges);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "シミュレーション中にエラーが発生しました" }, { status: 500 });
  }
}

export const POST = withX402(
  handler,
  PAY_TO_ADDRESS,
  {
    price: "$0.50",
    network: PAYMENT_NETWORK,
    config: {
      description: "リバランス後のリスク・リターン予測シミュレーション",
      mimeType: "application/json",
    },
  },
  FACILITATOR,
);
