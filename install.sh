#!/bin/bash
# Script must be running from root
if [ "$EUID" -ne 0 ];
  then echo "Please run as root";
  exit 1;
fi;

relayer_soft_git_repo="https://git.tornado.ws/tornadocash/tornado-relayer";

user_home_dir=$(eval echo ~$USER);
relayer_folder="$user_home_dir/tornado-relayer";
relayer_mainnet_soft_source_folder="$relayer_folder/mainnet-soft-source";
relayer_sidechains_soft_source_folder="$relayer_folder/sidechains-soft-source";
nova_relayer_soft_source_folder="$relayer_folder/nova-soft-source";
script_log_file="/tmp/tornado-relayer-installation.log"
if [ -f $script_log_file ]; then rm $script_log_file; fi;

function echo_log_err(){
  echo $1 1>&2;
  echo -e "$1\n" &>> $script_log_file;
}

function echo_log_err_and_exit(){
  echo_log_err "$1";
  exit 1;
}

function is_package_installed(){
  if [ $(dpkg-query -W -f='${Status}' $1 2>/dev/null | grep -c "ok installed") -eq 0 ]; then return 1; else return 0; fi;
}

function install_requred_packages(){
  apt update &>> $script_log_file;

  requred_packages=("curl" "git-all" "ufw" "nginx");
  local package;
  for package in ${requred_packages[@]}; do
    if ! is_package_installed $package; then
      # Kill apache process, because Debian configuring nginx package  right during installation
      if [ $package = "nginx" ]; then systemctl stop apache2; fi; 
      apt install --yes --force-yes  -o DPkg::Options::="--force-confold" $package &>> $script_log_file;
      if ! is_package_installed $package; then
        echo_log_err_and_exit "Error: cannot install \"$package\" package";
      fi;
    fi;
  done;

  echo -e "\nAll required packages installed successfully";
}

function install_node(){
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash;
  . ~/.nvm/nvm.sh;
  . ~/.profile;
  . ~/.bashrc;
  nvm install 14.21.3;
}

function install_repositories(){
    git clone $relayer_soft_git_repo -b main-v5 $relayer_folder
    git clone $relayer_soft_git_repo -b mainnet-v5 $relayer_mainnet_soft_source_folder;
    git clone $relayer_soft_git_repo -b sidechain-v5 $relayer_sidechains_soft_source_folder;
    git clone $relayer_soft_git_repo -b nova $nova_relayer_soft_source_folder;
}

function install_docker_utilities(){
  local kernel_name=$(uname -s);
  local processor_type=$(uname -m);

  curl -SL https://github.com/docker/compose/releases/download/v2.16.0/docker-compose-$kernel_name-$processor_type -o /usr/local/bin/docker-compose;
  chmod +x /usr/local/bin/docker-compose;

  curl -s https://get.docker.com | bash;
}

function configure_firewall(){
  ufw allow https/tcp;
  ufw allow http/tcp;
  ufw insert 1 allow OpenSSH;
  echo "y" | ufw enable;
}

function configure_nginx_reverse_proxy(){
  systemctl stop apache2;

  cp $relayer_folder/tornado.conf /etc/nginx/sites-available/default;
  echo "stream { map_hash_bucket_size 128; map_hash_max_size 128; include /etc/nginx/conf.d/streams/*.conf; }" >> /etc/nginx/nginx.conf;
  mkdir /etc/nginx/conf.d/streams;
  cp $relayer_folder/tornado-stream.conf /etc/nginx/conf.d/streams/tornado-stream.conf;

  systemctl restart nginx;
  systemctl stop nginx;
}

function build_relayer_docker_containers(){
    cd $relayer_mainnet_soft_source_folder && npm run build;
    cd $relayer_sidechains_soft_source_folder && npm run build;
    cd $nova_relayer_soft_source_folder && npm run build:docker;
}

function prepare_environments(){
    cp $relayer_mainnet_soft_source_folder/.env.example $relayer_folder/.env.eth;
    cp $nova_relayer_soft_source_folder/.env.example $relayer_folder/.env.nova;
    tee $relayer_folder/.env.bsc $relayer_folder/.env.arb $relayer_folder/.env.goerli $relayer_folder/.env.polygon $relayer_folder/.env.op \
        $relayer_folder/.env.avax $relayer_folder/.env.gnosis < $relayer_sidechains_soft_source_folder/.env.example > /dev/null;
}

function main(){
  install_requred_packages;
  install_node;
  install_repositories;
  configure_firewall;
  configure_nginx_reverse_proxy;
  install_docker_utilities;
  build_relayer_docker_containers;
  prepare_environments;
  cd $relayer_folder;
}

main;