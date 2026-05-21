import type { NextRequest, NextResponse } from "next/server";
import { handleHistory, paymentChallenge, readJsonBody } from "@/lib/multichain";

export const runtime = "nodejs";

// USDT on BNB Chain (BEP-20). Note: 18 decimals, unlike 6-decimal USDC.
const USDT_BNB =
  process.env.NEXT_PUBLIC_USDT_BNB_CONTRACT ??
  "0x55d398326f99059fF775485246999027B3197955";

/**
 * POST /api/portfolio/history/bnb — BNB Chain USDT, manual x402 ($0.30).
 * withX402 cannot serve BNB: x402-next 1.2.0 has no "bnb" network.
 * Body: { walletAddress }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const challenge = paymentChallenge(req, {
    network: "eip155:56",
    asset: USDT_BNB,
    payTo: process.env.WALLET_ADDRESS ?? "",
    maxAmountRequired: "300000000000000000", // $0.30 — BSC USDT has 18 decimals
    description: "90日間のポートフォリオ履歴分析（BNB Chain USDT決済）",
  });
  if (challenge) return challenge;
  return handleHistory(await readJsonBody(req));
}
