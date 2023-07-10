import { autoInjectable, container } from 'tsyringe';
import compareVersions from 'compare-versions';
import fetch from 'node-fetch';
import { ConfigService } from './config.service';
import { RedisStore } from '../modules/redis';
import { formatEther } from 'ethers/lib/utils';
import { Levels } from './notifier.service';

class RelayerError extends Error {
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }

  code: string;
}

@autoInjectable()
export class HealthService {
  constructor(private config: ConfigService, private store: RedisStore) {}

  async clearErrorCodes() {
    await this.store.client.del('errors:code');
  }

  private async _getErrors(): Promise<{
    errorsLog: { message: string; score: number }[];
    errorsCode: Record<string, number>;
  }> {
    const logSet = await this.store.client.zrevrange('errors:log', 0, -1, 'WITHSCORES');
    const codeSet = await this.store.client.zrevrange('errors:code', 0, -1, 'WITHSCORES');

    return {
      errorsLog: HealthService._parseSet(logSet),
      errorsCode: HealthService._parseSet(codeSet, 'object'),
    };
  }

  private async _getStatus() {
    const status = await this.store.client.hgetall('health:status');
    if (Object.keys(status).length === 0) {
      return { health: 'false', error: 'Service is not running' };
    }
    return status;
  }

  private static _parseSet(log, to = 'array', keys = ['message', 'score']) {
    let out;
    if (to === 'array') {
      out = [];
      while (log.length) {
        const [a, b] = log.splice(0, 2);
        out.push({ [keys[0]]: a, [keys[1]]: b });
      }
    } else {
      out = {};
      while (log.length) {
        const [a, b] = log.splice(0, 2);
        out[a] = Number(b);
      }
    }

    return out;
  }

  async setStatus(status: { status: boolean; error: string }) {
    await this.store.client.hset('health:status', status);
  }

  async getStatus() {
    const { errorsLog, errorsCode } = await this._getErrors();
    if (errorsCode['NETWORK_ERROR'] > 10) {
      await this.setStatus({ status: false, error: 'Network error' });
    }
    const heathStatus = await this._getStatus();

    return {
      ...heathStatus,
      errorsLog,
      errorsCode,
    };
  }

  async saveError(e, jobId?: string) {
    await this.store.client.zadd('errors:code', 'INCR', 1, e.code || 'RUNTIME_ERROR');
    await this.store.client.zadd('errors:log', 'INCR', 1, e.message);

    if (e.code === 'REVERTED' || e.code === 'SEND_ERROR') {
      const jobUrl = `${this.config.host}/v1/jobs/${jobId}`;
      await this.pushAlert({
        message: `${e.message} \n ${jobUrl}`,
        type: 'REVERTED',
        level: 'WARN',
        time: new Date().getTime(),
      });
    }
  }

  async pushAlert(alert: Alert) {
    const channel = `${this.config.netId}/user-notify`;
    await this.store.publisher.publish(channel, JSON.stringify(alert));
  }

  private async _checkBalance(value, currency: 'MAIN' | 'TORN') {
    let level: Levels = 'OK';
    const type = 'BALANCE';
    const time = new Date().getTime();
    if (value.lt(this.config.balances[currency].critical)) {
      level = 'CRITICAL';
    } else if (value.lt(this.config.balances[currency].warn)) {
      level = 'WARN';
    }
    const msg = { WARN: 'Please refill your balance', CRITICAL: 'Insufficient balance', OK: 'ok' };
    const alert = {
      type: `${type}_${currency}_${level}`,
      message: `${msg[level]} ${formatEther(value)} ${currency === 'MAIN' ? this.config.nativeCurrency : 'torn'}`,
      level,
      time,
    };
    await this.pushAlert(alert);

    return alert;
  }

  async checkUpdate() {
    console.log('Checking version...');
    const lastVersion =
      (await fetch('https://api.github.com/repos/tornadocash/tornado-relayer/releases').then((res) => res.json()))[0]?.tag_name ||
      this.config.version;
    const isUpToDate = compareVersions(this.config.version, lastVersion) >= 0;
    if (!isUpToDate) {
      await this.pushAlert({
        type: 'VERSION_UPDATE_WARN',
        message: `New version available: ${lastVersion}`,
        level: 'WARN',
        time: new Date().getTime(),
      });
    }
    return { isUpToDate, lastVersion };
  }

  async check() {
    await this.config.checkNetwork();
    const mainBalance = await this.config.wallet.getBalance();
    const tornBalance = await this.config.tokenContract.balanceOf(this.config.wallet.address);
    const mainStatus = await this._checkBalance(mainBalance, 'MAIN');
    const tornStatus = await this._checkBalance(tornBalance, 'TORN');
    if (mainStatus.level === 'CRITICAL') {
      throw new RelayerError(mainStatus.message, 'INSUFFICIENT_MAIN_BALANCE');
    }
    if (tornStatus.level === 'CRITICAL') {
      throw new RelayerError(tornStatus.message, 'INSUFFICIENT_TORN_BALANCE');
    }
    return { mainStatus, tornStatus };
  }
}

type Alert = {
  type: string;
  message: string;
  level: Levels;
  time?: number;
};
export default () => container.resolve(HealthService);
