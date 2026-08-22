# Private Auction

Private Auction is a React + Vite frontend preview for a privacy-focused digital auction marketplace. Users can browse mock auctions, create local preview auctions, view dashboard activity, connect MetaMask, switch to Sepolia, and see wallet connection/disconnection notifications.

This is currently a frontend preview. Created auctions are stored in browser local storage, and bid submission does not send a blockchain transaction yet.

## Requirements

- Node.js
- npm
- MetaMask browser extension
- An Ethereum wallet account in MetaMask

## MetaMask Note

Each person who uses this project must use their own MetaMask wallet and unlock MetaMask with their own password. The app does not know, store, or ask for anyone's MetaMask password.

Never share your MetaMask password or secret recovery phrase with this app, with another user, or with the project owner. MetaMask handles wallet unlock and approval inside the browser extension.

For the best experience, connect MetaMask to the Sepolia test network. If the wallet is on another network, the app shows a warning and provides a switch option.

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

## Build

```bash
npm run build
```

The production files are generated in the `dist` folder.

## Preview Production Build

```bash
npm run preview
```

## Available Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run preview` serves the production build locally.

## Project Structure

- `src/App.jsx` sets up routes, wallet context, toast context, and local auction state.
- `src/context/walletContext.jsx` manages MetaMask connection, disconnection, Sepolia switching, and wallet notifications.
- `src/context/toastContext.jsx` manages global toast notifications.
- `src/components` contains layout, auction cards, wallet controls, countdowns, and toast UI.
- `src/pages` contains the main screens: home, marketplace, auction details, create auction, dashboard, and how it works.
- `src/data/auctions.js` contains mock auction data.
- `src/styles.css` contains the main app styling.

## Current Limitations

- Auctions created in the app are stored only in the current browser's local storage.
- Private bidding is staged locally for the preview.
- No real blockchain settlement or cryptographic bid privacy is implemented yet.
- Wallet connection is handled through MetaMask in the browser.
