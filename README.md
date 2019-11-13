# Leap sandbox

![image](https://user-images.githubusercontent.com/163447/49596266-3c6e7b80-f97a-11e8-8c63-7cb5108a3ea9.png)

A set of scripts to set up a local Leap network or/and run integration tests against it.

* [Setup](#setup)
    * [Install dependencies](#install-dependencies)
    * [Fetch relevant Leap subprojects](#fetch-relevant-leap-subprojects)
* [Usage](#usage)
    * [Start local environment (for development or testing)](#start-local-environment-for-development-or-testing)
      * [Start flavoured Leap Network (Recipies)](#start-flavoured-leap-network-recipies)
      * [Using with Docker](#using-with-docker)
    * [Run integration tests](#run-integration-tests)
    * [Writing your own tests](#writing-your-own-tests)

## Setup

### Install dependencies

```sh
yarn
```

### Fetch relevant Leap subprojects

Sandbox needs a version of the leap-node and leap-contracts to run. In configs/build, you can specify what version you would like to use. It can be either a local folder or a remote github repository. Examples:

```sh
# To run against master
contracts_repo="https://github.com/leapdao/leap-contracts.git"
# To run against a specific branch
contracts_repo=" --single-branch -b **branch_name** https://github.com/leapdao/leap-contracts.git"
# To run against a local folder
contracts_repo="/Users/you/code/leap-contracts"
```

When you are happy with your configuration, run:

```sh
yarn build
```

This will generate a build folder in the project and fetch the repos and build them. Yarn logs of the build are available in build/logs.

## Usage

### Start local environment (for development or testing)

Local environment consist of the following parts:

- Ganache as a root chain with Leap contracts deployed
- one or multiple leap-node instances with JSON RPC

To start local env use the following command:

```sh
yarn start [--onlyRoot] [<recipe>]
```

Optional arguments:

- `--onlyRoot` — start only the root chain with plasma contracts. To start leap-node later on use `yarn start` in another terminal.
- `<recipe>` — apply one of the recipies to the network. See below.

Ganache setup logs and leap-node's logs are in the `out/` folder.

#### Start flavoured Leap Network (Recipies)

In `tests/recipies` you can see possible recipies to run against the local network. Each recipe prepares the environment for a particular purpose — sets up required tokens, makes deposits etc.

To start a network with recipe:

```sh
yarn start <recipe>
```

E.g. `yarn start planetA` to start a local network for Planet A project.

Alternatively, you can start vanilla leap network and then apply a recipe with `yarn apply planetA`.

#### Using with Docker

Start vanilla network:

```sh
docker run -p 7000:7000 -p 8545:8545 --name leap-env quay.io/leapdao/leap-sandbox
```

Apply recipe to vanilla network:

```sh
docker exec leap-env node applyRecipe planetA
```

`yarn start <recipe>` should also work for applying recipes to dockerized network, given you have the repo working copy.

### Run integration tests

```sh
yarn test [<testName>]
```

Optional arguments:

- `<testName>` — name of the test to run (e.g. `8_breeding`). If not specified, all the tests will be executed.

This command

- starts a local leap network or connects to the existing one
- runs the tests from the `tests` directory

The tests will write logs to a folder ./out/.

### Writing your own tests

To add a test, create a file in the tests directory that looks like this:

```js
module.exports = async function({ contracts, nodes, accounts, wallet, plasmaWallet }) {
  // Your tests go here
}
```

The function parameters are objects you will receive to perform you test. Here is the description:

```js
// contracts are web3.eth.Contract objects
contracts = {token, bridge, operator, exitHandler}

// nodes are Node objects (defined in src/nodeClient) representing the running nodes
nodes = [node0, node1...]

// accounts are simple objects containing the address and private key
accounts = [{addr, privKey}, {addr, privKey}...]
// also note: accounts[1] is the admin of all the proxys

// wallet is an ethers.Wallet conected to the root chain /ganache with accounts imported.
wallet = ethers.Wallet

// plasmaWallet is an ethers.Wallet conected to the plasma chain with accounts imported.
plasmaWallet = ethers.Wallet

```
