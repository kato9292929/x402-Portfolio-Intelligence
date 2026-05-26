import { NextResponse, type NextRequest } from "next/server";
import {
  BASE_NETWORK,
  PAY_TO_BASE,
  PAY_TO_SOLANA,
  SOLANA_NETWORK,
} from "@/lib/x402";

export const runtime = "nodejs";

/**
 * GET /.well-known/x402.json — x402 v2 discovery document.
 *
 * Lists every paid endpoint with the accepted payment legs so agent
 * clients can discover what they can pay for and on which networks.
 */
export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    x402Version: 2,
    name: "x402 Portfolio Intelligence",
    description:
      "ウォレットのDeFiポートフォリオをスマートマネーシグナルと照合してAIが分析するx402 v2サービス",
    endpoints: [
      {
        method: "POST",
        resource: `${origin}/api/portfolio/analyze`,
        description:
          "ウォレットのポートフォリオをスマートマネーシグナルと照合してAIが分析します",
        mimeType: "application/json",
        accepts: [
          {
            scheme: "exact",
            network: BASE_NETWORK,
            price: "$0.30",
            payTo: PAY_TO_BASE,
            resource: `${origin}/api/portfolio/analyze`,
          },
          {
            scheme: "exact",
            network: SOLANA_NETWORK,
            price: "$0.30",
            payTo: PAY_TO_SOLANA,
            resource: `${origin}/api/portfolio/analyze`,
          },
        ],
      },
    ],
  });
}
