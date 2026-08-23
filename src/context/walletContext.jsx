import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './toastContext';

// Create Context
const WalletContext = createContext(null);

// Helper: Shorten address
const shortenAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper: Check if MetaMask is installed
const isMetaMaskInstalled = () => {
  return typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask;
};

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [connectionIssue, setConnectionIssue] = useState(null);
  const [isMetaMaskInstalledState, setIsMetaMaskInstalledState] = useState(false);
  const lastDisconnectToastAt = useRef(0);
  const { showToast } = useToast();

  const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
  const DISCONNECT_MESSAGE = 'Disconnected from MetaMask for this site. To fully disconnect, open MetaMask and click Lock.';
  const REQUEST_ALREADY_PENDING_CODE = -32002;
  const USER_REJECTED_REQUEST_CODE = 4001;
  const CONNECT_CANCELLED_CODE = 'METAMASK_CONNECT_CANCELLED';
  const CONNECT_REQUEST_TIMEOUT_MS = 15000;

  const isUserRejectedRequest = (err) => {
    const message = String(err?.message || '').toLowerCase();
    return err?.code === USER_REJECTED_REQUEST_CODE || message.includes('user rejected');
  };

  const createConnectCancelledError = () => {
    const err = new Error('MetaMask connection was cancelled');
    err.code = CONNECT_CANCELLED_CODE;
    return err;
  };

  const requestAccountsWithCancelGuard = (ethereum) => {
    return new Promise((resolve, reject) => {
      let settled = false;
      let focusCheckId;

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.clearTimeout(focusCheckId);
        window.removeEventListener('focus', handleFocus);
      };

      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };

      const cancelIfNoAccountSelected = async () => {
        try {
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          if (!accounts.length) {
            settle(reject, createConnectCancelledError());
          }
        } catch (err) {
          settle(reject, err);
        }
      };

      const handleFocus = () => {
        window.clearTimeout(focusCheckId);
        focusCheckId = window.setTimeout(cancelIfNoAccountSelected, 700);
      };

      const timeoutId = window.setTimeout(() => {
        settle(reject, createConnectCancelledError());
      }, CONNECT_REQUEST_TIMEOUT_MS);

      window.addEventListener('focus', handleFocus);

      ethereum.request({ method: 'eth_requestAccounts' })
        .then((accounts) => settle(resolve, accounts))
        .catch((err) => settle(reject, err));
    });
  };

  const clearWalletState = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
    setError(null);
    setConnectionIssue(null);
  }, []);

  const resetWalletConnection = useCallback(() => {
    setIsConnecting(false);
    clearWalletState();
  }, [clearWalletState]);

  const showDisconnectToast = useCallback(() => {
    const now = Date.now();

    if (now - lastDisconnectToastAt.current < 1000) {
      return;
    }

    lastDisconnectToastAt.current = now;
    showToast({
      title: 'Disconnected from MetaMask',
      message: DISCONNECT_MESSAGE,
      type: 'info',
      duration: 7000
    });
  }, [showToast]);

  const handleDisconnect = useCallback(() => {
    clearWalletState();
    showDisconnectToast();
  }, [clearWalletState, showDisconnectToast]);

  // Check if MetaMask is installed
  useEffect(() => {
    setIsMetaMaskInstalledState(isMetaMaskInstalled());
  }, []);

  // Handle account changes
  const handleAccountsChanged = useCallback((accounts) => {
    if (accounts.length === 0) {
      // User disconnected in MetaMask
      handleDisconnect();
    } else {
      setAccount(accounts[0]);
      setIsConnected(true);
      setError(null);
    }
  }, [handleDisconnect]);

  // Handle chain changes
  const handleChainChanged = useCallback((chainId) => {
    setChainId(chainId);
    // Refresh page on network change (recommended by MetaMask)
    window.location.reload();
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (isMetaMaskInstalled()) {
      const ethereum = window.ethereum;
      
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
      ethereum.on('disconnect', handleDisconnect);

      // Check if already connected
      const checkConnection = async () => {
        try {
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
            const chain = await ethereum.request({ method: 'eth_chainId' });
            setChainId(chain);
          }
        } catch (err) {
          console.error('Error checking connection:', err);
        }
      };

      checkConnection();

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
        ethereum.removeListener('disconnect', handleDisconnect);
      };
    }
  }, [handleAccountsChanged, handleChainChanged, handleDisconnect]);

  // Connect wallet
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('Please install MetaMask');
      return;
    }

    setIsConnecting(true);
    setError(null);
    setConnectionIssue(null);

    try {
      const ethereum = window.ethereum;
      
      // Request accounts
      const accounts = await requestAccountsWithCancelGuard(ethereum);

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      setAccount(accounts[0]);
      setIsConnected(true);
      showToast({
        title: 'Wallet connected',
        message: `${shortenAddress(accounts[0])} is connected to this site.`,
        type: 'success'
      });

      // Get chain ID
      const chain = await ethereum.request({ method: 'eth_chainId' });
      setChainId(chain);

      // Check if on Sepolia
      if (chain !== SEPOLIA_CHAIN_ID) {
        setError('Please switch to Sepolia network');
        showToast({
          title: 'Wrong network',
          message: 'Switch to Sepolia before bidding.',
          type: 'warning'
        });
      } else {
        setError(null);
      }

    } catch (err) {
      console.error('Connection error:', err);
      clearWalletState();

      if (err.code === CONNECT_CANCELLED_CODE || isUserRejectedRequest(err)) {
        setError('Connection cancelled. Click Connect Wallet to try again.');
        setConnectionIssue('cancelled');
        showToast({
          title: 'Connection cancelled',
          message: 'MetaMask was closed before this site got wallet access. Try connecting again.',
          type: 'warning'
        });
      } else if (err.code === REQUEST_ALREADY_PENDING_CODE) {
        setError('MetaMask already has a pending request. Open MetaMask from the browser toolbar, then reject or approve it.');
        setConnectionIssue('pending');
        showToast({
          title: 'MetaMask request already open',
          message: 'Open MetaMask from the browser toolbar and close the pending request.',
          type: 'warning'
        });
      } else {
        setError(err.message || 'Failed to connect wallet');
        setConnectionIssue('failed');
        showToast({
          title: 'Connection failed',
          message: err.message || 'Failed to connect wallet.',
          type: 'error'
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect this dapp from MetaMask. Websites cannot lock MetaMask itself.
  const disconnectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      handleDisconnect();
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      });
      handleDisconnect();
    } catch (err) {
      console.error('Disconnect error:', err);
      if (err.code !== 4001) {
        setError(err.message || 'Failed to disconnect from MetaMask');
        handleDisconnect();
      }
    }
  };

  // Switch to Sepolia
  const switchToSepolia = async () => {
    if (!isMetaMaskInstalled()) {
      setError('Please install MetaMask');
      return;
    }

    try {
      const ethereum = window.ethereum;
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (err) {
      if (err.code === 4902) {
        // Add Sepolia if not added
        try {
          const ethereum = window.ethereum;
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Sepolia Test Network',
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'SepoliaETH',
                decimals: 18
              },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]
          });
        } catch (addErr) {
          console.error('Error adding Sepolia:', addErr);
          setError('Failed to add Sepolia network');
        }
      } else {
        console.error('Error switching network:', err);
        setError('Failed to switch to Sepolia');
      }
    }
  };

  // Check if on Sepolia
  const isOnSepolia = chainId === SEPOLIA_CHAIN_ID;

  // Context value
  const value = {
    account,
    chainId,
    isConnected,
    isConnecting,
    error,
    connectionIssue,
    isMetaMaskInstalled: isMetaMaskInstalledState,
    isOnSepolia,
    connectWallet,
    disconnectWallet,
    resetWalletConnection,
    switchToSepolia,
    shortenAddress,
    SEPOLIA_CHAIN_ID
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use wallet context
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export default WalletContext;
