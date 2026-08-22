import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, ExternalLink, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/walletContext';
import './ConnetWallet.css';

const ConnectWallet = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy address');
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const {
    account,
    chainId,
    isConnected,
    isConnecting,
    error,
    notice,
    isMetaMaskInstalled,
    isOnSepolia,
    connectWallet,
    disconnectWallet,
    switchToSepolia,
    shortenAddress
  } = useWallet();

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setIsMenuOpen(false);
    }
  }, [isConnected]);

  const copyAddress = async () => {
    if (!account) return;

    try {
      await navigator.clipboard.writeText(account);
      setCopyLabel('Copied');
      setTimeout(() => setCopyLabel('Copy address'), 1400);
    } catch (err) {
      setCopyLabel('Copy failed');
      setTimeout(() => setCopyLabel('Copy address'), 1400);
    }
  };

  const handleDisconnect = async () => {
    setIsMenuOpen(false);
    await disconnectWallet();
    navigate('/');
  };

  if (!isMetaMaskInstalled) {
    return (
      <div className="wallet-container">
        <button
          className="wallet-btn wallet-btn-error"
          onClick={() => window.open('https://metamask.io/download/', '_blank')}
        >
          Install MetaMask
        </button>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="wallet-container">
        <button className="wallet-btn wallet-btn-loading" disabled>
          Connecting...
        </button>
      </div>
    );
  }

  if (isConnected && account) {
    return (
      <div className="wallet-container" ref={menuRef}>
        <button
          className="wallet-account-trigger"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <span className="wallet-dot" />
          <span>{shortenAddress(account)}</span>
          <span className={isOnSepolia ? 'wallet-network' : 'wallet-network warning'}>
            {isOnSepolia ? 'Sepolia' : `Chain ${chainId || '?'}`}
          </span>
          <ChevronDown size={15} />
        </button>

        {isMenuOpen && (
          <div className="wallet-menu" role="menu">
            {!isOnSepolia && (
              <button className="wallet-menu-item warning" onClick={switchToSepolia} role="menuitem">
                Switch to Sepolia
              </button>
            )}
            <button className="wallet-menu-item" onClick={copyAddress} role="menuitem">
              <Copy size={15} />
              {copyLabel}
            </button>
            <a
              className="wallet-menu-item"
              href={`https://sepolia.etherscan.io/address/${account}`}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
            >
              <ExternalLink size={15} />
              View on Etherscan
            </a>
            <button className="wallet-menu-item danger" onClick={handleDisconnect} role="menuitem">
              <LogOut size={15} />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <button
        className="wallet-btn wallet-btn-primary"
        onClick={connectWallet}
      >
        Connect Wallet
      </button>
      {error && <div className="wallet-error">{error}</div>}
      {notice && <div className="wallet-notice">{notice}</div>}
    </div>
  );
};

export default ConnectWallet;
