require('dotenv').config()

const tornConfig = require('@tornado/tornado-config')

const { jobType, networkConfig } = require('./constants')

const netId = Number(process.env.NET_ID) || 56
const instances = tornConfig.instances[netId]
const proxyLight = tornConfig.tornadoProxyLight.address
const { gasPrices, nativeCurrency } = networkConfig[`netId${netId}`]

module.exports = {
  netId,
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  httpRpcUrl: process.env.HTTP_RPC_URL,
  oracleRpcUrl: process.env.ORACLE_RPC_URL || 'https://api.securerpc.com/v1',
  minerMerkleTreeHeight: 20,
  privateKey: process.env.PRIVATE_KEY,
  instances,
  port: process.env.APP_PORT || 8000,
  tornadoServiceFee: Number(process.env.REGULAR_TORNADO_WITHDRAW_FEE),
  rewardAccount: process.env.REWARD_ACCOUNT,
  gasPrices,
  proxyLight,
  nativeCurrency,
  minimumBalance: '500000000000000000', // 0.5
}
