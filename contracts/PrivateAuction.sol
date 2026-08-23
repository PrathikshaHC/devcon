// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Minimal {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

contract PrivateAuction {
    enum AuctionStatus {
        Bidding,
        Reveal,
        ReadyToSettle,
        Settled,
        Canceled
    }

    struct Auction {
        address payable seller;
        address assetContract;
        uint256 tokenId;
        string assetURI;
        uint256 minimumBid;
        uint64 biddingEndsAt;
        uint64 revealEndsAt;
        bool assetEscrowed;
        bool settled;
        bool canceled;
        address highestBidder;
        uint256 highestBid;
        uint256 bidCount;
        uint256 revealedCount;
    }

    struct Commitment {
        bytes32 commitmentHash;
        bool revealed;
        bool refunded;
        uint256 revealedAmount;
    }

    uint256 public auctionCount;

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => Commitment)) public commitments;
    mapping(uint256 => address[]) private bidders;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed assetContract,
        uint256 tokenId,
        uint256 minimumBid,
        uint64 biddingEndsAt,
        uint64 revealEndsAt
    );
    event BidCommitted(uint256 indexed auctionId, address indexed bidder, bytes32 commitmentHash);
    event BidRevealed(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event RefundWithdrawn(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed auctionId, address indexed winner, uint256 winningBid);
    event AuctionCanceled(uint256 indexed auctionId);

    error InvalidDuration();
    error AuctionMissing();
    error NotSeller();
    error NotBiddingPhase();
    error NotRevealPhase();
    error RevealStillOpen();
    error AuctionAlreadySettled();
    error AuctionAlreadyCanceled();
    error CommitmentExists();
    error CommitmentMissing();
    error CommitmentMismatch();
    error BidBelowMinimum();
    error IncorrectPayment();
    error NothingToRefund();
    error TransferFailed();

    function createAuction(
        address assetContract,
        uint256 tokenId,
        string calldata assetURI,
        uint256 minimumBid,
        uint64 biddingDuration,
        uint64 revealDuration,
        bool escrowAsset
    ) external returns (uint256 auctionId) {
        if (biddingDuration == 0 || revealDuration == 0) revert InvalidDuration();

        auctionId = ++auctionCount;
        uint64 biddingEndsAt = uint64(block.timestamp) + biddingDuration;
        uint64 revealEndsAt = biddingEndsAt + revealDuration;

        auctions[auctionId] = Auction({
            seller: payable(msg.sender),
            assetContract: assetContract,
            tokenId: tokenId,
            assetURI: assetURI,
            minimumBid: minimumBid,
            biddingEndsAt: biddingEndsAt,
            revealEndsAt: revealEndsAt,
            assetEscrowed: escrowAsset,
            settled: false,
            canceled: false,
            highestBidder: address(0),
            highestBid: 0,
            bidCount: 0,
            revealedCount: 0
        });

        if (escrowAsset) {
            IERC721Minimal(assetContract).safeTransferFrom(msg.sender, address(this), tokenId);
        }

        emit AuctionCreated(
            auctionId,
            msg.sender,
            assetContract,
            tokenId,
            minimumBid,
            biddingEndsAt,
            revealEndsAt
        );
    }

    function commitBid(uint256 auctionId, bytes32 commitmentHash) external {
        Auction storage auction = _activeAuction(auctionId);
        if (block.timestamp >= auction.biddingEndsAt) revert NotBiddingPhase();

        Commitment storage commitment = commitments[auctionId][msg.sender];
        if (commitment.commitmentHash != bytes32(0)) revert CommitmentExists();

        commitment.commitmentHash = commitmentHash;
        bidders[auctionId].push(msg.sender);
        auction.bidCount += 1;

        emit BidCommitted(auctionId, msg.sender, commitmentHash);
    }

    function revealBid(uint256 auctionId, uint256 amount, bytes32 salt) external payable {
        Auction storage auction = _activeAuction(auctionId);
        if (block.timestamp < auction.biddingEndsAt || block.timestamp >= auction.revealEndsAt) {
            revert NotRevealPhase();
        }
        if (amount < auction.minimumBid) revert BidBelowMinimum();
        if (msg.value != amount) revert IncorrectPayment();

        Commitment storage commitment = commitments[auctionId][msg.sender];
        if (commitment.commitmentHash == bytes32(0)) revert CommitmentMissing();
        if (commitment.revealed) revert CommitmentExists();

        bytes32 expected = hashBid(auctionId, amount, salt, msg.sender);
        if (expected != commitment.commitmentHash) revert CommitmentMismatch();

        commitment.revealed = true;
        commitment.revealedAmount = amount;
        auction.revealedCount += 1;

        if (amount > auction.highestBid) {
            auction.highestBidder = msg.sender;
            auction.highestBid = amount;
        }

        emit BidRevealed(auctionId, msg.sender, amount);
    }

    function settleAuction(uint256 auctionId) external {
        Auction storage auction = _existingAuction(auctionId);
        if (auction.settled) revert AuctionAlreadySettled();
        if (block.timestamp < auction.revealEndsAt) revert RevealStillOpen();

        auction.settled = true;

        if (auction.highestBidder != address(0)) {
            (bool paidSeller, ) = auction.seller.call{value: auction.highestBid}("");
            if (!paidSeller) revert TransferFailed();

            if (auction.assetEscrowed) {
                IERC721Minimal(auction.assetContract).safeTransferFrom(
                    address(this),
                    auction.highestBidder,
                    auction.tokenId
                );
            }
        } else if (auction.assetEscrowed) {
            IERC721Minimal(auction.assetContract).safeTransferFrom(address(this), auction.seller, auction.tokenId);
        }

        emit AuctionSettled(auctionId, auction.highestBidder, auction.highestBid);
    }

    function withdrawRefund(uint256 auctionId) external {
        Auction storage auction = _existingAuction(auctionId);
        if (!auction.settled) revert RevealStillOpen();

        Commitment storage commitment = commitments[auctionId][msg.sender];
        if (!commitment.revealed || commitment.refunded || msg.sender == auction.highestBidder) {
            revert NothingToRefund();
        }

        uint256 refund = commitment.revealedAmount;
        if (refund == 0) revert NothingToRefund();

        commitment.refunded = true;
        commitment.revealedAmount = 0;

        (bool refunded, ) = payable(msg.sender).call{value: refund}("");
        if (!refunded) revert TransferFailed();

        emit RefundWithdrawn(auctionId, msg.sender, refund);
    }

    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = _existingAuction(auctionId);
        if (msg.sender != auction.seller) revert NotSeller();
        if (auction.bidCount != 0 || block.timestamp >= auction.biddingEndsAt) revert NotBiddingPhase();
        if (auction.settled) revert AuctionAlreadySettled();

        auction.settled = true;
        auction.canceled = true;

        if (auction.assetEscrowed) {
            IERC721Minimal(auction.assetContract).safeTransferFrom(address(this), auction.seller, auction.tokenId);
        }

        emit AuctionCanceled(auctionId);
    }

    function hashBid(
        uint256 auctionId,
        uint256 amount,
        bytes32 salt,
        address bidder
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(auctionId, amount, salt, bidder));
    }

    function getBidders(uint256 auctionId) external view returns (address[] memory) {
        _existingAuction(auctionId);
        return bidders[auctionId];
    }

    function getStatus(uint256 auctionId) external view returns (AuctionStatus) {
        Auction storage auction = _existingAuction(auctionId);

        if (auction.settled) {
            if (auction.canceled) {
                return AuctionStatus.Canceled;
            }

            return AuctionStatus.Settled;
        }

        if (block.timestamp < auction.biddingEndsAt) {
            return AuctionStatus.Bidding;
        }

        if (block.timestamp < auction.revealEndsAt) {
            return AuctionStatus.Reveal;
        }

        return AuctionStatus.ReadyToSettle;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function _activeAuction(uint256 auctionId) private view returns (Auction storage auction) {
        auction = _existingAuction(auctionId);
        if (auction.settled) revert AuctionAlreadySettled();
    }

    function _existingAuction(uint256 auctionId) private view returns (Auction storage auction) {
        auction = auctions[auctionId];
        if (auction.seller == address(0)) revert AuctionMissing();
    }
}
