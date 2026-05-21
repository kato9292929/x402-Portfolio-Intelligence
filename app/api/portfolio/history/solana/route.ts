import type { NextRequest, NextResponse } from "next/server";
import { handleHistory, paymentChallenge, readJsonBody } from "@/lib/multichain";

export const runtime = "nodejs";

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * POST /api/portfolio/history/solana — Solana USDC, manual x402 ($0.30).
 * withX402 is not used: settlement is on Solana, not Base.
 * Body: { walletAddress }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const challenge = paymentChallenge(req, {
    network: "solana-mainnet",
    asset: SOLANA_USDC,
    payTo: process.env.SOLANA_WALLET_ADDRESS ?? "",
    maxAmountRequired: "300000", // $0.30 — USDC has 6 decimals
    description: "90日間のポートフォリオ履歴分析（Solana USDC決済）",
  });
  if (challenge) return challenge;
  return handleHistory(await readJsonBody(req));
}
