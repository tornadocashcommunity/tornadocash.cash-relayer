# Relayer for Tornado Cash [![Build Status](https://github.com/tornadocash/relayer/workflows/build/badge.svg)](https://github.com/tornadocash/relayer/actions) ![Static Badge](https://img.shields.io/badge/version-5.1.0-blue?logo=docker)

***Tornado Cash was sanctioned by the US Treasury on  08/08/2022, this makes it illegal for US citizens to interact with  Tornado Cash and all of it's associated deployed smart contracts. Please understand the laws where you live and take all necessary steps to  protect and anonymize yourself.**

***It is recommended to run your Relayer on a VPS instance ([Virtual Private Server](https://njal.la/)). Ensure SSH configuration is enabled for security, you can find information about SSH keygen and management [here](https://www.ssh.com/academy/ssh/keygen).**

## Deploy with docker-compose

__PREREQUISITES__

1. Update core dependencies 

  - `sudo apt-get update` 

2. Install docker-compose

  - `curl -SL https://github.com/docker/compose/releases/download/v2.16.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose`

3. Install Docker

  - `curl -fsSL https://get.docker.com -o get-docker.sh && chmod +x get-docker.sh && ./get-docker.sh` 

4. Install git

  - `sudo apt-get install git-all` 

5. Install nginx

  - `sudo apt install nginx` 

6. Stop apache2 instance (enabled by default)

  - `sudo systemctl stop apache2`

__FIREWALL CONFIGURATION__ 

_* Warning: Failure to configure SSH as the first UFW rule, will lock you out of the instance_ 

1. Make sure UFW is installed by running `apt update` and `apt install ufw` 
2. Allow SSH in the first position in UFW by running `ufw insert 1 allow ssh`*
3. Allow HTTP, and HTTPS by running `ufw allow https/tcp/http`
4. Finalize changes and enable firewall `ufw enable`

__NGINX REVERSE PROXY__

1. Copy the pre-modified nginx policy as your default policy 

  - `cp tornado.conf /etc/nginx/sites-available/default` 

2. Append the default nginx configuration to include streams

  - `echo "stream {  map_hash_bucket_size 128;  map_hash_max_size 128;  include /etc/nginx/conf.d/streams/*.conf; }" >> /etc/nginx/nginx.conf`

3. Create the stream configuration

  - `mkdir /etc/nginx/conf.d/streams && cp tornado-stream.conf /etc/nginx/conf.d/streams/tornado-stream.conf`

4. Start nginx to make sure the configuration is correct 

  - `sudo systemctl restart nginx`

5. Stop nginx

  - `sudo systemctl stop nginx`

__DEPLOYMENT__

1. Clone the repository and enter the directory 

  - `git clone https://git.tornado.ws/tornadocash/classic-relayer -b sidechain-v5 && cd classic-relayer`

2. Check environment files:

   By default each network is preconfigured the naming of `.env.<NETWORK>`

   - `.env.bsc` for Binance Smart Chain

   - `.env.arb` for Arbitrum

   - `.env.op` for Optimism

   - `.env.gnosis` for Gnosis (xdai)

   - `.env.polygon` for Polygon (matic)

   - `.env.avax` for Avalanche C-Chain

 3. Configure (fill) environment files for those networks on which the relayer will be deployed:

    - Set `PRIVATE_KEY` to your relayer address (remove the 0x from your private key) to each environment file (*It is recommended not to reuse the same private keys for each network as a security measure*)

    - Set `VIRTUAL_HOST` and `LETSENCRYPT_HOST` a unique subndomain for every network to each environment file, eg: `mainnet.example.com` for Ethereum, `binance.example.com` for Binance etc
    - Add a A wildcard record DNS record with the value assigned to your instance IP address to configure subdomains
    - Set `RELAYER_FEE` to what you would like to charge as your fee
    - Set `RPC_URL` to a non-censoring RPC (You can [run your own](https://github.com/feshchenkod/rpc-nodes), or use a [free option](https://chainnodes.org/))
    - Set `ORACLE_RPC_URL` to an Ethereum native RPC endpoint

 4. Build docker image for sidechain with simple `npm run build` command

 5. Uncomment the `env_file` lines (remove `# `) for the associated network services in `docker-compose.yml` for chosen chains (networks)

 6. Run docker-compose for the configured networks specified via `--profile <NETWORK_SYMBOL>`, for example (if you run relayer only Binance Smart Chain and Arbitrum):

    - `docker-compose --profile bsc --profile arb up -d`

 7. Visit your domain addresses and check each `/status` endpoint to ensure there is no errors in the `status` fields

## Run locally for one chain

1. `yarn`
2. `cp .env.example .env`
3. Modify `.env` as needed (described above)
4. `yarn start`
5. Go to `http://127.0.0.1:8000`
6. In order to execute withdraw request, you can run following command

```bash
curl -X POST -H 'content-type:application/json' --data '<input data>' http://127.0.0.1:8000/relay
```

Relayer should return a transaction hash

In that case you will need to add https termination yourself because browsers with default settings will prevent https
tornado.cash UI from submitting your request over http connection

## Run own RPC nodes

It is strongly recommended that you use your own RPC nodes. Instruction on how to run full nodes can be found [here](https://github.com/feshchenkod/rpc-nodes).

## Architecture

1. TreeWatcher module keeps track of Account Tree changes and automatically caches the actual state in Redis and emits `treeUpdate` event to redis pub/sub channel
2. Server module is Express.js instance that accepts http requests
3. Controller contains handlers for the Server endpoints. It validates input data and adds a Job to Queue.
4. Queue module is used by Controller to put and get Job from queue (bull wrapper)
5. Status module contains handler to get a Job status. It's used by UI for pull updates
6. Validate contains validation logic for all endpoints
7. Worker is the main module that gets a Job from queue and processes it

Disclaimer:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
