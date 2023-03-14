# Relayer for Tornado Cash [![Build Status](https://github.com/tornadocash/relayer/workflows/build/badge.svg)](https://github.com/tornadocash/relayer/actions) [![Docker Image Version (latest semver)](https://img.shields.io/docker/v/tornadocash/relayer?logo=docker&logoColor=%23FFFFFF&sort=semver)](https://hub.docker.com/repository/docker/tornadocash/relayer)

__*Tornado.cash was sanctioned by the US Treasury on 08/08/2022, this makes it illegal for US citizens to interact with Tornado.cash and all of it's mainnet contracts. Please understand the laws where you live and take all necessary steps to protect and anonomize yourself.__

__*It is recommended to run your Relayer on a VPS ([Virtual Private Server](https://njal.la/)). It is also possible to run it locally with a capable computer running linux.__

__*When connecting to a server you will need to use ssh. You can find information about ssh keygen and management [here](https://www.ssh.com/academy/ssh/keygen).__

## Deploy with docker-compose (recommended)

*Ubuntu 22.10 was used in this seutp.*

*docker-compose.yml contains a stack that will automatically provision SSL certificates for your domain.*

__PREREQUISITES__
1. Install docker-compose
  - Run `sudo curl -L https://github.com/docker/compose/releases/download/2.15.1/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose` with the correct [current](https://github.com/docker/compose/releases) version number after `download/`.
  - Run `sudo chmod +x /usr/local/bin/docker-compose` to set your permissions.
2. Install Docker
  - Run `curl -fsSL https://get.docker.com -o get-docker.sh` to download Docker.
  - Run `sh get-docker.sh` to install Docker.
3. Install Git
  - Fist run `sudo apt-get update` to make sure everything is up to date.
  - Now run `sudo apt-get install git-all` to install Git.
4. Install Nginx
  - Run `sudo apt update` to make sure everything is up to date.
  - Now run `sudo apt install nginx` to install nginx

__SETUP RELAYER__
1. Download `docker-compose.yml`, `tornado.conf`, `.env.example`, and `tornado-stream.conf`
2. Change environment variables for `mainnet` containers in `docker-compose.yml` as needed.
  - Add `PRIVATE_KEY` for your relayer address (remove the 0x from your private key)
  - Set `VIRTUAL_HOST` and `LETSENCRYPT_HOST` to your domain name and add a DNS record pointing to your relayer ip address
  - Set `RELAYER_FEE` to what you would like to charge as your fee (remember .3% is paid to the DAO)
  - Set `RPC_URL` and `ORACLE_RPC_URL` to a non-censoring RPC (You can [run your own](https://github.com/feshchenkod/rpc-nodes), or use a [free option](https://chainnodes.org/))
  - update `REDIS_URL` if needed

__SETUP NGINX REVERSE PROXY__
1. Open your terminal, navigate to the directory containing `docker-compose.yml` and run `docker-compose up -d`
2. Let `docker-compose up -d` run and and wait for the certbot certificates for your domain (this should take 1-2 minutes)
3. Make sure UFW is installed by running `apt update` and `apt install ufw` 
4. Allow SSH in the first position in UFW by running `ufw insert 1 allow ssh`
5. Allow HTTP, and HTTPS by running `ufw allow https/tcp/http`
6. Create the file `/etc/nginx/conf.d/tornado.conf` with the `tornado.conf` file as the contents
7. Edit your `/etc/ngninx/nginx.conf` and append the file with the following:
  - ` stream {  map_hash_bucket_size 128;  map_hash_max_size 128;  include /etc/nginx/conf.d/streams/*.conf;  }`
  - Some of the contents of stream might already be there. The most important part is `include /etc/nginx/conf.d/streams/*.conf;`
8. Create `/etc/nginx/conf.d/streams/tornado-stream.conf`with the `tornado-stream.conf` file as the contents
9. Run `sudo service nginx restart`

__Deploy on side chains__
1. Download `docker-compose.yml`,  `.env.example` Edit the names of these files as needed.
2. Change environment variables for containers in `docker-compose.yml` as needed.
- Change `mainnet` to match the name of the chain you are deploying on.
- Set the `NET_ID` to the chain ID of the chain you are deploying to. (e.g. goerli = 5)
- Add `PRIVATE_KEY` for your relayer address (remove the 0x from your private key)
- Set `VIRTUAL_HOST` and `LETSENCRYPT_HOST` to your domain name and add a DNS record pointing to your relayer ip address
- Set `RELAYER_FEE` to what you would like to charge as your fee (remember .3% is paid to the DAO)
- Set `RPC_URL` to a non-censoring RPC (You can [run your own](https://github.com/feshchenkod/rpc-nodes), or use a [free option](https://chainnodes.org/))
- You will need to set the `ORACLE_RPC_URL` to a mainnet RPC.
- update `REDIS_URL` if needed

## Run as a Docker container

1. `cp .env.example .env`
2. Modify `.env` as needed
3. `docker run -d --env-file .env -p 80:8000 tornadocash/relayer`

In that case you will need to add https termination yourself because browsers with default settings will prevent https
tornado.cash UI from submitting your request over http connection


## Run locally

1. `npm i`
2. `cp .env.example .env`
3. Modify `.env` as needed
4. `npm run start`
5. Go to `http://127.0.0.1:8000`
6. In order to execute withdraw request, you can run following command

```bash
curl -X POST -H 'content-type:application/json' --data '<input data>' http://127.0.0.1:8000/relay
```

Relayer should return a transaction hash.

_Note._ If you want to change contracts' addresses go to [config.js](./config.js) file.

## Input data example

```json
{
  "proof": "0x0f8cb4c2ca9cbb23a5f21475773e19e39d3470436d7296f25c8730d19d88fcef2986ec694ad094f4c5fff79a4e5043bd553df20b23108bc023ec3670718143c20cc49c6d9798e1ae831fd32a878b96ff8897728f9b7963f0d5a4b5574426ac6203b2456d360b8e825d8f5731970bf1fc1b95b9713e3b24203667ecdd5939c2e40dec48f9e51d9cc8dc2f7f3916f0e9e31519c7df2bea8c51a195eb0f57beea4924cb846deaa78cdcbe361a6c310638af6f6157317bc27d74746bfaa2e1f8d2e9088fd10fa62100740874cdffdd6feb15c95c5a303f6bc226d5e51619c5b825471a17ddfeb05b250c0802261f7d05cf29a39a72c13e200e5bc721b0e4c50d55e6",
  "args": [
    "0x1579d41e5290ab5bcec9a7df16705e49b5c0b869095299196c19c5e14462c9e3",
    "0x0cf7f49c5b35c48b9e1d43713e0b46a75977e3d10521e9ac1e4c3cd5e3da1c5d",
    "0x03ebd0748aa4d1457cf479cce56309641e0a98f5",
    "0xbd4369dc854c5d5b79fe25492e3a3cfcb5d02da5",
    "0x000000000000000000000000000000000000000000000000058d15e176280000",
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ],
  "contract": "0xA27E34Ad97F171846bAf21399c370c9CE6129e0D"
}
```

Disclaimer:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
