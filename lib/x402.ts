import type { Address } from "viem";
import type { FacilitatorConfig, Resource } from "x402/types";

/**
 * Shared x402 configuration for the protected portfolio API routes.
 *
 * Payments settle on Base in USDC via the configured facilitator. The fallback
 * values keep `npm run build` working when the environment is not yet set up.
 */

export const PAY_TO_ADDRESS: Address =
  (process.env.WALLET_ADDRESS as Address | undefined) ??
  ("0x0000000000000000000000000000000000000000" as Address);

export const FACILITATOR: FacilitatorConfig = {
  url: (process.env.FACILITATOR_URL as Resource | undefined) ??
    ("https://x402.org/facilitator" as Resource),
};

/** x402 payments are denominated and settled on Base. */
export const PAYMENT_NETWORK = "base" as const;
