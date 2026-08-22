import { ArrowUpRight, Clock3, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import Countdown from './Countdown';

export default function AuctionCard({ auction }) {
  return <article className="auction-card">
    <div className="card-image-wrap"><img src={auction.image} alt={auction.title} /><span className="badge live"><span className="status-dot" />{auction.status}</span></div>
    <div className="card-body"><div className="eyebrow">{auction.type}</div><h3>{auction.title}</h3><div className="card-meta"><span><UserRound size={14} /> {auction.creator}</span><span>{auction.bids} bids</span></div><div className="card-footer"><div><small>Minimum bid</small><strong>{auction.minimumBid}</strong></div><div className="time"><Clock3 size={14} /><Countdown endTime={auction.endTime} /></div></div><Link className="card-link" to={`/auctions/${auction.id}`}>View auction <ArrowUpRight size={16} /></Link></div>
  </article>;
}
