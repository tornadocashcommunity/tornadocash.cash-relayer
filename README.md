# Relayer for Tornado Cash [![Build Status](https://github.com/tornadocash/relayer/workflows/build/badge.svg)](https://github.com/tornadocash/relayer/actions)![Sidechains version](https://img.shields.io/badge/version-5.2.1-blue?logo=docker)![Mainnet version](https://img.shields.io/badge/version-4.1.5-blue?logo=docker)

**\*Tornado Cash was sanctioned by the US Treasury on 08/08/2022, this makes it illegal for US citizens to interact with Tornado Cash and all of it's associated deployed smart contracts. Please understand the laws where you live and take all necessary steps to protect and anonymize yourself.**

**\*It is recommended to run your Relayer on a VPS instnace (Virtual Private Server). Ensure SSH configuration is enabled for security, you can find information about SSH keygen and management [here](https://www.ssh.com/academy/ssh/keygen).**

## Deploy with script and docker-compose

_The following instructions are for Ubuntu 22.10, other operating systems may vary._

#### Installation:

Just run in terminal:

```bash
curl -s https://git.tornado.ws/tornadocash/classic-relayer/raw/branch/main/install.sh | bash
```

#### Configuring environments:

1. Go to `tornado-relayer` folder on the server home directory
2. Check environment files:

By default each network is preconfigured the naming of `.env.<NETWORK>`

-   `.env.eth` for Ethereum Mainnet
-   `.env.bsc` for Binance Smart Chain
-   `.env.arb` for Arbitrum
-   `.env.op` for Optimism
-   `.env.gnosis` for Gnosis (xdai)
-   `.env.polygon` for Polygon (matic)
-   `.env.avax` for Avalanche C-Chain

3.  Configure (fill) environment files for those networks on which the relayer will be deployed:

-   Set `PRIVATE_KEY` to your relayer address (remove the 0x from your private key) to each environment file
    -   _It is recommended not to reuse the same private keys for each network as a security measure_
-   Set `VIRTUAL_HOST` and `LETSENCRYPT_HOST` a unique subndomain for every network to each environment file
    -   eg: `mainnet.example.com` for Ethereum, `binance.example.com` for Binance etc
    -   add a A wildcard record DNS record with the value assigned to your instance IP address to configure subdomains
-   Set `RELAYER_FEE` to what you would like to charge as your fee (remember 0.3% is deducted from your staked relayer balance)
-   Set `RPC_URL` to a non-censoring RPC (You can [run your own](https://github.com/feshchenkod/rpc-nodes), or use a [free option](https://chainnodes.org/))
-   Set `ORACLE_RPC_URL` to an Ethereum native RPC endpoint

#### Deployment:

1. Build and deploy the docker source for the configured neworks specified via `--profile <NETWORK_SYMBOL>`, for example (if you run relayer only for Ethereum Mainnet, Binance Smart Chain and Arbitrum):

-   `docker-compose --profile eth --profile bsc --profile arb up -d`

2. Visit your domain addresses and check each `/status` endpoint to ensure there is no errors in the `status` fields

If you want to change some relayer parameters, for example, RPC url or fee percent, stop the relayer software with command `docker-compose down --remove-orphans`, change in corresponding `.env.{chain}` file what you need and rerun relayer as described above.

#### Disclaimer:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
