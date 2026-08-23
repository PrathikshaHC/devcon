import { ArrowRight, BadgeCheck, EyeOff, Gavel, Layers3, LockKeyhole, WalletCards } from 'lucide-react';
import SectionHeading from '../components/SectionHeading';

const steps = [
  [WalletCards, 'Connect wallet', 'Connect your Ethereum wallet and switch to Sepolia for on-chain auctions.'],
  [EyeOff, 'Commit private bid', 'The app hashes your bid amount with a random salt and submits only the commitment hash.'],
  [LockKeyhole, 'Protect reveal data', 'Your bid amount and salt are encrypted in this browser with a key derived from your wallet signature.'],
  [BadgeCheck, 'Reveal and verify', 'After bidding closes, decrypt and reveal the amount and salt so the contract can verify the commitment.'],
  [Gavel, 'Settle on Ethereum', 'When the reveal window closes, the contract finalizes the winner and enables refunds for losing revealed bids.'],
  [Layers3, 'Keep limits clear', 'Revealed bids become public during settlement, while unrevealed bid amounts remain hidden.'],
];

export default function HowItWorks() {
  return <div className="page-width page-section how-page"><SectionHeading eyebrow="The protocol" title="A better way to bid." copy="Private Auction uses commit-reveal bidding so transparency does not require exposing every bid during the auction." /><div className="steps-list">{steps.map(([Icon, title, copy], index) => <div className="step" key={title}><div className="step-number">0{index + 1}</div><div className="step-icon"><Icon /></div><div className="step-copy"><h3>{title}</h3><p>{copy}</p></div><ArrowRight className="step-arrow" /></div>)}</div><div className="future-note"><EyeOff size={20} /><div><strong>Cryptographic privacy, with appropriate honesty.</strong><p>Commitments hide bid amounts during bidding. Revealed bids become public during the reveal phase so the contract can verify and settle the auction.</p></div></div></div>;
}
