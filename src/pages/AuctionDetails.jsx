import { ArrowLeft, CheckCircle2, Info, LockKeyhole, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import Countdown from '../components/Countdown';

export default function AuctionDetails({ auctions }) {
  const { auctionId } = useParams();
  const auction = auctions.find((item) => item.id === auctionId) || auctions[0];
  const [bid, setBid] = useState('');
  const [notice, setNotice] = useState('');
  const submitBid = (event) => { event.preventDefault(); if (!bid || Number(bid) <= 0) return; setNotice('Your private bid is staged locally for this frontend preview.'); setBid(''); };
  return <div className="page-width page-section"><Link className="back-link" to="/auctions"><ArrowLeft size={15} /> Back to auctions</Link><div className="detail-layout"><div className="detail-visual"><img src={auction.image} alt={auction.title} /><span className="image-tag">{auction.type}</span></div><div className="detail-content"><div className="eyebrow">Live auction · {auction.creator}</div><h1>{auction.title}</h1><p className="detail-description">{auction.description}</p><div className="detail-stats"><div><small>Minimum bid</small><strong>{auction.minimumBid}</strong></div><div><small>Ends in</small><Countdown endTime={auction.endTime} /></div><div><small>Activity</small><strong>{auction.bids} bids</strong></div></div><div className="privacy-callout"><LockKeyhole size={19} /><div><strong>Private bidding is the point.</strong><p>Your bid remains private while the auction is active. The final result can be verified without unnecessarily exposing losing bids.</p></div></div><form className="bid-panel" onSubmit={submitBid}><div className="panel-header"><span>Submit a private bid</span><span className="coming-soon">Preview</span></div><label className="input-label">Bid amount <span>ETH</span><input type="number" min="0" step="0.01" value={bid} onChange={(event) => setBid(event.target.value)} placeholder="0.00" required /></label><button className="button primary full" type="submit"><LockKeyhole size={16} /> Submit private bid</button><div className="wallet-placeholder"><Wallet size={17} /><span>Wallet not connected</span><button type="button" onClick={() => alert('Wallet connection will be added in a future phase.')}>Connect wallet</button></div>{notice && <div className="form-notice"><CheckCircle2 size={16} /> {notice}</div>}<p className="form-disclaimer"><Info size={14} /> No transaction will be sent. Blockchain integration is not enabled in this preview.</p></form></div></div></div>;
}
