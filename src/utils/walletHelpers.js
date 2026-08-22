export const shortenAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const isMetaMaskInstalled = () => {
  return typeof window !== 'undefined' &&
    window.ethereum &&
    window.ethereum.isMetaMask;
};

export const formatAddress = (address) => {
  if (!address) return '0x...';
  return address;
};

export const getEthereumProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return window.ethereum;
  }
  return null;
};
