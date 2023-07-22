import { RelayerProcessor } from './index';
import { getTxService } from '../services';
import { JobStatus } from '../types';
import { UnrecoverableError } from 'bullmq';
import { ExecutionError } from '../services/tx.service';
import { txJobAttempts } from '../config';

class RevertError extends UnrecoverableError {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const relayerProcessor: RelayerProcessor = async (job) => {
  try {
    await job.update({ ...job.data, status: JobStatus.ACCEPTED });
    console.log(`Start processing a new ${job.data.type} job ${job.id}`);
    const txService = getTxService();
    txService.currentJob = job;
    const withdrawalData = job.data;
    const txData = await txService.prepareTxData(withdrawalData);
    await txService.checkTornadoFee(withdrawalData, txData);
    return await txService.sendTx(txData);
  } catch (e) {
    if ((e instanceof ExecutionError && e.code === 'REVERTED') || job.attemptsMade === txJobAttempts) {
      await job.update({ ...job.data, status: JobStatus.FAILED });
      throw new RevertError(e.message, e.code);
    }
    await job.update({ ...job.data, status: JobStatus.RESUBMITTED });
    throw e;
  }
};
