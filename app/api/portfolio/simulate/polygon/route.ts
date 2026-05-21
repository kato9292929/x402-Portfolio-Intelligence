import type { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";
import type { RouteConfig } from "x402/types";
import { handleSimulate, readJsonBody } from "@/lib/multichain";
import { FACILITATOR, PAY_TO_ADDRESS } from "@/lib/x402";

export const runtime = "nodejs";

// JPYC v2 on Polygon. Set NEXT_PUBLIC_JPYC_CONTRACT to the full 0x address.
const JPYC_POLYGON = (process.env.NEXT_PUBLIC_JPYC_CONTRACT ??
  "0x431D5dfF03120AFA4bDf332c61A6e1766eF37BF") as `0x${string}`;

async function handler(req: NextRequest): Promise<NextResponse> {
  return handleSimulate(await readJsonBody(req));
}

/**
 * POST /api/portfolio/simulate/polygon — Polygon USDC + JPYC ($0.50).
 * Add ?token=jpyc to pay in JPYC; defaults to native Polygon USDC.
 */
async function routeConfig(req: NextRequest): Promise<RouteConfig> {
  const token = new URL(req.url).searchParams.get("token")?.toLowerCase();
  if (token === "jpyc") {
    return {
      price: {
        amount: "75000000000000000000", // 75 JPYC (18 decimals)
        asset: {
          address: JPYC_POLYGON,
          decimals: 18,
          eip712: { name: "JPY Coin", version: "1" },
        },
      },
      network: "polygon",
      config: {
        description: "リバランスシミュレーション（Polygon JPYC決済）",
        mimeType: "application/json",
      },
    };
  }
  return {
    price: "$0.50",
    network: "polygon",
    config: {
      description: "リバランスシミュレーション（Polygon USDC決済）",
      mimeType: "application/json",
    },
  };
}

export const POST = withX402(handler, PAY_TO_ADDRESS, routeConfig, FACILITATOR);
