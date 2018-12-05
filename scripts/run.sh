#!/bin/bash

# Exit script as soon as a command fails.
set -o errexit
# Executes cleanup function at script exit.
trap cleanup EXIT

# ------------------------------- FUNCTIONS -------------------------------
cleanup() {
  echo "Node PIDs: "${node_pids[*]}
  # Kill the nodes
  for pid in "${node_pids[@]}"
  do
    echo  "Killing node at PID: "$pid
    kill -9 $pid
  done
  # Kill the ganache instance that we started
  echo "Killing ganache"
  kill -9 $ganache_pid
}

start_ganache() {
  echo "Starting ganache netowrk..."
  node_modules/.bin/ganache-cli -p $ganache_port -m "${mnemonic[@]}" &> $out_dir"/ganache.out" &
  ganache_pid=$!
}

deploy_contracts() {
  cd build/contracts
  echo "Deploying contracts..."
  truffle migrate --reset --network development &> $out_dir/contracts_migrate.out
  cd - > /dev/null
}

start_nodes() {
  mkdir $out_dir"/nodes"
  cp build/contracts/build/nodeFiles/generatedConfig.json build/node/generatedConfig.json
  cd build/node

  let first_rpc_port=$base_port+1
  first_rpc_addr="http://localhost:"
  config_loc="$first_rpc_addr$first_rpc_port"

  echo "Starting first node..."
  launch_first_node
  # Sleep a little to allow the node to start up
  sleep 5

  for i in $( seq 0 $(( $num_nodes-2 )) )
  do
    echo "Launching next node..."
    launch_node
  done

  sleep 5
  cd - > /dev/null
}

launch_first_node() {
  DEBUG=tendermint,leap-node* node index.js --config=./generatedConfig.json      \
    --port $((base_port++)) --rpcport $((base_port++)) --wsport $((base_port++)) \
    --abciPort $((base_port++)) --tendermintPort $((base_port++)) --devMode true \
    &> $out_dir"/nodes/node"$((node_count++))".out" &
  node_pids+=($!)
  # Bash is super wierd...
  (( node_count++ ))
  (( base_port += 5 ))
}

launch_node() {
  DEBUG=tendermint,leap-node* node index.js --config=$config_loc                 \
    --port $((base_port++)) --rpcport $((base_port++)) --wsport $((base_port++)) \
    --abciPort $((base_port++)) --tendermintPort $((base_port++)) --devMode true \
    &> $out_dir"/nodes/node"$((node_count++))".out" &
  node_pids+=($!)
  (( node_count++ ))
  (( base_port += 5 ))
}
# ----------------------------- END FUNCTIONS -----------------------------

out_folder=$(date "+%Y-%m-%d|%H:%M:%S")
out_dir=$(pwd)/out/$out_folder
mkdir -p $out_dir &> /dev/null
echo "Out folder: "$out_folder

source configs/run

node_count=0
declare -a node_pids

start_ganache
deploy_contracts
start_nodes

echo "Starting setup..."
node run.js

echo "Press enter to finish..."
read exit