#!/bin/bash

# Exit script as soon as a command fails.
set -o errexit

build_contracts() {
  echo "Fetching contracts repo..."
  if [[ $contracts_repo == *".git"* ]]
  then
    git clone $contracts_repo --quiet ./build/contracts > /dev/null
  else
    cp -R $contracts_repo ./build/contracts
  fi
  cd build/contracts
  echo "Running yarn in contracts..."
  yarn &> ../logs/contracts_yarn.out
  cd - > /dev/null
}

build_node() {
  echo "Fetching node repo..."
  if [[ $node_repo == *".git"* ]]
  then
    git clone --quiet $node_repo ./build/node > /dev/null
  else
    cp -R $node_repo ./build/node
  fi
  cd build/node
  echo "Running yarn in node..."
  yarn &> ../logs/node_yarn.out
  cd - > /dev/null
}

rm -rf build
mkdir build
mkdir build/logs
source configs/build

build_contracts
build_node