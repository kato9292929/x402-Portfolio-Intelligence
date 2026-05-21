import { NextResponse, type NextRequest } from "next/server";
import { analyzeHistory, analyzePortfolio, simulateRebalance } from "./engine";
import type { Chain, RiskTolerance } from "./types";

/**
 * Shared logic for the multi-chain payment sub-routes.
 *
 * The feature handlers below mirror the logic in the existing Base route.ts
 * files; the existing routes are intentionally left untouched. The payment
 * layer differs per chain:
 *   - Base / Polygon → withX402 (x402-next)
 *   - Solana / BNB Chain → manual 402 (withX402 has no "solana"/"bnb" network)
 */

const CHAINS: Chain[] = ["solana", "base", "polygon"];
const RISK_LEVELS: RiskTolerance[] = ["LOW", "MEDIUM", "HIGH"];

export async function readJsonBody(
  req: NextRequest,
): Promise<Record<string, unknown> | null> {
  return (await req.json().catch(() => null)) as Record<string, unknown> | null;
}

/* ----------------------------- feature handlers ----------------------------- */

export async function handleAnalyze(
  body: Record<string, unknown> | null,
): Promise<NextResponse> {
  if (!body) {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  const walletAddress =
    typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress は必須です" }, { status: 400 });
  }
  const chain: Chain = CHAINS.includes(body.chain as Chain) ? (body.chain as Chain) : "base";
  const riskTolerance: RiskTolerance = RISK_LEVELS.includes(body.riskTolerance as RiskTolerance)
    ? (body.riskTolerance as RiskTolerance)
    : "MEDIUM";
  try {
    return NextResponse.json(await analyzePortfolio(walletAddress, chain, riskTolerance));
  } catch {
    return NextResponse.json(
      { error: "ポートフォリオ分析中にエラーが発生しました" },
      { status: 500 },
    );
  }
}

export async function handleHistory(
  body: Record<string, unknown> | null,
): Promise<NextResponse> {
  const walletAddress =
    body && typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress は必須です" }, { status: 400 });
  }
  try {
    return NextResponse.json(await analyzeHistory(walletAddress));
  } catch {
    return NextResponse.json({ error: "履歴分析中にエラーが発生しました" }, { status: 500 });
  }
}

export async function handleSimulate(
  body: Record<string, unknown> | null,
): Promise<NextResponse> {
  if (!body || body.currentPortfolio == null || body.proposedChanges == null) {
    return NextResponse.json(
      { error: "currentPortfolio と proposedChanges は必須です" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await simulateRebalance(body.currentPortfolio, body.proposedChanges),
    );
  } catch {
    return NextResponse.json(
      { error: "シミュレーション中にエラーが発生しました" },
      { status: 500 },
    );
  }
}

/* ------------------------------- manual x402 ------------------------------- */

export interface ManualPaymentSpec {
  /** Network identifier advertised in the 402 challenge. */
  network: string;
  /** Token contract / mint address. */
  asset: string;
  /** Address that receives the payment. */
  payTo: string;
  /** Amount in the asset's atomic units. */
  maxAmountRequired: string;
  description: string;
}

/**
 * Returns an x402 402 challenge when no X-PAYMENT header is present, else null.
 *
 * Used for Solana and BNB Chain, which x402-next 1.2.0 cannot serve through
 * withX402 (`buildPaymentRequirements` throws "Unsupported network").
 */
export function paymentChallenge(
  req: NextRequest,
  spec: ManualPaymentSpec,
): NextResponse | null {
  if (req.headers.get("X-PAYMENT")) return null;

  return new NextResponse(
    JSON.stringify({
      x402Version: 1,
      error: "Payment Required",
      accepts: [
        {
          scheme: "exact",
          network: spec.network,
          maxAmountRequired: spec.maxAmountRequired,
          resource: req.url,
          description: spec.description,
          mimeType: "application/json",
          payTo: spec.payTo,
          maxTimeoutSeconds: 300,
          asset: spec.asset,
        },
      ],
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "x-payment, content-type",
      },
    },
  );
}
