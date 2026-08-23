import { ArrowLeft, CheckCircle2, Info, LockKeyhole, Wallet } from 'lucide-react';
import { ethers } from 'ethers';
import { Link, useParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import Countdown from '../components/Countdown';
import {
  AUCTION_STATUS,
  clearCommittedBid,
  getCommittedBid,
  getContractAddress,
  getPrivateAuctionContract,
  hasStoredCommittedBid,
  isContractConfigured,
  makeBidCommitment,
  saveCommittedBid,
} from '../contracts/privateAuction';
import { useToast } from '../context/toastContext';
import { useWallet } from '../context/walletContext';

const STATUS_LABELS = {
  [AUCTION_STATUS.BIDDING]: 'Bidding',
  [AUCTION_STATUS.REVEAL]: 'Reveal',
  [AUCTION_STATUS.READY_TO_SETTLE]: 'Ready to settle',
  [AUCTION_STATUS.SETTLED]: 'Settled',
  [AUCTION_STATUS.CANCELED]: 'Canceled',
};

function formatEth(value) {
  return `${Number(ethers.formatEther(value)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} ETH`;
}

export default function AuctionDetails({ auctions }) {
  const { auctionId } = useParams();
  const { showToast } = useToast();
  const {
    account,
    isConnected,
    isOnSepolia,
    connectWallet,
    switchToSepolia,
  } = useWallet();
  const auction = auctions.find((item) => item.id === auctionId) || auctions[0];
  const isChainAuction = Boolean(auction?.chainAuctionId);
  const [bid, setBid] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [chainState, setChainState] = useState(null);
  const [hasCommittedBid, setHasCommittedBid] = useState(false);

  useEffect(() => {
    setHasCommittedBid(
      isChainAuction &&
      hasStoredCommittedBid({
        contractAddress: auction.contractAddress,
        auctionId: auction.chainAuctionId,
        account,
      })
    );
  }, [account, auction.chainAuctionId, auction.contractAddress, isChainAuction]);

  const loadChainState = useCallback(async () => {
    if (!isChainAuction || !isContractConfigured()) return;

    try {
      const contract = await getPrivateAuctionContract();
      const [details, status] = await Promise.all([
        contract.auctions(auction.chainAuctionId),
        contract.getStatus(auction.chainAuctionId),
      ]);

      setChainState({
        seller: details.seller,
        minimumBid: details.minimumBid,
        biddingEndsAt: Number(details.biddingEndsAt) * 1000,
        revealEndsAt: Number(details.revealEndsAt) * 1000,
        highestBidder: details.highestBidder,
        highestBid: details.highestBid,
        bidCount: Number(details.bidCount),
        revealedCount: Number(details.revealedCount),
        status: Number(status),
      });
    } catch (err) {
      setError(err.shortMessage || err.reason || err.message || 'Could not load on-chain auction state.');
    }
  }, [auction.chainAuctionId, isChainAuction]);

  useEffect(() => {
    loadChainState();
  }, [loadChainState]);

  const requireWallet = async () => {
    if (!isConnected) {
      await connectWallet();
      return false;
    }

    if (!isOnSepolia) {
      await switchToSepolia();
      return false;
    }

    return true;
  };

  const commitBid = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!isChainAuction || !isContractConfigured()) {
      if (!bid || Number(bid) <= 0) return;
      setNotice('Your private bid is staged locally for this frontend preview.');
      setBid('');
      return;
    }

    if (!bid || Number(bid) <= 0) {
      setError('Enter a valid bid amount.');
      return;
    }

    if (!(await requireWallet())) return;

    setIsWorking(true);
    let txSubmitted = false;

    try {
      const contract = await getPrivateAuctionContract({ signer: true });
      const amountWei = ethers.parseEther(bid);
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const commitmentHash = makeBidCommitment({
        auctionId: auction.chainAuctionId,
        amountWei,
        salt,
        account,
      });
      await saveCommittedBid({
        contractAddress: getContractAddress(),
        auctionId: auction.chainAuctionId,
        account,
        amountEth: bid,
        amountWei,
        salt,
      });
      const tx = await contract.commitBid(auction.chainAuctionId, commitmentHash);
      txSubmitted = true;
      await tx.wait();

      setBid('');
      setHasCommittedBid(true);
      setNotice('Private bid committed on-chain. Your reveal data is encrypted in this browser.');
      showToast({
        title: 'Bid committed',
        message: 'Your bid amount is hidden on-chain until you reveal it.',
        type: 'success',
      });
      await loadChainState();
    } catch (err) {
      if (!txSubmitted) {
        clearCommittedBid({
          contractAddress: getContractAddress(),
          auctionId: auction.chainAuctionId,
          account,
        });
      }
      const message = err.shortMessage || err.reason || err.message || 'Failed to commit bid.';
      setError(message);
      showToast({ title: 'Commit failed', message, type: 'error' });
    } finally {
      setIsWorking(false);
    }
  };

  const revealBid = async () => {
    setError('');
    setNotice('');

    if (!(await requireWallet())) return;

    const committedBid = await getCommittedBid({
      contractAddress: auction.contractAddress,
      auctionId: auction.chainAuctionId,
      account,
    });

    if (!committedBid) {
      setError('No decryptable committed bid was found for this wallet in this browser.');
      return;
    }

    setIsWorking(true);

    try {
      const contract = await getPrivateAuctionContract({ signer: true });
      const amountWei = BigInt(committedBid.amountWei);
      const tx = await contract.revealBid(auction.chainAuctionId, amountWei, committedBid.salt, {
        value: amountWei,
      });
      await tx.wait();

      setNotice(`Revealed ${committedBid.amountEth} ETH on-chain.`);
      showToast({
        title: 'Bid revealed',
        message: 'Your bid is now included in winner determination.',
        type: 'success',
      });
      await loadChainState();
    } catch (err) {
      const message = err.shortMessage || err.reason || err.message || 'Failed to reveal bid.';
      setError(message);
      showToast({ title: 'Reveal failed', message, type: 'error' });
    } finally {
      setIsWorking(false);
    }
  };

  const settleAuction = async () => {
    setError('');
    setNotice('');

    if (!(await requireWallet())) return;

    setIsWorking(true);

    try {
      const contract = await getPrivateAuctionContract({ signer: true });
      const tx = await contract.settleAuction(auction.chainAuctionId);
      await tx.wait();

      setNotice('Auction settled on-chain.');
      showToast({
        title: 'Auction settled',
        message: 'The seller was paid and the winning result is final.',
        type: 'success',
      });
      await loadChainState();
    } catch (err) {
      const message = err.shortMessage || err.reason || err.message || 'Failed to settle auction.';
      setError(message);
      showToast({ title: 'Settlement failed', message, type: 'error' });
    } finally {
      setIsWorking(false);
    }
  };

  const withdrawRefund = async () => {
    setError('');
    setNotice('');

    if (!(await requireWallet())) return;

    setIsWorking(true);

    try {
      const contract = await getPrivateAuctionContract({ signer: true });
      const tx = await contract.withdrawRefund(auction.chainAuctionId);
      await tx.wait();

      clearCommittedBid({
        contractAddress: getContractAddress(),
        auctionId: auction.chainAuctionId,
        account,
      });

      setNotice('Refund withdrawn on-chain.');
      showToast({
        title: 'Refund withdrawn',
        message: 'Your losing bid amount was returned.',
        type: 'success',
      });
      await loadChainState();
    } catch (err) {
      const message = err.shortMessage || err.reason || err.message || 'Failed to withdraw refund.';
      setError(message);
      showToast({ title: 'Refund failed', message, type: 'error' });
    } finally {
      setIsWorking(false);
    }
  };

  const status = chainState?.status;
  const statusLabel = isChainAuction && chainState ? STATUS_LABELS[status] : auction.status;
  const minimumBid = chainState ? formatEth(chainState.minimumBid) : auction.minimumBid;
  const activity = chainState ? `${chainState.bidCount} committed / ${chainState.revealedCount} revealed` : `${auction.bids} bids`;
  const countdownTarget = status === AUCTION_STATUS.REVEAL ? chainState?.revealEndsAt : chainState?.biddingEndsAt || auction.endTime;
  const canCommit = !isChainAuction || status === AUCTION_STATUS.BIDDING;
  const canReveal = isChainAuction && status === AUCTION_STATUS.REVEAL;
  const canSettle = isChainAuction && status === AUCTION_STATUS.READY_TO_SETTLE;
  const canRefund = isChainAuction && status === AUCTION_STATUS.SETTLED;

  return (
    <div className="page-width page-section">
      <Link className="back-link" to="/auctions"><ArrowLeft size={15} /> Back to auctions</Link>
      <div className="detail-layout">
        <div className="detail-visual">
          <img src={auction.image} alt={auction.title} />
          <span className="image-tag">{auction.type}</span>
        </div>
        <div className="detail-content">
          <div className="eyebrow">{statusLabel} &middot; {auction.creator}</div>
          <h1>{auction.title}</h1>
          <p className="detail-description">{auction.description}</p>
          <div className="detail-stats">
            <div>
              <small>Minimum bid</small>
              <strong>{minimumBid}</strong>
            </div>
            <div>
              <small>{status === AUCTION_STATUS.REVEAL ? 'Reveal ends in' : 'Ends in'}</small>
              <Countdown endTime={countdownTarget} />
            </div>
            <div>
              <small>Activity</small>
              <strong>{activity}</strong>
            </div>
          </div>
          <div className="privacy-callout">
            <LockKeyhole size={19} />
            <div>
              <strong>Private bidding is the point.</strong>
              <p>Your bid is committed as a hash during bidding, then revealed after bidding closes so the contract can determine the winner.</p>
            </div>
          </div>
          <form className="bid-panel" onSubmit={commitBid}>
            <div className="panel-header">
              <span>{isChainAuction ? `Auction #${auction.chainAuctionId}` : 'Submit a private bid'}</span>
              <span className="coming-soon">{isChainAuction ? 'On-chain' : 'Preview'}</span>
            </div>
            {canCommit && (
              <>
                <label className="input-label">
                  Bid amount <span>ETH</span>
                  <input type="number" min="0" step="0.01" value={bid} onChange={(event) => setBid(event.target.value)} placeholder="0.00" required />
                </label>
                <button className="button primary full" type="submit" disabled={isWorking}>
                  <LockKeyhole size={16} /> {isWorking ? 'Committing...' : 'Commit private bid'}
                </button>
              </>
            )}
            {canReveal && (
              <button className="button primary full" type="button" onClick={revealBid} disabled={isWorking || !hasCommittedBid}>
                <CheckCircle2 size={16} /> {isWorking ? 'Revealing...' : 'Reveal saved bid'}
              </button>
            )}
            {canSettle && (
              <button className="button primary full" type="button" onClick={settleAuction} disabled={isWorking}>
                <CheckCircle2 size={16} /> {isWorking ? 'Settling...' : 'Settle auction'}
              </button>
            )}
            {canRefund && (
              <button className="button secondary full" type="button" onClick={withdrawRefund} disabled={isWorking}>
                <Wallet size={16} /> {isWorking ? 'Withdrawing...' : 'Withdraw refund'}
              </button>
            )}
            <div className="wallet-placeholder">
              <Wallet size={17} />
              <span>{isConnected ? `Wallet ${account.slice(0, 6)}...${account.slice(-4)}` : 'Wallet not connected'}</span>
              <button type="button" onClick={connectWallet}>{isConnected ? 'Connected' : 'Connect wallet'}</button>
            </div>
            {notice && <div className="form-notice"><CheckCircle2 size={16} /> {notice}</div>}
            {error && <p className="error-message compact">{error}</p>}
            <p className="form-disclaimer">
              <Info size={14} />
              {isChainAuction
                ? 'Commit hides the bid amount until you reveal. Keep this browser storage intact until reveal.'
                : 'Configure and deploy the contract to send blockchain transactions from this screen.'}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
