import { expect } from 'chai';
import hre from 'hardhat';

const { ethers, network } = hre;

async function increaseTo(timestamp) {
  await network.provider.send('evm_setNextBlockTimestamp', [Number(timestamp)]);
  await network.provider.send('evm_mine');
}

describe('PrivateAuction', function () {
  async function deployFixture() {
    const [seller, alice, bob] = await ethers.getSigners();
    const PrivateAuction = await ethers.getContractFactory('PrivateAuction');
    const auction = await PrivateAuction.deploy();
    await auction.waitForDeployment();

    return { auction, seller, alice, bob };
  }

  it('creates an auction, commits hidden bids, reveals, settles, and refunds losing bidders', async function () {
    const { auction, seller, alice, bob } = await deployFixture();
    const biddingDuration = 60;
    const revealDuration = 60;
    const minimumBid = ethers.parseEther('1');

    await auction.createAuction(
      ethers.ZeroAddress,
      0,
      'ipfs://test-asset',
      minimumBid,
      biddingDuration,
      revealDuration,
      false
    );

    const aliceBid = ethers.parseEther('1.5');
    const bobBid = ethers.parseEther('2');
    const aliceSalt = ethers.hexlify(ethers.randomBytes(32));
    const bobSalt = ethers.hexlify(ethers.randomBytes(32));

    await auction.connect(alice).commitBid(1, await auction.hashBid(1, aliceBid, aliceSalt, alice.address));
    await auction.connect(bob).commitBid(1, await auction.hashBid(1, bobBid, bobSalt, bob.address));

    const created = await auction.auctions(1);
    await increaseTo(created.biddingEndsAt);

    await auction.connect(alice).revealBid(1, aliceBid, aliceSalt, { value: aliceBid });
    await auction.connect(bob).revealBid(1, bobBid, bobSalt, { value: bobBid });

    const revealed = await auction.auctions(1);
    await increaseTo(revealed.revealEndsAt);

    await expect(() => auction.connect(alice).settleAuction(1)).to.changeEtherBalances(
      [seller],
      [bobBid]
    );

    await expect(() => auction.connect(alice).withdrawRefund(1)).to.changeEtherBalances(
      [alice],
      [aliceBid]
    );

    const settled = await auction.auctions(1);
    expect(settled.highestBidder).to.equal(bob.address);
    expect(settled.highestBid).to.equal(bobBid);
  });

  it('rejects reveals that do not match the commitment', async function () {
    const { auction, alice } = await deployFixture();
    const minimumBid = ethers.parseEther('1');
    const bid = ethers.parseEther('1.2');
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const wrongSalt = ethers.hexlify(ethers.randomBytes(32));

    await auction.createAuction(ethers.ZeroAddress, 0, '', minimumBid, 60, 60, false);
    await auction.connect(alice).commitBid(1, await auction.hashBid(1, bid, salt, alice.address));

    const created = await auction.auctions(1);
    await increaseTo(created.biddingEndsAt);

    await expect(
      auction.connect(alice).revealBid(1, bid, wrongSalt, { value: bid })
    ).to.be.revertedWithCustomError(auction, 'CommitmentMismatch');
  });
});
