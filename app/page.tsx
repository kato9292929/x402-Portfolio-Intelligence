"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { Header } from "@/components/Header";
import { ResultView } from "@/components/ResultView";
import {
  NETWORK_FOR,
  PAYMENT_CHAINS,
  analyzedChainFor,
  isSolanaChain,
  type PaymentChain,
} from "@/lib/payments";
import type { PortfolioAnalysis, RiskTolerance } from "@/lib/types";
import { PaymentError, x402Fetch } from "@/lib/x402Client";

const RISK_LEVELS: RiskTolerance[] = ["LOW", "MEDIUM", "HIGH"];

const PRICING = [
  {
    name: "ポートフォリオ分析",
    price: "$0.30",
    desc: "保有比率・リスク・スマートマネー整合をClaudeが分析（Base USDC または Solana USDC）",
  },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const solana = useWallet();

  const [walletAddress, setWalletAddress] = useState("");
  const [touched, setTouched] = useState(false);
  const [chain, setChain] = useState<PaymentChain>("solana");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("MEDIUM");

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<PortfolioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (touched) return;
    if (chain === "solana" && solana.publicKey) {
      setWalletAddress(solana.publicKey.toBase58());
    } else if (chain === "base" && address) {
      setWalletAddress(address);
    }
  }, [address, solana.publicKey, chain, touched]);

  async function analyze() {
    if (!walletAddress.trim()) {
      setError("ウォレットアドレスを入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStage("x402決済を処理中…");

    try {
      const res = await x402Fetch(
        "/api/portfolio/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: walletAddress.trim(),
            chain: analyzedChainFor(chain),
            riskTolerance,
          }),
        },
        { evm: walletClient, solana },
        {
          preferredNetwork: NETWORK_FOR[chain],
          onPayment: () => setStage("ポートフォリオをAIが分析中…"),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "分析に失敗しました");
      setResult(data as PortfolioAnalysis);
    } catch (err) {
      if (err instanceof PaymentError || err instanceof Error) setError(err.message);
      else setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  const walletReady = isSolanaChain(chain) ? solana.connected : isConnected;

  return (
    <>
      <Header />

      <section className="hero">
        <div className="container">
          <span className="eyebrow">x402 v2 · DeFi INTELLIGENCE</span>
          <h1>
            PORTFOLIO <span className="accent">INTELLIGENCE</span>
          </h1>
          <p>
            ウォレットのポートフォリオをスマートマネーシグナルと照合してAIが分析する。
            x402 v2でBase USDC / Solana USDC のどちらでも支払えます。
          </p>
        </div>
      </section>

      <main className="container">
        <div className="panel form-wrap">
          <div className="section-title">ウォレット分析</div>

          <div className="field">
            <label htmlFor="wallet">ウォレットアドレス</label>
            <input
              id="wallet"
              type="text"
              placeholder="0x... または Solana アドレス"
              value={walletAddress}
              onChange={(e) => {
                setTouched(true);
                setWalletAddress(e.target.value);
              }}
              spellCheck={false}
            />
          </div>

          <div className="field">
            <label>決済ネットワーク（USDC）</label>
            <div className="choice-row">
              {PAYMENT_CHAINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`choice ${chain === c.id ? "active" : ""}`}
                  onClick={() => setChain(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>リスク許容度</label>
            <div className="choice-row">
              {RISK_LEVELS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`choice ${riskTolerance === r ? "active" : ""}`}
                  onClick={() => setRiskTolerance(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={analyze} disabled={loading}>
            {loading ? "処理中…" : `分析する（$0.30 / ${chain === "solana" ? "Solana" : "Base"} USDC）`}
          </button>

          <p className="form-note">
            {walletReady
              ? "x402決済の承認後に分析結果が表示されます"
              : isSolanaChain(chain)
                ? "Solanaウォレットを接続してください（右上）"
                : "EVMウォレットを接続してください（右上）"}
          </p>

          {error && <div className="error-box">{error}</div>}
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>{stage || "処理中…"}</p>
          </div>
        )}

        {result && <ResultView analysis={result} />}

        <section className="pricing">
          <div className="section-title" style={{ textAlign: "center" }}>
            料金
          </div>
          <div className="price-grid">
            {PRICING.map((p) => (
              <div className="price-card" key={p.name}>
                <div className="pc-name">{p.name}</div>
                <div className="pc-price">{p.price}</div>
                <div className="pc-desc">{p.desc}</div>
              </div>
            ))}
          </div>

          <div className="disclaimer">
            免責事項: 本ツールは情報提供のみを目的としています。投資判断はご自身でお願いします。
            スマートマネーシグナルおよびAIによる分析は将来の成果を保証するものではありません。
          </div>
        </section>
      </main>

      <footer className="site-footer">
        x402 Portfolio Intelligence · Powered by x402 v2 · Nansen · Claude
      </footer>
    </>
  );
}
