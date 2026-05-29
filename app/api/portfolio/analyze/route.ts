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
 * Demo wallets used when the caller does not provide one — this keeps the
 * endpoint useful for agent callers that only want a sample analysis.
 */
const SAMPLE_WALLETS: Record<Chain, string> = {
  base: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth
  polygon: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  solana: "4s8XQC2WzRfgH8Xiep7ybnCW11VKRCMwxQF6jknx3VPf",
};

function defaultSampleWallet(chain: Chain): string {
  const override = process.env.DEFAULT_SAMPLE_WALLET?.trim();
  if (override) return override;
  return SAMPLE_WALLETS[chain];
}

/**
 * POST /api/portfolio/analyze — x402 v2 ($0.30 Base USDC or Solana USDC).
 * Body: { walletAddress?, chain?, riskTolerance? }
 *
 * All body fields are optional. When `walletAddress` is omitted the route
 * falls back to a public sample wallet so agent callers can demo the
 * endpoint; the response includes `mode: "sample"` in that case.
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const rawWallet =
      typeof body?.walletAddress === "string" ? body.walletAddress.trim() : "";
    const chain: Chain = CHAINS.includes(body?.chain as Chain)
      ? (body!.chain as Chain)
      : "base";
    const riskTolerance: RiskTolerance = RISK_LEVELS.includes(
      body?.riskTolerance as RiskTolerance,
    )
      ? (body!.riskTolerance as RiskTolerance)
      : "MEDIUM";

    const walletAddress = rawWallet || defaultSampleWallet(chain);
    const mode: "user" | "sample" = rawWallet ? "user" : "sample";

    const result = await analyzePortfolio(walletAddress, chain, riskTolerance);
    return NextResponse.json({ ...result, mode });
  } catch (err) {
    return NextResponse.json(
      {
        error: "ポートフォリオ分析中にエラーが発生しました",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
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
    description:
      "ウォレットのポートフォリオをスマートマネーシグナルと照合してAIが分析します",
    mimeType: "application/json",
  },
  x402Server,
);
