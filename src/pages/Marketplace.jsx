import { Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import AuctionCard from '../components/AuctionCard';
import SectionHeading from '../components/SectionHeading';

export default function Marketplace({ auctions }) {
  const [query, setQuery] = useState('');
  const filtered = auctions.filter((auction) => auction.title.toLowerCase().includes(query.toLowerCase()) || auction.type.toLowerCase().includes(query.toLowerCase()));
  return <div className="page-width page-section"><SectionHeading eyebrow="Marketplace" title="Auctions, without the noise." copy="Explore digital objects and ideas currently looking for their next home." /><div className="toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search auctions" /></label><button className="filter-button"><SlidersHorizontal size={16} /> Filters <span>0</span></button></div>{filtered.length ? <div className="auction-grid">{filtered.map((auction) => <AuctionCard key={auction.id} auction={auction} />)}</div> : <div className="empty-state"><Search size={28} /><h3>No auctions found</h3><p>Try another search term.</p></div>}</div>;
}
