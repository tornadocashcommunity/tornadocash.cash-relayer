const Web3 = require('web3')
const { toBN, fromWei } = require('web3-utils')
const { redis } = require('./modules/redis')
const proxyLightABI = require('../abis/proxyLightABI.json')
const { queue } = require('./queue')
const { getInstance, logRelayerError, clearRelayerErrors } = require('./utils')
const { jobType, status } = require('./constants')
const { netId, gasPrices, privateKey, proxyLight, httpRpcUrl, tornadoServiceFee } = require('./config')
const { TxManager } = require('tx-manager')
const { TornadoFeeOracleV5 } = require('@tornado/tornado-oracles')

let web3
let currentTx
let currentJob
let txManager
let tornadoProxyInstance
const feeOracle = new TornadoFeeOracleV5(netId, httpRpcUrl, gasPrices)

function start() {
  try {
    web3 = new Web3(httpRpcUrl)
    tornadoProxyInstance = new web3.eth.Contract(proxyLightABI, proxyLight)
    clearRelayerErrors(redis)
    const { CONFIRMATIONS, MAX_GAS_PRICE } = process.env

    const gasPriceOracleConfig = {
      chainId: netId,
      defaultRpc: httpRpcUrl,
      defaultFallbackGasPrices: gasPrices,
      minPriority: 0.05,
      percentile: 5,
      blocksCount: 20,
    }
    txManager = new TxManager({
      privateKey,
      rpcUrl: httpRpcUrl,
      config: { CONFIRMATIONS, MAX_GAS_PRICE, THROW_ON_REVERT: false },
      gasPriceOracleConfig,
    })

    queue.process(processJob)
    console.log('Worker started')
  } catch (e) {
    logRelayerError(redis, e)
    console.error('error on start worker', e.message)
  }
}

async function checkTornadoFee({ data }, tx) {
  const userProvidedFee = toBN(data.args[4])
  const { amount, decimals, currency } = getInstance(data.contract)

  const relayerDesiredFee = await feeOracle.calculateWithdrawalFeeViaRelayer(
    'relayer_withdrawal',
    tx,
    tornadoServiceFee,
    currency,
    amount,
    decimals,
  )

  console.log(
    'user-provided fee, desired fee',
    fromWei(userProvidedFee.toString()),
    fromWei(toBN(relayerDesiredFee).toString()),
  )
  if (userProvidedFee.lt(toBN(relayerDesiredFee))) {
    throw new Error('Provided fee is not enough. Probably it is a Gas Price spike, try to resubmit.')
  }
}

async function getTxObject({ data }) {
  const calldata = tornadoProxyInstance.methods.withdraw(data.contract, data.proof, ...data.args).encodeABI()

  const incompleteTx = {
    value: data.args[5],
    to: tornadoProxyInstance._address,
    data: calldata,
  }
  const { gasLimit, gasPrice } = await feeOracle.getGasParams(incompleteTx, 'relayer_withdrawal')

  return Object.assign(incompleteTx, { gasLimit, gasPrice })
}

async function processJob(job) {
  try {
    if (!jobType[job.data.type]) {
      throw new Error(`Unknown job type: ${job.data.type}`)
    }
    currentJob = job
    await updateStatus(status.ACCEPTED)
    console.log(`Start processing a new ${job.data.type} job #${job.id}`)
    await submitTx(job)
  } catch (e) {
    console.error('processJob', e.message)
    await updateStatus(status.FAILED)
    throw e
  }
}

async function submitTx(job) {
  const tx = await getTxObject(job)
  await checkTornadoFee(job, tx)
  currentTx = await txManager.createTx(tx)

  try {
    const receipt = await currentTx
      .send()
      .on('transactionHash', txHash => {
        updateTxHash(txHash)
        updateStatus(status.SENT)
      })
      .on('mined', receipt => {
        console.log('Mined in block', receipt.blockNumber)
        updateStatus(status.MINED)
      })
      .on('confirmations', updateConfirmations)

    if (receipt.status === 1) {
      await updateStatus(status.CONFIRMED)
    } else {
      throw new Error('Submitted transaction failed')
    }
  } catch (e) {
    // todo this could result in duplicated error logs
    // todo handle a case where account tree is still not up to date (wait and retry)?
    throw new Error(`Revert by smart contract ${e.message}`)
  }
}

async function updateTxHash(txHash) {
  console.log(`A new successfully sent tx ${txHash}`)
  currentJob.data.txHash = txHash
  await currentJob.update(currentJob.data)
}

async function updateConfirmations(confirmations) {
  console.log(`Confirmations count ${confirmations}`)
  currentJob.data.confirmations = confirmations
  await currentJob.update(currentJob.data)
}

async function updateStatus(status) {
  console.log(`Job status updated ${status}`)
  currentJob.data.status = status
  await currentJob.update(currentJob.data)
}

start()
