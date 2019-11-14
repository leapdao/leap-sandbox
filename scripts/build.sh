#!/bin/bash

# Exit script as soon as a command fails.
set -o errexit

CURRENT_DIR=`pwd`

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
  if [ -z ${TRAVIS+x} ]
  then
    yarn &> ../logs/contracts_yarn.out
  else
    yarn
  fi
  cd - > /dev/null
}

build_node() {
  echo "Fetching node repo..."
  if [[ $node_repo == *".git"* ]]
  then
    git clone --quiet $node_repo ./build/node > /dev/null
  else
    ln -s $node_repo ./build/node
  fi
  cd build/node
  echo "Running yarn in node..."
  if [ -z ${TRAVIS+x} ]
  then
    yarn &> $CURRENT_DIR/build/logs/node_yarn.out
  else
    yarn
  fi
  cd - > /dev/null
}

rm -rf build
mkdir build
mkdir build/logs
mkdir out || true
source configs/build

build_contracts
build_node