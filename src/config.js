require('dotenv').config()

const { jobType } = require('./constants')
const tornConfig = require('@tornado/tornado-config')
module.exports = {
  netId: Number(process.env.NET_ID) || 1,
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  httpRpcUrl: process.env.HTTP_RPC_URL,
  wsRpcUrl: process.env.WS_RPC_URL,
  oracleRpcUrl: process.env.ORACLE_RPC_URL || 'https://api.securerpc.com/v1',
  aggregatorAddress: process.env.AGGREGATOR,
  minerMerkleTreeHeight: 20,
  privateKey: process.env.PRIVATE_KEY,
  instances: tornConfig.instances,
  torn: tornConfig,
  port: process.env.APP_PORT || 8000,
  tornadoServiceFee: Number(process.env.RELAYER_FEE),
  rewardAccount: process.env.REWARD_ACCOUNT,
  governanceAddress: '0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce',
  tornadoGoerliProxy: '0x454d870a72e29d5E5697f635128D18077BD04C60',
  gasLimits: {
    [jobType.MINING_REWARD]: 455000,
    [jobType.MINING_WITHDRAW]: 400000,
  },
  minimumBalance: '500000000000000000',
  baseFeeReserve: Number(process.env.BASE_FEE_RESERVE_PERCENTAGE),
}
