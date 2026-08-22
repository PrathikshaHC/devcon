import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import ConnectWallet from './Wallet/ConnectWallet';

const navItems = [
  ['Auctions', '/auctions'],
  ['Create', '/create'],
  ['Dashboard', '/dashboard'],
  ['How It Works', '/how-it-works']
];

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <Link to="/" className="logo" onClick={() => setIsMenuOpen(false)}>
            Private Auction
          </Link>
        </div>

        <button
          className="header-menu-toggle"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        <nav className={isMenuOpen ? 'header-nav is-open' : 'header-nav'}>
          {navItems.map(([label, path]) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="header-right">
          <ConnectWallet />
        </div>
      </header>
      <main className="app-main">
        {children}
      </main>
    </div>
  );
};

export default Layout;
