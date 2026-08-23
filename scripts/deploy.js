import hre from 'hardhat';

async function main() {
  const PrivateAuction = await hre.ethers.getContractFactory('PrivateAuction');
  const privateAuction = await PrivateAuction.deploy();

  await privateAuction.waitForDeployment();

  console.log(`PrivateAuction deployed to ${await privateAuction.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
