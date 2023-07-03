const Web3 = require('web3')
const { GasPriceOracle } = require('gas-price-oracle')
const { serialize } = require('@ethersproject/transactions')
const { toBN, toWei, fromWei, toHex } = require('web3-utils')
const { redis } = require('./modules/redis')
const proxyLightABI = require('../abis/proxyLightABI.json')
const ovmGasPriceOracleABI = require('../abis/ovmGasPriceOracleABI.json')
const { queue } = require('./queue')
const { getInstance, fromDecimals, logRelayerError, clearRelayerErrors } = require('./utils')
const { jobType, status } = require('./constants')
const {
  netId,
  gasPrices,
  gasLimits,
  privateKey,
  proxyLight,
  httpRpcUrl,
  tornadoServiceFee,
} = require('./config')
const { TxManager } = require('tx-manager')

let web3
let currentTx
let currentJob
let txManager
let gasPriceOracle
let tornadoProxyInstance

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

    gasPriceOracle = new GasPriceOracle(gasPriceOracleConfig)

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

async function getGasPrice() {
  const { maxFeePerGas, gasPrice } = await gasPriceOracle.getTxGasParams({
    legacySpeed: 'fast',
    bumpPercent: 10,
  })
  return maxFeePerGas || gasPrice
}

function getGasLimit() {
  let action

  switch (Number(netId)) {
    case 10:
      action = jobType.OP_TORNADO_WITHDRAW
      break
    case 42161:
      action = jobType.ARB_TORNADO_WITHDRAW
      break
    default:
      action = jobType.TORNADO_WITHDRAW
  }

  return gasLimits[action]
}

async function fetchL1Fee({ data, gasPrice, gasLimit }) {
  const { address } = web3.eth.accounts.privateKeyToAccount(privateKey)
  const nonce = await web3.eth.getTransactionCount(address)

  const ovmGasPriceOracleContract = '0x420000000000000000000000000000000000000F'
  const oracleInstance = new web3.eth.Contract(ovmGasPriceOracleABI, ovmGasPriceOracleContract)

  const calldata = tornadoProxyInstance.methods.withdraw(data.contract, data.proof, ...data.args).encodeABI()

  const tx = serialize({
    nonce,
    type: 0,
    data: calldata,
    chainId: netId,
    value: data.args[5],
    to: tornadoProxyInstance._address,
    gasLimit: gasLimit,
    gasPrice: toHex(gasPrice),
  })

  const l1Fee = await oracleInstance.methods.getL1Fee(tx).call()

  return l1Fee
}

async function estimateWithdrawalGasLimit(tx) {
  try {
    const fetchedGasLimit = await web3.eth.estimateGas(tx)
    const bumped = Math.floor(fetchedGasLimit * 1.2)
    return bumped
  } catch (e) {
    return getGasLimit()
  }
}

async function checkTornadoFee({ data }, { gasPrice, gasLimit }) {
  const fee = toBN(data.args[4])
  const { amount, decimals } = getInstance(data.contract)

  let expense = toBN(gasPrice).mul(toBN(gasLimit))
  if (netId === 10) {
    const l1Fee = await fetchL1Fee({ data, gasPrice, gasLimit })
    console.log('l1 fee', l1Fee)
    expense = expense.add(toBN(l1Fee))
  }

  const feePercent = toBN(fromDecimals(amount, decimals))
    .mul(toBN(parseInt(tornadoServiceFee * 1e10)))
    .div(toBN(1e10 * 100))
  const desiredFee = expense.add(feePercent)

  console.log(
    'sent fee, desired fee, feePercent',
    fromWei(fee.toString()),
    fromWei(desiredFee.toString()),
    fromWei(feePercent.toString()),
  )
  if (fee.lt(desiredFee)) {
    throw new Error('Provided fee is not enough. Probably it is a Gas Price spike, try to resubmit.')
  }
}

async function getTxObject({ data }) {
  const calldata = tornadoProxyInstance.methods.withdraw(data.contract, data.proof, ...data.args).encodeABI()

  const gasPrice = await getGasPrice()
  const incompleteTx = {
    value: data.args[5],
    to: tornadoProxyInstance._address,
    data: calldata,
    gasPrice,
  }
  const gasLimit = await estimateWithdrawalGasLimit(incompleteTx)

  return Object.assign(incompleteTx, { gasLimit })
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
  currentTx = await txManager.createTx(await getTxObject(job))

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
