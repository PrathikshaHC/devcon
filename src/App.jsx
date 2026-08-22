import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ToastViewport from './components/ToastViewport';
import { ToastProvider } from './context/toastContext';
import { WalletProvider } from './context/walletContext';
import { mockAuctions } from './data/auctions';

import AuctionDetails from './pages/AuctionDetails';
import CreateAuction from './pages/CreateAuction';
import Dashboard from './pages/Dashboard';
import HowItWorks from './pages/HowItWorks';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import Layout from './components/Layout';

function AppContent() {
  const [createdAuctions, setCreatedAuctions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('private-auctions') || '[]'); }
    catch (error) {
      console.error('Error loading auctions:', error);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('private-auctions', JSON.stringify(createdAuctions));
  }, [createdAuctions]);

  const auctions = [...createdAuctions, ...mockAuctions];

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auctions" element={<Marketplace auctions={auctions} />} />
      <Route path="/auctions/:auctionId" element={<AuctionDetails auctions={auctions} />} />
      <Route path="/create" element={
        <CreateAuction
          onCreate={(auction) => setCreatedAuctions((current) => [auction, ...current])}
        />
      } />
      <Route path="/dashboard" element={<Dashboard createdAuctions={createdAuctions} />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
    </Routes>
  );
}

function App() {
  return (
    <ToastProvider>
      <WalletProvider>
        <Router>
          <Layout>
            <AppContent />
          </Layout>
          <ToastViewport />
        </Router>
      </WalletProvider>
    </ToastProvider>
  );
}

export default App;
