import type { WalletClient } from "viem";

/**
 * Browser-side x402 payment client.
 *
 * Implements the x402 v1 `exact` EVM scheme: on a 402 response it signs an
 * EIP-3009 `transferWithAuthorization` (USDC) with the connected wallet,
 * encodes the payment payload into the `X-PAYMENT` header, and retries.
 */

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  asset: string;
  extra?: { name?: string; version?: string };
}

const CHAIN_IDS: Record<string, number> = {
  base: 8453,
  "base-sepolia": 84532,
  polygon: 137,
  "polygon-amoy": 80002,
};

export class PaymentError extends Error {}

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

async function buildPaymentHeader(
  requirements: PaymentRequirements,
  walletClient: WalletClient,
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new PaymentError("ウォレットアカウントが見つかりません");

  const chainId = CHAIN_IDS[requirements.network];
  if (!chainId) {
    throw new PaymentError(`未対応の決済ネットワークです: ${requirements.network}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address,
    to: requirements.payTo as `0x${string}`,
    value: requirements.maxAmountRequired,
    validAfter: "0",
    validBefore: String(now + (requirements.maxTimeoutSeconds ?? 60) + 60),
    nonce: randomNonce(),
  };

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: requirements.extra?.name ?? "USD Coin",
      version: requirements.extra?.version ?? "2",
      chainId,
      verifyingContract: requirements.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });

  const payload = {
    x402Version: 1,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: { signature, authorization },
  };
  return btoa(JSON.stringify(payload));
}

export interface X402FetchOptions {
  onPayment?: (requirements: PaymentRequirements) => void;
}

/**
 * fetch wrapper that transparently settles an x402 paywall.
 * `walletClient` must be a connected wallet (from wagmi's useWalletClient).
 */
export async function x402Fetch(
  url: string,
  init: RequestInit,
  walletClient: WalletClient | null | undefined,
  options: X402FetchOptions = {},
): Promise<Response> {
  const first = await fetch(url, init);
  if (first.status !== 402) return first;

  const challenge = (await first.json().catch(() => null)) as
    | { accepts?: PaymentRequirements[] }
    | null;
  const accepts = challenge?.accepts ?? [];
  const requirements =
    accepts.find((a) => a.scheme === "exact" && CHAIN_IDS[a.network]) ?? accepts[0];

  if (!requirements) {
    throw new PaymentError("サーバーから支払い要件を取得できませんでした");
  }
  if (!walletClient) {
    throw new PaymentError("分析を実行するにはウォレットを接続してください");
  }

  options.onPayment?.(requirements);
  const header = await buildPaymentHeader(requirements, walletClient);

  const headers = new Headers(init.headers);
  headers.set("X-PAYMENT", header);

  const paid = await fetch(url, { ...init, headers });
  if (paid.status === 402) {
    throw new PaymentError("決済の検証に失敗しました。USDC残高とネットワークをご確認ください");
  }
  return paid;
}
