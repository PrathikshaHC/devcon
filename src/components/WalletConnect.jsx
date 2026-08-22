import { ArrowUpRight, LogOut } from 'lucide-react';
import { useWallet } from '../context/walletContext';

export default function WalletConnect() {
  const { account, isConnecting, notice, connectWallet, disconnectWallet, shortenAddress } = useWallet();

  if (account) {
    return (
      <div className="wallet-controls">
        <span className="wallet-button wallet-address" title={account}>
          <span className="status-dot" /> {shortenAddress(account)}
        </span>
        <button className="wallet-button disconnect-button" onClick={disconnectWallet}>
          <LogOut size={15} /> Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-controls">
      <button className="wallet-button" onClick={connectWallet} disabled={isConnecting}>
        <span className="status-dot" /> {isConnecting ? 'Connecting...' : 'Connect Wallet'} <ArrowUpRight size={15} />
      </button>
      {notice && <div className="wallet-notice">{notice}</div>}
    </div>
  );
}
