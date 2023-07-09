import { RelayerJobType } from './types';
import tornConfig, { availableIds } from 'torn-token';
import { config } from 'dotenv';
import { version } from '../package.json';

config();
const isProduction = process.env.NODE_ENV === 'production';
export const relayerVersion = version;
export const netId = <availableIds>Number(process.env.NET_ID ?? 1);
export const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const rpcUrl = process.env.HTTP_RPC_URL;
export const CONFIRMATIONS = Number(process.env.CONFIRMATIONS ?? 4);
export const MAX_GAS_PRICE = Number(process.env.MAX_GAS_PRICE ?? 1000);
export const BASE_FEE_RESERVE_PERCENTAGE = Number(process.env.BASE_FEE_RESERVE_PERCENTAGE ?? 25);
export const mainnetRpcUrl = process.env.MAINNET_RPC_URL || process.env.ORACLE_RPC_URL || 'https://mainnet.infura.io/';
export const oracleRpcUrl = process.env.ORACLE_RPC_URL || 'https://mainnet.infura.io/';
export const offchainOracleAddress = '0x07D91f5fb9Bf7798734C3f606dB065549F6893bb';
export const multiCallAddress = '0xda3c19c6fe954576707fa24695efb830d9cca1ca';
export const privateKey = process.env.PRIVATE_KEY;
export const instances = tornConfig.instances;
export const torn = tornConfig;
export const port = Number(process.env.APP_PORT) || 8000;
export const host = isProduction ? 'https://' + process.env.VIRTUAL_HOST : `http://localhost:${port}`;
export const tornadoServiceFee = Number(process.env.REGULAR_TORNADO_WITHDRAW_FEE);
export const rewardAccount = process.env.REWARD_ACCOUNT;
export const tornadoGoerliProxy = '0x454d870a72e29d5E5697f635128D18077BD04C60';
export const ovmGasPriceOracleContract = '0x420000000000000000000000000000000000000F';
export const txJobAttempts = 3;
export const gasLimits = {
  [RelayerJobType.TORNADO_WITHDRAW]: 390000,
  [RelayerJobType.WITHDRAW_WITH_EXTRA]: 700000,
  [RelayerJobType.OP_TORNADO_WITHDRAW]: 440000,
  [RelayerJobType.ARB_TORNADO_WITHDRAW]: 1900000,
};
const minimumBalances: { [availableId in availableIds]: number } = {
  1: 0.5, // 0.5 ETH on Ethereum mainnet
  5: 10, // 10 ETH on Goerli testnet (because of high gas spikes)
  10: 0.1, // 0.1 ETH on Optimism
  56: 0.1, // 0.1 BNB on Binance Smart Chain
  100: 100, // 100 XDAI on Gnosis (~ 100$)
  137: 10, // 10 MATIC on Polygon
  42161: 0.1, // 0.1 ETH on Arbitrum
  43114: 10, // 10 AVAX on Avalanche C-Chain
};
export const minimumBalance = (minimumBalances[netId] * 1e18).toString();
export const minimumTornBalance = (500 * 1e18).toString();
export const baseFeeReserve = Number(process.env.BASE_FEE_RESERVE_PERCENTAGE);
export const tornToken = {
  tokenAddress: '0x77777FeDdddFfC19Ff86DB637967013e6C6A116C',
  symbol: 'TORN',
  decimals: 18,
};

export const networkConfig = {
  netId56: {
    gasPrices: {
      instant: 5,
      fast: 5,
      standard: 5,
      low: 5,
    },
    nativeCurrency: 'bnb',
  },
  netId10: {
    gasPrices: {
      instant: 0.001,
      fast: 0.001,
      standard: 0.001,
      low: 0.001,
    },
    nativeCurrency: 'eth',
  },
  netId100: {
    gasPrices: {
      instant: 6,
      fast: 5,
      standard: 4,
      low: 1,
    },
    nativeCurrency: 'xdai',
  },
  netId137: {
    gasPrices: {
      instant: 100,
      fast: 75,
      standard: 50,
      low: 30,
    },
    nativeCurrency: 'matic',
  },
  netId42161: {
    gasPrices: {
      instant: 4,
      fast: 3,
      standard: 2.52,
      low: 2.29,
    },
    nativeCurrency: 'eth',
  },
  netId43114: {
    gasPrices: {
      instant: 225,
      fast: 35,
      standard: 25,
      low: 25,
    },
    nativeCurrency: 'avax',
  },
};
