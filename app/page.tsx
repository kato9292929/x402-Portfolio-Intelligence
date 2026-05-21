"use client";

import { useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { Header } from "@/components/Header";
import { ResultView } from "@/components/ResultView";
import type { Chain, PortfolioAnalysis, RiskTolerance } from "@/lib/types";
import { PaymentError, x402Fetch } from "@/lib/x402Client";

const CHAINS: { id: Chain; label: string }[] = [
  { id: "solana", label: "Solana" },
  { id: "base", label: "Base" },
  { id: "polygon", label: "Polygon" },
];

const RISK_LEVELS: RiskTolerance[] = ["LOW", "MEDIUM", "HIGH"];

const PRICING = [
  { name: "ポートフォリオ分析", price: "$0.50", desc: "保有比率・リスク・スマートマネー整合をAIが総合分析" },
  { name: "履歴分析", price: "$0.30", desc: "90日間の価値変動とスマートマネーとの相関を可視化" },
  { name: "リバランスシミュレーション", price: "$0.50", desc: "提案適用後のリスク・リターンを予測" },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [walletAddress, setWalletAddress] = useState("");
  const [touched, setTouched] = useState(false);
  const [chain, setChain] = useState<Chain>("base");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("MEDIUM");

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<PortfolioAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!touched && address) setWalletAddress(address);
  }, [address, touched]);

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
          body: JSON.stringify({ walletAddress: walletAddress.trim(), chain, riskTolerance }),
        },
        walletClient,
        { onPayment: () => setStage("ポートフォリオをAIが分析中…") },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "分析に失敗しました");
      setResult(data as PortfolioAnalysis);
    } catch (err) {
      if (err instanceof PaymentError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  return (
    <>
      <Header />

      <section className="hero">
        <div className="container">
          <span className="eyebrow">x402 · DeFi INTELLIGENCE</span>
          <h1>
            PORTFOLIO <span className="accent">INTELLIGENCE</span>
          </h1>
          <p>
            ウォレットのポートフォリオをスマートマネーシグナルと照合してAIが分析する。
            リスク・流動性・乖離スコアからClaudeが次の一手を提案します。
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
            <label>チェーン</label>
            <div className="choice-row">
              {CHAINS.map((c) => (
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
            {loading ? "処理中…" : "分析する（$0.50）"}
          </button>

          <p className="form-note">
            {isConnected
              ? "x402決済（Base USDC）後に分析結果が表示されます"
              : "分析にはウォレット接続が必要です。右上から接続してください"}
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
        x402 Portfolio Intelligence · Powered by x402 · Nansen · Claude
      </footer>
    </>
  );
}
