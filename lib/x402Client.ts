import type { WalletClient } from "viem";

/**
 * Browser-side x402 payment client (multi-chain).
 *
 * On a 402 response it inspects the payment requirement's network and:
 *   - EVM (Base / Polygon / BNB Chain) → signs an EIP-3009
 *     `transferWithAuthorization` (EIP-712) with the connected EVM wallet.
 *   - Solana → signs the payment authorization with the connected Solana
 *     wallet (signMessage).
 * The signed payload is encoded into the `X-PAYMENT` header and the request
 * is retried.
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

/** Minimal shape of a connected Solana wallet (matches wallet-adapter's useWallet). */
export interface SolanaWalletLike {
  publicKey: { toBase58(): string } | null;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface WalletBundle {
  evm?: WalletClient | null;
  solana?: SolanaWalletLike | null;
}

const EVM_CHAIN_IDS: Record<string, number> = {
  base: 8453,
  "base-sepolia": 84532,
  polygon: 137,
  "polygon-amoy": 80002,
  bsc: 56,
  bnb: 56,
};

export class PaymentError extends Error {}

function isSolanaNetwork(network: string): boolean {
  return network.toLowerCase().startsWith("solana");
}

function evmChainId(network: string): number | null {
  if (EVM_CHAIN_IDS[network] != null) return EVM_CHAIN_IDS[network];
  const caip = /^eip155:(\d+)$/.exec(network);
  return caip ? Number(caip[1]) : null;
}

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/* --------------------------------- EVM --------------------------------- */

async function buildEvmPaymentHeader(
  req: PaymentRequirements,
  wallet: WalletClient | null | undefined,
): Promise<string> {
  if (!wallet?.account) {
    throw new PaymentError("分析を実行するにはEVMウォレットを接続してください");
  }
  const chainId = evmChainId(req.network);
  if (!chainId) {
    throw new PaymentError(`未対応の決済ネットワークです: ${req.network}`);
  }

  const account = wallet.account;
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address,
    to: req.payTo as `0x${string}`,
    value: req.maxAmountRequired,
    validAfter: "0",
    validBefore: String(now + (req.maxTimeoutSeconds ?? 300) + 60),
    nonce: randomNonce(),
  };

  const signature = await wallet.signTypedData({
    account,
    domain: {
      name: req.extra?.name ?? "USD Coin",
      version: req.extra?.version ?? "2",
      chainId,
      verifyingContract: req.asset as `0x${string}`,
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

  return btoa(
    JSON.stringify({
      x402Version: 1,
      scheme: req.scheme,
      network: req.network,
      payload: { signature, authorization },
    }),
  );
}

/* -------------------------------- Solana -------------------------------- */

async function buildSolanaPaymentHeader(
  req: PaymentRequirements,
  wallet: SolanaWalletLike | null | undefined,
): Promise<string> {
  if (!wallet?.publicKey) {
    throw new PaymentError("分析を実行するにはSolanaウォレットを接続してください");
  }
  if (!wallet.signMessage) {
    throw new PaymentError("このSolanaウォレットはメッセージ署名に対応していません");
  }

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: wallet.publicKey.toBase58(),
    to: req.payTo,
    value: req.maxAmountRequired,
    asset: req.asset,
    network: req.network,
    resource: req.resource,
    validBefore: String(now + (req.maxTimeoutSeconds ?? 300)),
    nonce: randomNonce(),
  };

  const signed = await wallet.signMessage(
    new TextEncoder().encode(JSON.stringify(authorization)),
  );

  return btoa(
    JSON.stringify({
      x402Version: 1,
      scheme: req.scheme,
      network: req.network,
      payload: { signature: bytesToBase64(signed), authorization },
    }),
  );
}

/* --------------------------------- fetch -------------------------------- */

export interface X402FetchOptions {
  onPayment?: (requirements: PaymentRequirements) => void;
}

/**
 * fetch wrapper that transparently settles an x402 paywall on any supported chain.
 */
export async function x402Fetch(
  url: string,
  init: RequestInit,
  wallets: WalletBundle,
  options: X402FetchOptions = {},
): Promise<Response> {
  const first = await fetch(url, init);
  if (first.status !== 402) return first;

  const challenge = (await first.json().catch(() => null)) as
    | { accepts?: PaymentRequirements[] }
    | null;
  const requirements = (challenge?.accepts ?? []).find((a) => a.scheme === "exact");
  if (!requirements) {
    throw new PaymentError("サーバーから支払い要件を取得できませんでした");
  }

  options.onPayment?.(requirements);
  const header = isSolanaNetwork(requirements.network)
    ? await buildSolanaPaymentHeader(requirements, wallets.solana)
    : await buildEvmPaymentHeader(requirements, wallets.evm);

  const headers = new Headers(init.headers);
  headers.set("X-PAYMENT", header);

  const paid = await fetch(url, { ...init, headers });
  if (paid.status === 402) {
    throw new PaymentError("決済の検証に失敗しました。残高とネットワークをご確認ください");
  }
  return paid;
}
