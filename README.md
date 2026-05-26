# x402 Portfolio Intelligence

> AI-powered DeFi portfolio analysis behind the **x402 v2** payment protocol.
> **x402 v2** 決済プロトコルでゲートされた、AIによるDeFiポートフォリオ分析。

---

## English

### Overview

x402 Portfolio Intelligence analyzes any wallet's DeFi portfolio and returns
AI-powered rebalancing recommendations based on smart money signals. Pass a
wallet address, the app scores its risk, liquidity, and smart money
divergence, and Claude produces a "what to do next" recommendation.

The single paid endpoint is gated by the [x402](https://x402.org) v2 protocol.
Callers can settle in **Base USDC** (EIP-3009 transferWithAuthorization) or
**Solana USDC** — both legs are advertised in the same 402 challenge.

### Features

- **Portfolio analysis** — holdings, allocation, per-token risk / smart money /
  divergence scores, overall risk meter, and Claude-generated recommendations.
- **x402 v2 payment** — `withX402` from `@x402/next`; the browser signs an
  EIP-3009 authorization for Base, or a Solana payment authorization, and
  retries with the encoded `X-PAYMENT` header.
- **Multi-leg single endpoint** — one `accepts` array carries the Base and
  Solana legs; the client picks the leg matching the connected wallet.
- **Discovery** — `GET /.well-known/x402.json` lists every paid endpoint and
  its accepted payment legs for agent clients.
- **CDP facilitator** — when `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` are set,
  authenticates against the Coinbase Developer Platform x402 v2 facilitator.
- **Graceful fallbacks** — when provider keys are absent, deterministic
  simulated data keeps the product fully demoable.

### Tech stack

| Layer    | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) + React 19 |
| Payments  | `@x402/next` 2.13 (`withX402`), `@x402/core`, `@x402/evm`, `@x402/svm`, `@coinbase/x402` |
| Wallet    | wagmi + RainbowKit (EVM Base), Solana wallet-adapter — Phantom / Solflare |
| AI        | `@anthropic-ai/sdk` (Claude) |
| Data      | Helius (Solana), Alchemy (Base / Polygon), Nansen smart money |

### API surface

| Route | Method | Price | Body |
|-------|--------|-------|------|
| `/api/portfolio/analyze` | POST | $0.30 (Base USDC or Solana USDC) | `{ walletAddress, chain, riskTolerance }` |
| `/.well-known/x402.json` | GET | free | discovery document |

`chain` (the analyzed wallet's chain) is `"solana" \| "base" \| "polygon"`;
`riskTolerance` is `"LOW" \| "MEDIUM" \| "HIGH"`. The two payment legs map to
CAIP-2 networks:

- Base USDC → `eip155:8453`
- Solana USDC → `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`

The analysis pipeline runs in four steps:

1. Fetch wallet holdings via Helius / Alchemy.
2. Fetch each token's Nansen smart money score.
3. Run the Divergence Analyzer (smart money vs. market sentiment).
4. Claude produces the overall analysis and rebalancing recommendations.

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NANSEN_API_KEY=
ANTHROPIC_API_KEY=

# x402 v2 facilitator
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402

# Payout wallets
WALLET_ADDRESS_BASE=0xC67d94504696960bA0f2e7C3FeE703950734c00A
WALLET_ADDRESS_SOLANA=4s8XQC2WzRfgH8Xiep7ybnCW11VKRCMwxQF6jknx3VPf
# Backward-compat fallback for WALLET_ADDRESS_BASE
WALLET_ADDRESS=

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=placeholder
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

Facilitator selection order: `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` (CDP
production) → `FACILITATOR_URL` → `@x402/core` default. `ALCHEMY_API_KEY` and
`ANTHROPIC_MODEL` are optional; missing keys fall back to simulated data.

### Getting started

```bash
npm install
npm run build   # run before every commit
npm run dev     # http://localhost:3000
```

### Usage

1. Connect a wallet (top-right): an EVM wallet via RainbowKit (Base) and/or a
   Solana wallet (Phantom / Solflare). The chosen payment network needs a
   small USDC balance.
2. Enter a wallet address to analyze, pick the payment network (Base or
   Solana) and risk tolerance.
3. Press **分析する** — approve the x402 v2 payment in your wallet.
4. Review the pie chart, risk meter, smart money gauge, and recommendations.

### Disclaimer

This tool is for informational purposes only. Make your own investment
decisions. Smart money signals and AI analysis do not guarantee future results.

---

## 日本語

### 概要

x402 Portfolio Intelligence は、任意のウォレットのDeFiポートフォリオを分析し、
スマートマネーシグナルに基づいたAIによるリバランス提案を返します。ウォレット
アドレスを渡すと、リスク・流動性・スマートマネー乖離をスコアリングし、Claudeが
「今のポートフォリオをどう動かすべきか」を提案します。

有料エンドポイントは [x402](https://x402.org) **v2** プロトコルで保護されて
います。**Base USDC**（EIP-3009 transferWithAuthorization）または
**Solana USDC** のどちらでも決済可能で、両方とも同じ 402 チャレンジ内の
`accepts` 配列に含まれます。

### 主な機能

- **ポートフォリオ分析** — 保有比率、トークン別のリスク／スマートマネー／乖離
  スコア、総合リスクメーター、Claudeによるリバランス提案。
- **x402 v2 決済** — `@x402/next` の `withX402`。ブラウザが Base 用 EIP-3009
  または Solana の決済認可に署名し、`X-PAYMENT` ヘッダで再送します。
- **マルチレッグ単一エンドポイント** — 1つの `accepts` 配列で Base と Solana
  の2レッグを提示し、接続されたウォレットに応じてクライアントが選択します。
- **Discovery** — `GET /.well-known/x402.json` がエージェント向けに全有料
  エンドポイントと対応決済レッグを公開します。
- **CDP facilitator** — `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` を設定すると
  Coinbase Developer Platform の x402 v2 facilitator で認証します。
- **フォールバック** — プロバイダーのAPIキーが無い場合は決定論的な
  シミュレーションデータを使い、常にデモ可能な状態を保ちます。

### 技術スタック

| レイヤー | 技術 |
|----------|------|
| フレームワーク | Next.js 15（App Router）+ React 19 |
| 決済 | `@x402/next` 2.13（`withX402`）, `@x402/core`, `@x402/evm`, `@x402/svm`, `@coinbase/x402` |
| ウォレット | wagmi + RainbowKit（EVM Base）、Solana wallet-adapter（Phantom / Solflare） |
| AI | `@anthropic-ai/sdk`（Claude） |
| データ | Helius（Solana）、Alchemy（Base / Polygon）、Nansenスマートマネー |

### APIサーフェス

| ルート | メソッド | 価格 | ボディ |
|--------|---------|------|--------|
| `/api/portfolio/analyze` | POST | $0.30（Base USDC または Solana USDC） | `{ walletAddress, chain, riskTolerance }` |
| `/.well-known/x402.json` | GET | 無料 | discovery ドキュメント |

`chain`（分析対象ウォレットのチェーン）は `"solana" \| "base" \| "polygon"`、
`riskTolerance` は `"LOW" \| "MEDIUM" \| "HIGH"` です。2つの決済レッグは
CAIP-2 ネットワーク識別子で表現されます:

- Base USDC → `eip155:8453`
- Solana USDC → `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`

分析パイプラインは4ステップで実行されます。

1. Helius / Alchemy でウォレットの保有トークンを取得。
2. 各トークンのNansenスマートマネースコアを取得。
3. Divergence Analyzer を実行（スマートマネー vs 市場センチメント）。
4. Claudeが総合分析とリバランス提案を生成。

### 環境変数

`.env.example` を `.env.local` にコピーして設定します。

```
NANSEN_API_KEY=
ANTHROPIC_API_KEY=

# x402 v2 facilitator
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402

# 受取ウォレット
WALLET_ADDRESS_BASE=0xC67d94504696960bA0f2e7C3FeE703950734c00A
WALLET_ADDRESS_SOLANA=4s8XQC2WzRfgH8Xiep7ybnCW11VKRCMwxQF6jknx3VPf
# WALLET_ADDRESS_BASE 未設定時の後方互換フォールバック
WALLET_ADDRESS=

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=placeholder
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

facilitator は次の優先順で選択されます: `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET`
（CDP本番）→ `FACILITATOR_URL` → `@x402/core` の既定値。`ALCHEMY_API_KEY` と
`ANTHROPIC_MODEL` は任意です。未設定のキーはシミュレーションデータに
フォールバックします。

### セットアップ

```bash
npm install
npm run build   # コミット前に毎回実行
npm run dev     # http://localhost:3000
```

### 使い方

1. 右上からウォレットを接続します。EVM ウォレット（RainbowKit, Base）と Solana
   ウォレット（Phantom / Solflare）に対応しています。選択した決済ネットワークの
   USDC残高が必要です。
2. 分析対象のウォレットアドレスを入力し、決済ネットワーク（Base または Solana）
   とリスク許容度を選択します。
3. **分析する** を押し、ウォレットで x402 v2 決済を承認します。
4. 円グラフ・リスクメーター・スマートマネースコア・推奨アクションを確認します。

### 免責事項

本ツールは情報提供のみを目的としています。投資判断はご自身でお願いします。
スマートマネーシグナルおよびAIによる分析は将来の成果を保証するものではありません。
