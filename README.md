# Private Auction

Private Auction is a React + Vite dapp for privacy-focused digital auctions. It combines a polished marketplace UI with a Hardhat smart contract that supports commit-reveal bidding on Sepolia.

The app can run in two modes:

- Local preview mode, when no contract address is configured. Created auctions are saved in browser local storage and bidding is simulated.
- On-chain mode, when `VITE_PRIVATE_AUCTION_ADDRESS` is set to a deployed `PrivateAuction` contract. Users can create auctions, commit private bids, reveal bids, settle auctions, and withdraw losing-bid refunds through MetaMask.

## Features

- Browse mock and user-created auctions.
- Create local preview auctions or Sepolia-backed auctions.
- Connect MetaMask and switch to Sepolia from the app.
- Commit bid hashes during the bidding phase.
- Reveal bid amount and salt during the reveal phase.
- Encrypt saved reveal data in browser storage with a key derived from the connected wallet signature.
- Settle completed auctions and withdraw refunds for losing revealed bids.
- Track created auctions and recent activity in the dashboard.

## Requirements

- Node.js
- npm
- MetaMask browser extension
- A Sepolia-funded Ethereum account for on-chain actions

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Vite will print a local URL, usually:

```bash
http://localhost:5173
```

Open that URL in a browser with MetaMask installed.

## Environment

Create a `.env` file from `.env.example`:

```bash
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id
DEPLOYER_PRIVATE_KEY=0xyour-private-key
VITE_PRIVATE_AUCTION_ADDRESS=0xyour-deployed-contract-address
```

`SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` are used by Hardhat deployment. `VITE_PRIVATE_AUCTION_ADDRESS` is used by the frontend to enable on-chain auction actions.

If `VITE_PRIVATE_AUCTION_ADDRESS` is missing or invalid, the app stays in local preview mode.

## Smart Contracts

The on-chain auction flow lives in `contracts/PrivateAuction.sol`.

The contract supports:

- Creating auctions with asset metadata, minimum bid, bidding duration, and reveal duration.
- Optional ERC-721 escrow when creating an auction directly against an NFT contract.
- Commit-reveal bidding, where bidders first submit a hash and later reveal the amount and salt.
- Winner settlement after the reveal window closes.
- Refund withdrawals for losing bidders who revealed their bids.
- Seller cancellation before any bids are committed.

The current frontend creates auctions with simple metadata and ETH settlement. NFT upload, minting, and full ERC-721 escrow flows are not implemented in the UI yet.

## Cryptographic Privacy

Private Auction uses a commit-reveal scheme for bid privacy:

1. During bidding, the frontend generates a random 32-byte salt in the browser.
2. The frontend computes the bid commitment locally with:

   ```text
   keccak256(auctionId, amountWei, salt, bidderAddress)
   ```

3. Only the commitment hash is sent to the smart contract during the bidding phase.
4. The bid amount and salt are encrypted in browser storage with AES-GCM. The encryption key is derived from a MetaMask message signature scoped to the contract address, auction ID, and wallet address.
5. During the reveal phase, the user signs the same local message so the app can decrypt the saved reveal data.
6. The app submits the bid amount and salt on-chain. The contract recomputes the commitment and accepts the reveal only if it matches the original hash.

This means bid amounts are hidden on-chain during the bidding phase. Revealed bids become public during the reveal phase because the contract must verify them and settle the auction.

The MetaMask signature used for local encryption does not submit a transaction or spend gas. It is used only to encrypt and decrypt the local reveal data for that wallet.

## Contract Commands

Compile contracts:

```bash
npm run compile:contracts
```

Run contract tests:

```bash
npm run test:contracts
```

Deploy to Sepolia:

```bash
npm run deploy:sepolia
```

After deployment, copy the deployed address into `VITE_PRIVATE_AUCTION_ADDRESS` and restart the Vite dev server.

## Build

```bash
npm run build
```

The production files are generated in the `dist` folder.

Preview the production build:

```bash
npm run preview
```

## Available Scripts

- `npm run dev` starts the Vite development server.
- `npm run build` creates a production build.
- `npm run preview` serves the production build locally.
- `npm run compile:contracts` compiles the Hardhat contracts.
- `npm run test:contracts` runs the contract test suite.
- `npm run deploy:sepolia` deploys `PrivateAuction` to Sepolia.

## Project Structure

- `index.html` is the Vite app entry HTML.
- `src/App.jsx` sets up routes, providers, and local auction state.
- `src/pages` contains the main screens: home, marketplace, auction details, create auction, dashboard, and how it works.
- `src/components` contains layout, auction cards, wallet controls, countdowns, and toast UI.
- `src/context/walletContext.jsx` manages MetaMask connection and Sepolia switching.
- `src/context/toastContext.jsx` manages global toast notifications.
- `src/contracts/privateAuction.js` contains the frontend ABI, ethers helpers, client-side commitment hashing, and encrypted reveal-data storage helpers.
- `src/data/auctions.js` contains mock auction and activity data.
- `src/styles.css` contains the main app styling.
- `contracts/PrivateAuction.sol` contains the commit-reveal auction smart contract.
- `scripts/deploy.js` deploys the contract with Hardhat.
- `test/PrivateAuction.js` covers the contract behavior.

## Wallet Safety

Each user must use their own MetaMask wallet and unlock MetaMask with their own password. The app does not know, store, or ask for MetaMask passwords or secret recovery phrases.

Never share your MetaMask password, private key, or secret recovery phrase with this app, another user, or the project owner. MetaMask handles wallet unlocks and transaction approvals inside the browser extension.

When committing or revealing a private bid, MetaMask may ask you to sign a local message. That signature is used to protect the reveal data in your browser and is not a transaction.

For the best experience, connect MetaMask to Sepolia. If the wallet is on another network, the app can prompt a network switch.

## Current Limitations

- Created auction previews are stored in the current browser's local storage, even for auctions created on-chain.
- Committed bid reveal data is encrypted and stored locally, so the same browser and wallet must be available to reveal it later. Clearing browser storage before reveal can prevent the UI from recovering the saved amount and salt.
- Commit-reveal hides bid amounts during bidding, but revealed bids become public during the reveal phase.
- If a bidder commits but never reveals, their bid cannot win because the contract cannot verify the hidden amount.
- The frontend does not currently fetch every auction from chain history; it displays mock data plus auctions created in the current browser.
- NFT image upload, minting, and full ERC-721 listing flows are not implemented in the UI yet.
