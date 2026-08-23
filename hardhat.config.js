import { createRequire } from 'module';

const require = createRequire(import.meta.url);

require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

/** @type {hardhat.config.TypeHints} */
const config = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
    },
  },
};

export default config;
