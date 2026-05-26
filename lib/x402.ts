import type { FacilitatorConfig } from "@x402/core/server";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

/**
 * x402 v2 resource server shared across all paid routes.
 *
 * Facilitator selection order:
 *   1. CDP API keys (production, gas-sponsored)        — CDP_API_KEY_ID + CDP_API_KEY_SECRET
 *   2. Explicit URL                                     — FACILITATOR_URL
 *   3. Default (community facilitator at x402.org)
 *
 * `syncFacilitatorOnStart` is left at its default of `true` — disabling it
 * causes the Vercel runtime to skip the initial supported-kinds sync, which
 * yields 500s on the first request.
 */

const DEFAULT_PAY_TO_BASE = "0xC67d94504696960bA0f2e7C3FeE703950734c00A";
const DEFAULT_PAY_TO_SOLANA = "4s8XQC2WzRfgH8Xiep7ybnCW11VKRCMwxQF6jknx3VPf";

export const PAY_TO_BASE = (process.env.WALLET_ADDRESS_BASE ??
  process.env.WALLET_ADDRESS ??
  DEFAULT_PAY_TO_BASE) as `0x${string}`;

export const PAY_TO_SOLANA = process.env.WALLET_ADDRESS_SOLANA ?? DEFAULT_PAY_TO_SOLANA;

export const BASE_NETWORK = "eip155:8453" as const;
export const SOLANA_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const;

function buildFacilitatorConfig(): FacilitatorConfig {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  if (apiKeyId && apiKeySecret) {
    return createFacilitatorConfig(apiKeyId, apiKeySecret);
  }
  const url = process.env.FACILITATOR_URL;
  if (url && /^https?:\/\//.test(url)) {
    return { url };
  }
  return {};
}

const facilitatorClient = new HTTPFacilitatorClient(buildFacilitatorConfig());

export const x402Server = new x402ResourceServer(facilitatorClient);

registerExactEvmScheme(x402Server);
registerExactSvmScheme(x402Server);
