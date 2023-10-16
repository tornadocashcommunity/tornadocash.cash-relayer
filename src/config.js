require('dotenv').config()

const tornConfig = require('@tornado/tornado-config')

const { networkConfig } = require('./constants')

const netId = Number(process.env.NET_ID) || 56
const instances = tornConfig.instances[netId]
const proxyLight = tornConfig.tornadoProxyLight.address
const { gasPrices, nativeCurrency } = networkConfig[`netId${netId}`]

module.exports = {
  netId,
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  httpRpcUrl: process.env.HTTP_RPC_URL,
  oracleRpcUrl: process.env.ORACLE_RPC_URL || 'https://rpc.payload.de',
  minerMerkleTreeHeight: 20,
  privateKey: process.env.PRIVATE_KEY,
  instances,
  port: process.env.APP_PORT || 8000,
  tornadoServiceFee: Number(process.env.RELAYER_FEE),
  rewardAccount: process.env.REWARD_ACCOUNT,
  gasPrices,
  proxyLight,
  nativeCurrency,
  minimumBalance: netId === 137 || netId === 43114 ? '10000000000000000000' : '100000000000000000', // 10 or 0.1
}
