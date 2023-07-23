# Relayer for Tornado Cash [![Build Status](https://github.com/tornadocash/relayer/workflows/build/badge.svg)](https://github.com/tornadocash/relayer/actions) ![Static Badge](https://img.shields.io/badge/version-6.0.0-blue?logo=docker)

__*Tornado Cash was sanctioned by the US Treasury on 08/08/2022, this makes it illegal for US citizens to interact with Tornado Cash and all of it's associated deployed smart contracts. Please understand the laws where you live and take all necessary steps to protect and anonymize yourself.__

__*It is recommended to run your Relayer on a VPS instnace ([Virtual Private Server](https://njal.la/)). Ensure SSH configuration is enabled for security, you can find information about SSH keygen and management [here](https://www.ssh.com/academy/ssh/keygen).__

## Deploy with script and docker-compose

*The following instructions are for Ubuntu 22.10, other operating systems may vary.* 

#### Installation:

Just run in terminal:

```bash
curl -s https://git.tornado.ws/tornadocash/classic-relayer/raw/branch/v6/install.sh | bash
```

#### Configuring environments:

1. Go to `tornado-relayer` folder on the server home directory
2. Check environment files:

​	By default each network is preconfigured the naming of `.env.<NETWORK>`

- `.env.eth` for Ethereum Mainnet 
- `.env.goerli` for Goerli testnet
- `.env.bsc` for Binance Smart Chain
- `.env.arb` for Arbitrum
- `.env.op` for Optimism
- `.env.gnosis` for Gnosis (xdai)
- `.env.polygon` for Polygon (matic)
- `.env.avax` for Avalanche C-Chain

​	3. Configure (fill) environment files for those networks on which the relayer will be deployed:

  - Set `PRIVATE_KEY` to your relayer address (remove the 0x from your private key) to each environment file

    - *It is recommended not to reuse the same private keys for each network as a security measure*

  - Set `VIRTUAL_HOST` and `LETSENCRYPT_HOST` a unique subndomain for every network to each environment file

    - eg: `mainnet.example.com` for Ethereum, `binance.example.com` for Binance etc
    - add a A wildcard record DNS record with the value assigned to your instance IP address to configure subdomains

  - Set `RELAYER_FEE` to what you would like to charge as your fee (remember 0.3% is deducted from your staked relayer balance)

  - Set `RPC_URL` to a non-censoring RPC (You can [run your own](https://github.com/feshchenkod/rpc-nodes), or use a [free option](https://chainnodes.org/))

  - Set `ORACLE_RPC_URL` to an Ethereum native RPC endpoint

  - Set `REWARD_ACCOUNT` - eth address that is used to collect fees

  - Set `TELEGRAM_NOTIFIER_BOT_TOKEN` and `TELEGRAM_NOTIFIER_CHAT_ID` if your want get notify to telegram

    

  - Update `AGGREGATOR` if needed - Contract address of aggregator instance.

  - Update `CONFIRMATIONS` if needed - how many block confirmations to wait before processing an event. Not recommended
    to set less than 3

  - Update `MAX_GAS_PRICE` if needed - maximum value of gwei value for relayer's transaction

  - Update `GAS_BUMP_PERCENTAGE` if needed - how much in % will the network gas for transaction additionally increased

    **NB!** Don't update these values if you not sure what you doing.



#### Deployment:

1. Build and deploy the docker source for the configured neworks specified via `--profile <NETWORK_SYMBOL>`, for example (if you run relayer only for Ethereum Mainnet, Binance Smart Chain and Arbitrum):

  - `docker-compose --profile eth --profile bsc --profile arb up -d`

2. Visit your domain addresses and check each `/status` endpoint to ensure there is no errors in the `status` fields

## Run locally

1. `yarn`
2. `cp .env.example .env`
3. Modify `.env` as needed
4. `yarn start`
5. Go to `http://127.0.0.1:8000`
6. In order to execute withdraw request, you can run following command

```bash
curl -X POST -H 'content-type:application/json' --data '<input data>' http://127.0.0.1:8000/v1/tornadoWithdraw

```

Relayer should return a job id in uuid v4 format.

In that case you will need to add https termination yourself because browsers with default settings will prevent https
Tornado Cash UI from submitting your request over http connection

## Run geth node

It is strongly recommended that you use your own RPC node. Instruction on how to run full node with `geth` can be
found [here](https://github.com/tornadocash/rpc-nodes).

## Monitoring

### Basic

For basic monitoring setup telegram bot and fill variables in .env file

Alerts about:

- Main relayer currency balance
- Torn staked balance in relayer contract
- Withdraw transactions send errors

How to create bot: https://core.telegram.org/bots#3-how-do-i-create-a-bot

How to get chat id: https://stackoverflow.com/questions/32423837/telegram-bot-how-to-get-a-group-chat-id/32572159#32572159

### Advanced

You can find the guide on how to install the Zabbix server in the [/monitoring/README.md](/monitoring/README.md).

## Compatible networks

- Ethereum Mainnet (1)
- Binance Smart Chain (56)
- Polygon (Matic) Network (137)
- Optimism (10)
- Arbitrum One (42161)
- Gnosis Chain (100)
- Avalanche Mainnet (43114)
- Ethereum Goerli (5)



Disclaimer:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
