"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <div className="brand">
          <div className="brand-mark">x4</div>
          <span className="brand-name">PORTFOLIO INTELLIGENCE</span>
        </div>
        <ConnectButton
          showBalance={false}
          accountStatus="address"
          chainStatus="icon"
        />
      </div>
    </header>
  );
}
