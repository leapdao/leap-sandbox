# leapdao-integ-tests

![image](https://user-images.githubusercontent.com/163447/49596266-3c6e7b80-f97a-11e8-8c63-7cb5108a3ea9.png)

## 1. Setup
```
git clone https://github.com/leapdao/leapdao-integ-tests.git
cd leapdao-integ-tests
yarn
```

## 2. Build
The integration tests will be run against a version of the node and contracts software. In configs/build, you can specify what version you would like to use. It can be either a local folder or a remote github repository. Examples:
```
// To run against master
contracts_repo="https://github.com/leapdao/leap-contracts.git"
// To run against a specific branch 
contracts_repo=" --single-branch -b **branch_name** https://github.com/leapdao/leap-contracts.git"
// To run against a local folder
contracts_repo="/Users/you/code/leap-contracts"
```
When you are happy with your configuration, run:
```
yarn run build
```
This will generate a build folder in the project and fetch the repos and build them. Yarn logs of the build are available in build/logs.

## 3. Run tests
After you have built the projects, you can start the tests. Some parameters can be configured in configs/run. When you are happy with the congiguration, run:
```
yarn run test
```
This will:
1. launch a ganache network
2. deploy the contracts
3. start the configured number of nodes
4. perform setup tasks 
5. run all the tests in the tests directory 

The tests will write logs to a folder ./out/{current time}, where you can look for information about the test run (deployment log, ganache network log and a log for each of the nodes).
When all the tests are completed you are prompted to press enter to end the tests (kill ganache and all the nodes). This is so that you can do some additinal debugging with the netwrok after the tests are finished.

## Writing your own tests
To add a test, create a file in the tests directory that looks like this:
```
module.exports = async function(contracts, nodes, accounts, web3) {
  // Your tests go here
}
```
The function parameters are objects you will receive to perform you test. Here is the describtion:
```
// contracts are web3.eth.Contract objects 
contracts = {token, bridge, operator, exitHandler}

// nodes are Node objects (defined in src/nodeClient) representing the running nodes
nodes = [node0, node1...]

// accounts are simple objects containing the address and private key
accounts = [{addr, privKey}, {addr, privKey}...]
// also note: accounts[1] is the admin of all the proxys

// web3 is just Web3 contected to the ganache network
web3 = Web3
```

## Challange exit script
Example command:
```
FIRST_HASH=0x79e2f2ae39387b17be6ea9c11b4c0933da6e151a364e3b22e6605f6ec910b78e SECOND_HASH=0xd66e357bbb66a48280f796c397967de8b774852633fce28414b84c5fa65996a2 NODE_URL=http://localhost:7001 PROVIDER_URL=http://localhost:8545 PRIV_KEY=0x4c5d8ebb1dbbf45779f21354bff9d5e80914ed3ba62680df4bba0878123c8407 VALIDATOR_ADDR=0xe1390C6fa6e499A3C080bed5A6C1B755e525670b node scripts/challengeExit.js
```
