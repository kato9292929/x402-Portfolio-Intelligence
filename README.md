# x402 Portfolio Intelligence

> AI-powered DeFi portfolio analysis gated by the x402 payment protocol.
> x402決済プロトコルでゲートされた、AIによるDeFiポートフォリオ分析。

---

## English

### Overview

x402 Portfolio Intelligence analyzes any wallet's DeFi portfolio and returns
AI-powered rebalancing recommendations based on smart money signals. Pass a
wallet address and the app scores its risk, liquidity, and smart money
divergence, then Claude generates a "what to do next" recommendation.

Every analysis endpoint is metered with the [x402](https://x402.org) payment
protocol — the client pays a small USDC amount on Base before results are
returned.

### Features

- **Portfolio analysis** — holdings, allocation, per-token risk / smart money /
  divergence scores, overall risk meter, and Claude-generated recommendations.
- **History analysis** — 90 days of portfolio value movement and its
  correlation with smart money activity.
- **Rebalance simulation** — projected risk / return / smart money alignment
  after applying the recommended changes.
- **x402 payments** — each route is protected by `withX402`; the browser signs
  an EIP-3009 `transferWithAuthorization` to settle.
- **Multi-chain payments** — pay on Base or Polygon (USDC / JPYC) via
  `withX402`, or on Solana (USDC) and BNB Chain (USDT) via a manual 402 flow.
- **Graceful fallbacks** — when provider keys are absent, deterministic
  simulated data keeps the product fully demoable.

### Tech stack

| Layer    | Technology |
|----------|------------|
| Framework | Next.js 15 (App Router) + React 19 |
| Payments  | x402-next (`withX402`), x402 client (`exact` EVM scheme) |
| Wallet    | wagmi + RainbowKit + viem |
| AI        | `@anthropic-ai/sdk` (Claude) |
| Data      | Helius (Solana), Alchemy (Base / Polygon), Nansen smart money |

### API routes

| Route | Price | Body |
|-------|-------|------|
| `POST /api/portfolio/analyze` | $0.50 | `{ walletAddress, chain, riskTolerance }` |
| `POST /api/portfolio/history` | $0.30 | `{ walletAddress }` |
| `POST /api/portfolio/simulate` | $0.50 | `{ currentPortfolio, proposedChanges }` |

`chain` (the analyzed wallet's chain) is `"solana" | "base" | "polygon"`;
`riskTolerance` is `"LOW" | "MEDIUM" | "HIGH"`.

### Multi-chain payments

The base routes above settle in **USDC on Base** via `withX402`. Each route
also has chain-specific sub-routes so the caller can pay on another network:

| Sub-route | Payment chain | Token | x402 |
|-----------|---------------|-------|------|
| `…/analyze` (base) | Base | USDC | withX402 |
| `…/analyze/polygon` | Polygon | USDC · JPYC | withX402 |
| `…/analyze/solana` | Solana | USDC | manual 402 |
| `…/analyze/bnb` | BNB Chain | USDT | manual 402 |

The same `/polygon`, `/solana`, `/bnb` sub-routes exist for `history` and
`simulate`. On the Polygon sub-routes, add `?token=jpyc` to pay in JPYC
instead of USDC. Solana and BNB Chain use a hand-built 402 challenge because
x402-next 1.2.0's `withX402` supports neither network.

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
WALLET_ADDRESS=                  # EVM payout (Base / Polygon / BNB)
SOLANA_WALLET_ADDRESS=           # Solana payout (base58)
FACILITATOR_URL=https://api.developer.coinbase.com/rpc/v1/base/facilitator
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=placeholder
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_JPYC_CONTRACT=0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB
NEXT_PUBLIC_USDT_BNB_CONTRACT=0x55d398326f99059fF775485246999027B3197955
```

`WALLET_ADDRESS` receives EVM x402 payments; `SOLANA_WALLET_ADDRESS` receives
Solana payments. `ALCHEMY_API_KEY` and `ANTHROPIC_MODEL` are optional. Any
missing key falls back to simulated data.

### Getting started

```bash
npm install
npm run build   # run before every commit
npm run dev     # http://localhost:3000
```

### Usage

1. Connect a wallet (top-right) — needs USDC on Base to pay.
2. Enter a wallet address, pick a chain and risk tolerance.
3. Press **分析する** — approve the x402 payment in your wallet.
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

すべての分析エンドポイントは [x402](https://x402.org) 決済プロトコルで従量課金
されており、結果を返す前にBase上のUSDCで少額を支払います。

### 主な機能

- **ポートフォリオ分析** — 保有比率、トークン別のリスク／スマートマネー／乖離
  スコア、総合リスクメーター、Claudeによるリバランス提案。
- **履歴分析** — 90日間のポートフォリオ価値変動と、スマートマネー活動との
  相関分析。
- **リバランスシミュレーション** — 推奨変更を適用した後のリスク・リターン・
  スマートマネー整合の予測。
- **x402決済** — 各ルートは `withX402` で保護され、ブラウザが EIP-3009 の
  `transferWithAuthorization` に署名して決済します。
- **マルチチェーン決済** — Base・Polygon（USDC / JPYC）は `withX402`、Solana
  （USDC）と BNB Chain（USDT）は手動 402 フローで決済できます。
- **フォールバック** — プロバイダーのAPIキーが無い場合は決定論的な
  シミュレーションデータを使い、常にデモ可能な状態を保ちます。

### 技術スタック

| レイヤー | 技術 |
|----------|------|
| フレームワーク | Next.js 15（App Router）+ React 19 |
| 決済 | x402-next（`withX402`）、x402 client（`exact` EVMスキーム） |
| ウォレット | wagmi + RainbowKit + viem |
| AI | `@anthropic-ai/sdk`（Claude） |
| データ | Helius（Solana）、Alchemy（Base / Polygon）、Nansenスマートマネー |

### APIルート

| ルート | 価格 | ボディ |
|--------|------|--------|
| `POST /api/portfolio/analyze` | $0.50 | `{ walletAddress, chain, riskTolerance }` |
| `POST /api/portfolio/history` | $0.30 | `{ walletAddress }` |
| `POST /api/portfolio/simulate` | $0.50 | `{ currentPortfolio, proposedChanges }` |

`chain`（分析対象ウォレットのチェーン）は `"solana" | "base" | "polygon"`、
`riskTolerance` は `"LOW" | "MEDIUM" | "HIGH"` です。

### マルチチェーン決済

上記のベースルートは `withX402` で **Base上のUSDC** で決済します。各ルートには
チェーン別のサブルートがあり、別ネットワークで支払えます。

| サブルート | 決済チェーン | トークン | x402 |
|-----------|------------|---------|------|
| `…/analyze`（base） | Base | USDC | withX402 |
| `…/analyze/polygon` | Polygon | USDC・JPYC | withX402 |
| `…/analyze/solana` | Solana | USDC | manual 402 |
| `…/analyze/bnb` | BNB Chain | USDT | manual 402 |

`history`・`simulate` にも同じ `/polygon`・`/solana`・`/bnb` サブルートが
あります。Polygon サブルートでは `?token=jpyc` を付けると JPYC で支払えます。
Solana と BNB Chain は x402-next 1.2.0 の `withX402` が両ネットワークに
非対応のため、手動で 402 チャレンジを返します。

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
WALLET_ADDRESS=                  # EVM決済の受取先（Base / Polygon / BNB）
SOLANA_WALLET_ADDRESS=           # Solana決済の受取先（base58）
FACILITATOR_URL=https://api.developer.coinbase.com/rpc/v1/base/facilitator
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=placeholder
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_JPYC_CONTRACT=0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB
NEXT_PUBLIC_USDT_BNB_CONTRACT=0x55d398326f99059fF775485246999027B3197955
```

`WALLET_ADDRESS` がEVMのx402決済受取先、`SOLANA_WALLET_ADDRESS` がSolanaの
受取先です。`ALCHEMY_API_KEY` と `ANTHROPIC_MODEL` は任意です。未設定のキーは
シミュレーションデータにフォールバックします。

### セットアップ

```bash
npm install
npm run build   # コミット前に毎回実行
npm run dev     # http://localhost:3000
```

### 使い方

1. 右上からウォレットを接続します（決済にはBase上のUSDCが必要です）。
2. ウォレットアドレスを入力し、チェーンとリスク許容度を選択します。
3. **分析する** を押し、ウォレットでx402決済を承認します。
4. 円グラフ・リスクメーター・スマートマネースコア・推奨アクションを確認します。

### 免責事項

本ツールは情報提供のみを目的としています。投資判断はご自身でお願いします。
スマートマネーシグナルおよびAIによる分析は将来の成果を保証するものではありません。
