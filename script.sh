#!/bin/bash

# Exit script as soon as a command fails.
set -o errexit
# Executes cleanup function at script exit.
trap cleanup EXIT

out_dir=$(pwd)"/build/out"
node_count=0
declare -a node_pids
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
  node_modules/.bin/ganache-cli -p $ganache_port &> $out_dir"/ganache.out" &
  ganache_pid=$!
}

deploy_contracts() {
  echo "Fetching contracts repo..."
  cp -R $contracts_repo ./build/contracts
  cd build/contracts
  echo "Running yarn in contracts..."
  yarn &> $out_dir"/contracts_yarn.out"
  echo "Deploying contracts..."
  truffle migrate --reset --network development &> $out_dir"/contracts_migrate.out"
  cd - > /dev/null
}

start_nodes() {
  echo "Fetching node repo..."
  cp -R $node_repo ./build/node
  cp build/contracts/build/nodeFiles/generatedConfig.json build/node/generatedConfig.json
  cd build/node
  echo "Running yarn in node..."
  yarn &> $out_dir"/node_yarn.out"

  let first_rpc_port=$base_port+1
  first_rpc_addr="http://localhost:"
  config_loc="$first_rpc_addr$first_rpc_port"

  echo "Starting first node..."
  launch_first_node
  # Sleep a little to allow the node to start up
  sleep 5

  let num_nodes=$num_nodes-2
  for i in $( seq 0 $num_nodes )
  do
    echo "Launching next node..."
    launch_node
  done

  sleep 10
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

rm -rf build
mkdir build
mkdir build/out
mkdir build/out/nodes

source config

start_ganache
deploy_contracts
start_nodes

read varname