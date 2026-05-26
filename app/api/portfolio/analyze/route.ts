import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "@x402/next";
import { analyzePortfolio } from "@/lib/engine";
import type { Chain, RiskTolerance } from "@/lib/types";
import {
  BASE_NETWORK,
  PAY_TO_BASE,
  PAY_TO_SOLANA,
  SOLANA_NETWORK,
  x402Server,
} from "@/lib/x402";

export const runtime = "nodejs";

const CHAINS: Chain[] = ["solana", "base", "polygon"];
const RISK_LEVELS: RiskTolerance[] = ["LOW", "MEDIUM", "HIGH"];

/**
 * POST /api/portfolio/analyze — protected by x402 v2 withX402 ($0.30).
 * Body: { walletAddress: string, chain: "solana"|"base"|"polygon", riskTolerance: "LOW"|"MEDIUM"|"HIGH" }
 *
 * Accepts payments on either Base USDC or Solana USDC.
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress は必須です" }, { status: 400 });
  }

  const chain: Chain = CHAINS.includes(body.chain as Chain) ? (body.chain as Chain) : "base";
  const riskTolerance: RiskTolerance = RISK_LEVELS.includes(body.riskTolerance as RiskTolerance)
    ? (body.riskTolerance as RiskTolerance)
    : "MEDIUM";

  try {
    const result = await analyzePortfolio(walletAddress, chain, riskTolerance);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "ポートフォリオ分析中にエラーが発生しました" }, { status: 500 });
  }
}

export const POST = withX402(
  handler,
  {
    accepts: [
      {
        scheme: "exact",
        network: BASE_NETWORK,
        price: "$0.30",
        payTo: PAY_TO_BASE,
      },
      {
        scheme: "exact",
        network: SOLANA_NETWORK,
        price: "$0.30",
        payTo: PAY_TO_SOLANA,
      },
    ],
    description: "ウォレットのポートフォリオをスマートマネーシグナルと照合してAIが分析します",
    mimeType: "application/json",
  },
  x402Server,
);
