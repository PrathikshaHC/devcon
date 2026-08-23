import { ArrowLeft, ImagePlus, UploadCloud } from 'lucide-react';
import { ethers } from 'ethers';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getContractAddress,
  getPrivateAuctionContract,
  isContractConfigured,
  parseAuctionCreated,
} from '../contracts/privateAuction';
import { useToast } from '../context/toastContext';
import { useWallet } from '../context/walletContext';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=85';
const DEFAULT_REVEAL_DURATION_SECONDS = 60 * 60;

export default function CreateAuction({ onCreate }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { account, isConnected, connectWallet } = useWallet();
  const [form, setForm] = useState({ title: '', description: '', minimumBid: '', duration: '24' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const buildAuctionPreview = (extra = {}) => ({
    id: extra.id || `custom-${Date.now()}`,
    title: form.title,
    type: 'Digital asset',
    creator: account || 'You',
    description: form.description,
    image: DEFAULT_IMAGE,
    minimumBid: `${form.minimumBid} ETH`,
    endTime: Date.now() + Number(form.duration) * 3600000,
    status: extra.status || 'Live',
    bids: 0,
    ...extra,
  });

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.title.trim() || !form.description.trim() || !form.minimumBid || Number(form.minimumBid) <= 0) {
      setError('Complete each required field with a valid value.');
      return;
    }

    if (!isContractConfigured()) {
      onCreate(buildAuctionPreview({ status: 'Local preview' }));
      showToast({
        title: 'Auction saved locally',
        message: 'Set VITE_PRIVATE_AUCTION_ADDRESS to create auctions on-chain.',
        type: 'info',
      });
      navigate('/dashboard');
      return;
    }

    if (!isConnected) {
      await connectWallet();
      return;
    }

    setIsSubmitting(true);

    try {
      const contract = await getPrivateAuctionContract({ signer: true });
      const assetURI = JSON.stringify({
        name: form.title,
        description: form.description,
        image: DEFAULT_IMAGE,
      });
      const minimumBid = ethers.parseEther(form.minimumBid);
      const biddingDuration = BigInt(Number(form.duration) * 3600);

      const tx = await contract.createAuction(
        ethers.ZeroAddress,
        0,
        assetURI,
        minimumBid,
        biddingDuration,
        DEFAULT_REVEAL_DURATION_SECONDS,
        false
      );
      const receipt = await tx.wait();
      const chainAuctionId = parseAuctionCreated(receipt);

      if (!chainAuctionId) {
        throw new Error('Auction transaction succeeded, but the auction id was not found in logs.');
      }

      onCreate(buildAuctionPreview({
        id: `chain-${chainAuctionId}`,
        chainAuctionId,
        contractAddress: getContractAddress(),
        transactionHash: receipt.hash,
        status: 'On-chain',
      }));

      showToast({
        title: 'Auction created on-chain',
        message: `Auction #${chainAuctionId} is live on the configured network.`,
        type: 'success',
      });
      navigate('/dashboard');
    } catch (err) {
      const message = err.shortMessage || err.reason || err.message || 'Failed to create auction.';
      setError(message);
      showToast({
        title: 'Auction creation failed',
        message,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-width page-section narrow">
      <Link className="back-link" to="/"><ArrowLeft size={15} /> Back home</Link>
      <div className="form-intro">
        <div className="eyebrow">List an asset</div>
        <h1>Create an auction.</h1>
        <p>Give something meaningful a private room to find its next owner.</p>
      </div>
      <form className="create-form" onSubmit={submit}>
        <div className="form-section">
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h3>Asset details</h3>
              <p>Tell bidders what they are looking at.</p>
            </div>
          </div>
          <div className="field-grid">
            <label className="input-label">
              Asset / NFT name
              <input name="title" value={form.title} onChange={update} placeholder="e.g. A Quiet Frequency" />
            </label>
            <label className="input-label full-width">
              Description
              <textarea name="description" value={form.description} onChange={update} placeholder="What makes this asset worth a closer look?" rows="4" />
            </label>
          </div>
          <div className="upload-zone">
            <ImagePlus size={22} />
            <div>
              <strong>Drop an image here</strong>
              <span>PNG, JPG or WEBP up to 10MB</span>
            </div>
            <button type="button"><UploadCloud size={15} /> Browse</button>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h3>Auction settings</h3>
              <p>Set the starting point and how long it runs.</p>
            </div>
          </div>
          <div className="field-grid">
            <label className="input-label">
              Minimum bid
              <div className="input-suffix">
                <input name="minimumBid" type="number" min="0" step="0.01" value={form.minimumBid} onChange={update} placeholder="0.00" />
                <span>ETH</span>
              </div>
            </label>
            <label className="input-label">
              Auction duration
              <select name="duration" value={form.duration} onChange={update}>
                <option value="6">6 hours</option>
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
                <option value="168">7 days</option>
              </select>
            </label>
          </div>
        </div>
        {error && <p className="error-message">{error}</p>}
        <div className="form-submit">
          <p>
            <span className="status-dot" />
            {isContractConfigured() ? 'Creates a Sepolia-ready contract auction' : 'Stored locally until a contract address is configured'}
          </p>
          <button className="button primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Start auction'} <UploadCloud size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
