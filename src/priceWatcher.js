const { setSafeInterval, RelayerError, logRelayerError } = require('./utils')
const { redis } = require('./modules/redis')
const { TokenPriceOracle } = require('@tornado/tornado-oracles')
const { oracleRpcUrl } = require('./config')

const priceOracle = new TokenPriceOracle(oracleRpcUrl)

async function main() {
  try {
    const ethPrices = await priceOracle.fetchPrices()
    await redis.hmset('prices', ethPrices)
    console.log('Wrote following prices to redis', ethPrices)
  } catch (e) {
    await logRelayerError(redis, e)
    console.error('priceWatcher error', e)
  }
}

setSafeInterval(main, 30 * 1000)
