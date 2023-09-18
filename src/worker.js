const fs = require('fs')
const MerkleTree = require('@tornado/fixed-merkle-tree')
const { Utils, Controller } = require('@tornado/anonymity-mining')
const { TornadoFeeOracleV5 } = require('@tornado/tornado-oracles')
const swapABI = require('../abis/swap.abi.json')
const miningABI = require('../abis/mining.abi.json')
const tornadoABI = require('../abis/tornadoABI.json')
const tornadoProxyABI = require('../abis/tornadoProxyABI.json')
const { queue } = require('./queue')
const {
  poseidonHash2,
  getInstance,
  sleep,
  toBN,
  fromWei,
  toChecksumAddress,
  RelayerError,
  logRelayerError,
} = require('./utils')
const { jobType, status } = require('./constants')
const {
  torn,
  netId,
  gasLimits,
  privateKey,
  httpRpcUrl,
  oracleRpcUrl,
  baseFeeReserve,
  miningServiceFee,
  tornadoServiceFee,
  tornadoGoerliProxy,
} = require('./config')
const resolver = require('./modules/resolver')
const { TxManager } = require('@tornado/tx-manager')
const { redis, redisSubscribe } = require('./modules/redis')
const getWeb3 = require('./modules/web3')

let web3
let currentTx
let currentJob
let tree
let txManager
let controller
let swap
let minerContract
const feeOracle = new TornadoFeeOracleV5(netId, oracleRpcUrl)

async function fetchTree() {
  const elements = await redis.get('tree:elements')
  const convert = (_, val) => (typeof val === 'string' ? toBN(val) : val)
  tree = MerkleTree.deserialize(JSON.parse(elements, convert), poseidonHash2)

  if (currentTx && currentJob && ['MINING_REWARD', 'MINING_WITHDRAW'].includes(currentJob.data.type)) {
    const { proof, args } = currentJob.data
    if (toBN(args.account.inputRoot).eq(toBN(tree.root()))) {
      console.log('Account root is up to date. Skipping Root Update operation...')
      return
    } else {
      console.log('Account root is outdated. Starting Root Update operation...')
    }

    const update = await controller.treeUpdate(args.account.outputCommitment, tree)

    const minerAddress = await resolver.resolve(torn.miningV2.address)
    const instance = new web3.eth.Contract(miningABI, minerAddress)
    const data =
      currentJob.data.type === 'MINING_REWARD'
        ? instance.methods.reward(proof, args, update.proof, update.args).encodeABI()
        : instance.methods.withdraw(proof, args, update.proof, update.args).encodeABI()
    await currentTx.replace({
      to: minerAddress,
      data,
    })
    console.log('replaced pending tx')
  }
}

async function start() {
  try {
    await clearErrors()
    web3 = getWeb3()
    const { CONFIRMATIONS, MAX_GAS_PRICE } = process.env
    txManager = new TxManager({
      privateKey,
      rpcUrl: httpRpcUrl,
      config: {
        CONFIRMATIONS,
        MAX_GAS_PRICE,
        THROW_ON_REVERT: false,
        BASE_FEE_RESERVE_PERCENTAGE: baseFeeReserve,
      },
    })

    swap = new web3.eth.Contract(swapABI, await resolver.resolve(torn.rewardSwap.address))
    minerContract = new web3.eth.Contract(miningABI, await resolver.resolve(torn.miningV2.address))
    redisSubscribe.subscribe('treeUpdate', fetchTree)
    await fetchTree()
    const provingKeys = {
      treeUpdateCircuit: require('../keys/TreeUpdate.json'),
      treeUpdateProvingKey: fs.readFileSync('./keys/TreeUpdate_proving_key.bin').buffer,
    }
    controller = new Controller({ provingKeys })
    await controller.init()
    queue.process(processJob)
    console.log('Worker started')
  } catch (e) {
    await logRelayerError(redis, e)
    console.error('error on start worker', e.message)
  }
}

function checkFee({ data }, gasInfo) {
  if (data.type === jobType.TORNADO_WITHDRAW) {
    return checkTornadoFee(data, gasInfo)
  }
  return checkMiningFee(data)
}

async function checkTornadoFee({ args, contract }, tx) {
  const { currency, amount, decimals } = getInstance(contract)
  const [userProvidedFee, refund] = [args[4], args[5]].map(toBN)
  const { gasLimit, gasPrice } = tx

  const ethPrice = await redis.hget('prices', currency)
  const totalWithdrawalFee = await feeOracle.calculateWithdrawalFeeViaRelayer({
    tx,
    txType: 'relayer_withdrawal',
    amount,
    currency,
    decimals,
    refundInEth: refund.toString(),
    predefinedGasLimit: gasLimit,
    predefinedGasPrice: gasPrice,
    tokenPriceInEth: ethPrice,
    relayerFeePercent: tornadoServiceFee,
  })

  console.log(
    'user-provided fee, desired fee',
    fromWei(userProvidedFee.toString()),
    fromWei(toBN(totalWithdrawalFee).toString()),
  )
  if (userProvidedFee.lt(toBN(totalWithdrawalFee))) {
    throw new RelayerError(
      'Provided fee is not enough. Probably it is a Gas Price spike, try to resubmit.',
      0,
    )
  }
}

async function checkMiningFee({ args }) {
  const gasPrice = await feeOracle.getGasPrice()
  const ethPrice = await redis.hget('prices', 'torn')
  const isMiningReward = currentJob.data.type === jobType.MINING_REWARD
  const providedFee = isMiningReward ? toBN(args.fee) : toBN(args.extData.fee)

  const expense = toBN(gasPrice).mul(toBN(gasLimits[currentJob.data.type]))
  const expenseInTorn = expense.mul(toBN(1e18)).div(toBN(ethPrice))
  // todo make aggregator for ethPrices and rewardSwap data
  const balance = await swap.methods.tornVirtualBalance().call()
  const poolWeight = await swap.methods.poolWeight().call()
  const expenseInPoints = Utils.reverseTornadoFormula({ balance, tokens: expenseInTorn, poolWeight })
  /* eslint-disable */
  const serviceFeePercent = isMiningReward
    ? toBN(0)
    : toBN(args.amount)
        .sub(providedFee) // args.amount includes fee
        .mul(toBN(parseInt(miningServiceFee * 1e10)))
        .div(toBN(1e10 * 100))
  /* eslint-enable */
  const desiredFee = expenseInPoints.add(serviceFeePercent) // in points
  console.log(
    'user provided fee, desired fee, serviceFeePercent',
    providedFee.toString(),
    desiredFee.toString(),
    serviceFeePercent.toString(),
  )
  if (toBN(providedFee).lt(desiredFee)) {
    throw new RelayerError('Provided fee is not enough. Probably it is a Gas Price spike, try to resubmit.')
  }
}

async function getProxyContract() {
  let proxyAddress
  if (netId === 5) {
    proxyAddress = tornadoGoerliProxy
  } else {
    proxyAddress = await resolver.resolve(torn.tornadoRouter.address)
  }
  const contract = new web3.eth.Contract(tornadoProxyABI, proxyAddress)

  return {
    contract,
    isOldProxy: checkOldProxy(proxyAddress),
  }
}

function checkOldProxy(address) {
  const OLD_PROXY = '0x905b63Fff465B9fFBF41DeA908CEb12478ec7601'
  return toChecksumAddress(address) === toChecksumAddress(OLD_PROXY)
}

async function getTxObject({ data }) {
  if (data.type === jobType.TORNADO_WITHDRAW) {
    let { contract, isOldProxy } = await getProxyContract()

    let calldata = contract.methods.withdraw(data.contract, data.proof, ...data.args).encodeABI()

    if (isOldProxy && getInstance(data.contract).currency !== 'eth') {
      contract = new web3.eth.Contract(tornadoABI, data.contract)
      calldata = contract.methods.withdraw(data.proof, ...data.args).encodeABI()
    }

    const incompleteTx = {
      value: data.args[5],
      from: txManager.address, // Required, because without it relayerRegistry.burn will fail, because msg.sender is not relayer
      to: contract._address,
      data: calldata,
    }
    const { gasLimit, gasPrice } = await feeOracle.getGasParams({
      tx: incompleteTx,
      txType: 'relayer_withdrawal',
    })

    return { ...incompleteTx, gasLimit, gasPrice }
  } else {
    const method = data.type === jobType.MINING_REWARD ? 'reward' : 'withdraw'
    const calldata = minerContract.methods[method](data.proof, data.args).encodeABI()
    return {
      to: minerContract._address,
      data: calldata,
      gasLimit: gasLimits[data.type],
    }
  }
}

async function isOutdatedTreeRevert(receipt, currentTx) {
  try {
    await web3.eth.call(currentTx.tx, receipt.blockNumber)
    console.log('Simulated call successful')
    return false
  } catch (e) {
    console.log('Decoded revert reason:', e.message)
    return (
      e.message.indexOf('Outdated account merkle root') !== -1 ||
      e.message.indexOf('Outdated tree update merkle root') !== -1
    )
  }
}

async function processJob(job) {
  try {
    if (!jobType[job.data.type]) {
      throw new RelayerError(`Unknown job type: ${job.data.type}`)
    }
    currentJob = job
    await updateStatus(status.ACCEPTED)
    console.log(`Start processing a new ${job.data.type} job #${job.id}`)
    await submitTx(job)
  } catch (e) {
    console.error('processJob', e.message)
    await updateStatus(status.FAILED)
    throw new RelayerError(e.message)
  }
}

async function submitTx(job, retry = 0) {
  const rawTx = await getTxObject(job)
  await checkFee(job, rawTx)
  currentTx = await txManager.createTx(rawTx)

  if (job.data.type !== jobType.TORNADO_WITHDRAW) {
    await fetchTree()
  }

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
      if (job.data.type !== jobType.TORNADO_WITHDRAW && (await isOutdatedTreeRevert(receipt, currentTx))) {
        if (retry < 3) {
          await updateStatus(status.RESUBMITTED)
          await submitTx(job, retry + 1)
        } else {
          throw new RelayerError('Tree update retry limit exceeded')
        }
      } else {
        throw new RelayerError('Submitted transaction failed')
      }
    }
  } catch (e) {
    // todo this could result in duplicated error logs
    // todo handle a case where account tree is still not up to date (wait and retry)?
    if (
      job.data.type !== jobType.TORNADO_WITHDRAW &&
      (e.message.indexOf('Outdated account merkle root') !== -1 ||
        e.message.indexOf('Outdated tree update merkle root') !== -1)
    ) {
      if (retry < 5) {
        await sleep(3000)
        console.log('Tree is still not up to date, resubmitting')
        await submitTx(job, retry + 1)
      } else {
        throw new RelayerError('Tree update retry limit exceeded')
      }
    } else {
      throw new RelayerError(`Revert by smart contract ${e.message}`)
    }
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

async function clearErrors() {
  console.log('Errors list cleared')
  await redis.del('errors')
}

start()
