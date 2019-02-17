#!/bin/bash

# Exit script as soon as a command fails.
set -o errexit
# Executes cleanup function at script exit.
trap cleanup EXIT

# ------------------------------- FUNCTIONS -------------------------------
cleanup() {
  # get a comma-separated list of used ports
  port_list="${used_ports[*]}"
  port_list="${port_list//${IFS:0:1}/,}"

  # find all the processed listening on used ports and SOFT kill them
  echo "Killing ganache/node processes on ports: $port_list"
  lsof -i :$port_list | awk '{l=$2} NR>1{print l}' | uniq | xargs kill
}

start_ganache() {
  echo "Starting ganache network..."
  node_modules/.bin/ganache-cli -p $ganache_port -m "${mnemonic[@]}" &> $out_dir"/ganache.out" &
  used_ports+=($ganache_port)
}

deploy_contracts() {
  cd build/contracts
  echo "Replacing ganache port in truffle-config.js.."
  sed -i -E 's/port: [0-9]+/port: '$ganache_port'/g' truffle-config.js

  echo "Deploying contracts..."
  export PROPOSAL_TIME=0
  export PARENT_BLOCK_INTERVAL=0
  yarn deploy --reset &> $out_dir/contracts_migrate.out
  cd - > /dev/null
}

start_nodes() {
  mkdir $out_dir"/nodes"
  cp build/contracts/build/nodeFiles/generatedConfig.json build/node/generatedConfig.json
  cp -R build/contracts/build/nodeFiles/* build/node/src/abis/
  cd build/node

  let first_rpc_port=$base_port+1
  first_rpc_addr="http://localhost:"
  config_loc="$first_rpc_addr$first_rpc_port"

  echo "Starting first node..."
  launch_node ./generatedConfig.json
  # Sleep a little to allow the node to start up
  sleep 7

  for i in $( seq 0 $(( $num_nodes-2 )) )
  do
    echo "Launching next node..."
    launch_node $config_loc
    sleep 7
  done

  cd - > /dev/null
}

launch_node() {
  DEBUG=tendermint,leap-node* node index.js --config=$1                 \
    --port $((base_port++)) --rpcport $((base_port++)) --wsport $((base_port++)) \
    --abciPort $((base_port++)) --tendermintPort $((base_port++)) --devMode true \
    &> $out_dir"/nodes/node"$((node_count++))".out" &
  used_ports+=($base_port)
  (( node_count+=1 ))
  (( base_port+=5 ))
}
# ----------------------------- END FUNCTIONS -----------------------------

out_folder=$(date "+%Y-%m-%d|%H:%M:%S")
out_dir=$(pwd)/out/$out_folder
mkdir -p $out_dir &> /dev/null
echo "Out folder: "$out_folder

source configs/run

node_count=0
declare -a used_ports

start_ganache
deploy_contracts
start_nodes

sleep 5

echo "Starting setup..."
node run.js

echo "Press enter to finish..."
read exit