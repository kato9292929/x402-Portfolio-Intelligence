import type { WalletClient } from "viem";

/**
 * Browser-side x402 v2 payment client (Base EVM + Solana).
 *
 * On a 402 response it inspects the payment requirement's network and:
 *   - EVM (eip155:NNNN) → signs an EIP-3009 `transferWithAuthorization`
 *     (EIP-712) with the connected EVM wallet.
 *   - Solana (solana:...) → signs the payment authorization with the
 *     connected Solana wallet via signMessage.
 *
 * The signed payload is encoded into the `X-PAYMENT` header and the
 * request is retried.
 */

interface PaymentRequirements {
  scheme: string;
  network: string;
  /** v2 servers send `amount`; older / cross-version servers may send `maxAmountRequired`. */
  amount?: string;
  maxAmountRequired?: string;
  resource: string;
  description?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  asset: string;
  extra?: { name?: string; version?: string; feePayer?: string };
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

export class PaymentError extends Error {}

function isSolanaNetwork(network: string): boolean {
  return network.toLowerCase().startsWith("solana");
}

function evmChainId(network: string): number | null {
  const caip = /^eip155:(\d+)$/.exec(network);
  if (caip) return Number(caip[1]);
  const legacy: Record<string, number> = {
    base: 8453,
    "base-sepolia": 84532,
    polygon: 137,
    "polygon-amoy": 80002,
    bsc: 56,
    bnb: 56,
  };
  return legacy[network] ?? null;
}

function amountOf(req: PaymentRequirements): string {
  return req.amount ?? req.maxAmountRequired ?? "0";
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
  if (!req.extra?.name || !req.extra?.version) {
    throw new PaymentError(
      `EIP-712 domain情報 (name, version) が支払い要件に含まれていません`,
    );
  }

  const account = wallet.account;
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: account.address,
    to: req.payTo as `0x${string}`,
    value: amountOf(req),
    validAfter: String(now - 600),
    validBefore: String(now + (req.maxTimeoutSeconds ?? 300)),
    nonce: randomNonce(),
  };

  const signature = await wallet.signTypedData({
    account,
    domain: {
      name: req.extra.name,
      version: req.extra.version,
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
      x402Version: 2,
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
    value: amountOf(req),
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
      x402Version: 2,
      scheme: req.scheme,
      network: req.network,
      payload: { signature: bytesToBase64(signed), authorization },
    }),
  );
}

/* --------------------------------- fetch -------------------------------- */

export interface X402FetchOptions {
  /** Preferred payment network if the server advertises multiple legs. */
  preferredNetwork?: string;
  onPayment?: (requirements: PaymentRequirements) => void;
}

function selectRequirement(
  accepts: PaymentRequirements[],
  preferred?: string,
): PaymentRequirements | undefined {
  const exact = accepts.filter((a) => a.scheme === "exact");
  if (preferred) {
    const match = exact.find((a) => a.network === preferred);
    if (match) return match;
  }
  return exact[0] ?? accepts[0];
}

/**
 * fetch wrapper that transparently settles an x402 v2 paywall.
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
  const accepts = challenge?.accepts ?? [];
  const requirements = selectRequirement(accepts, options.preferredNetwork);
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
