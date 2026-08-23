import { ethers } from 'ethers';

export const PRIVATE_AUCTION_ADDRESS = import.meta.env.VITE_PRIVATE_AUCTION_ADDRESS || '';

export const PRIVATE_AUCTION_ABI = [
  'event AuctionCreated(uint256 indexed auctionId, address indexed seller, address indexed assetContract, uint256 tokenId, uint256 minimumBid, uint64 biddingEndsAt, uint64 revealEndsAt)',
  'event BidCommitted(uint256 indexed auctionId, address indexed bidder, bytes32 commitmentHash)',
  'event BidRevealed(uint256 indexed auctionId, address indexed bidder, uint256 amount)',
  'event RefundWithdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount)',
  'event AuctionSettled(uint256 indexed auctionId, address indexed winner, uint256 winningBid)',
  'function createAuction(address assetContract, uint256 tokenId, string assetURI, uint256 minimumBid, uint64 biddingDuration, uint64 revealDuration, bool escrowAsset) external returns (uint256)',
  'function commitBid(uint256 auctionId, bytes32 commitmentHash) external',
  'function revealBid(uint256 auctionId, uint256 amount, bytes32 salt) external payable',
  'function settleAuction(uint256 auctionId) external',
  'function withdrawRefund(uint256 auctionId) external',
  'function hashBid(uint256 auctionId, uint256 amount, bytes32 salt, address bidder) external pure returns (bytes32)',
  'function getStatus(uint256 auctionId) external view returns (uint8)',
  'function auctions(uint256 auctionId) external view returns (address seller, address assetContract, uint256 tokenId, string assetURI, uint256 minimumBid, uint64 biddingEndsAt, uint64 revealEndsAt, bool assetEscrowed, bool settled, bool canceled, address highestBidder, uint256 highestBid, uint256 bidCount, uint256 revealedCount)',
];

const REVEAL_SECRET_VERSION = 2;

export const AUCTION_STATUS = {
  BIDDING: 0,
  REVEAL: 1,
  READY_TO_SETTLE: 2,
  SETTLED: 3,
  CANCELED: 4,
};

export function getContractAddress() {
  return PRIVATE_AUCTION_ADDRESS;
}

export function isContractConfigured() {
  return ethers.isAddress(PRIVATE_AUCTION_ADDRESS);
}

export async function getBrowserProvider() {
  if (!window.ethereum) {
    throw new Error('MetaMask is required for blockchain actions.');
  }

  return new ethers.BrowserProvider(window.ethereum);
}

export async function getPrivateAuctionContract({ signer = false } = {}) {
  if (!isContractConfigured()) {
    throw new Error('Set VITE_PRIVATE_AUCTION_ADDRESS to the deployed contract address.');
  }

  const provider = await getBrowserProvider();
  const runner = signer ? await provider.getSigner() : provider;

  return new ethers.Contract(PRIVATE_AUCTION_ADDRESS, PRIVATE_AUCTION_ABI, runner);
}

export function parseAuctionCreated(receipt) {
  const iface = new ethers.Interface(PRIVATE_AUCTION_ABI);

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);

      if (parsed?.name === 'AuctionCreated') {
        return parsed.args.auctionId.toString();
      }
    } catch {
      // Ignore logs from other contracts in the same transaction.
    }
  }

  return null;
}

export function makeBidCommitment({ auctionId, amountWei, salt, account }) {
  return ethers.solidityPackedKeccak256(
    ['uint256', 'uint256', 'bytes32', 'address'],
    [auctionId, amountWei, salt, account]
  );
}

export function makeBidStorageKey(contractAddress, auctionId, account) {
  return `private-auction-bid:${contractAddress.toLowerCase()}:${auctionId}:${account.toLowerCase()}`;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function assertBrowserCrypto() {
  if (!window.crypto?.subtle) {
    throw new Error('Browser cryptography is required to protect reveal secrets.');
  }
}

export function makeRevealKeyMessage({ contractAddress, auctionId, account }) {
  return [
    'Private Auction reveal key',
    `Contract: ${contractAddress.toLowerCase()}`,
    `Auction: ${auctionId}`,
    `Account: ${account.toLowerCase()}`,
    '',
    'Sign this message to encrypt or decrypt your local bid reveal data. This does not submit a transaction.',
  ].join('\n');
}

async function deriveRevealKey({ contractAddress, auctionId, account }) {
  assertBrowserCrypto();

  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  if (account && signerAddress.toLowerCase() !== account.toLowerCase()) {
    throw new Error('Connected wallet does not match the committed bid owner.');
  }

  const signature = await signer.signMessage(makeRevealKeyMessage({ contractAddress, auctionId, account: signerAddress }));
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));

  return window.crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function hasStoredCommittedBid({ contractAddress, auctionId, account }) {
  if (!account || !contractAddress) return false;

  return Boolean(localStorage.getItem(makeBidStorageKey(contractAddress, auctionId, account)));
}

export async function saveCommittedBid({ contractAddress, auctionId, account, amountEth, amountWei, salt }) {
  const key = await deriveRevealKey({ contractAddress, auctionId, account });
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({ amountEth, amountWei: amountWei.toString(), salt });
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(payload)
  );

  localStorage.setItem(
    makeBidStorageKey(contractAddress, auctionId, account),
    JSON.stringify({
      version: REVEAL_SECRET_VERSION,
      encrypted: true,
      algorithm: 'AES-GCM',
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    })
  );
}

export async function getCommittedBid({ contractAddress, auctionId, account }) {
  if (!account) return null;

  try {
    const stored = JSON.parse(localStorage.getItem(makeBidStorageKey(contractAddress, auctionId, account)) || 'null');

    if (!stored) return null;

    if (!stored.encrypted) {
      return stored;
    }

    const key = await deriveRevealKey({ contractAddress, auctionId, account });
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(stored.iv) },
      key,
      base64ToBytes(stored.ciphertext)
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

export function clearCommittedBid({ contractAddress, auctionId, account }) {
  if (!account) return;
  localStorage.removeItem(makeBidStorageKey(contractAddress, auctionId, account));
}
