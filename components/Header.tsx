"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <div className="brand">
          <div className="brand-mark">x4</div>
          <span className="brand-name">PORTFOLIO INTELLIGENCE</span>
        </div>
        <div className="wallet-buttons">
          <WalletMultiButton />
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </div>
    </header>
  );
}
