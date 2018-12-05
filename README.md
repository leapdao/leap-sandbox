# leapdao-integ-tests

## 1. Setup
```
git clone https://github.com/leapdao/leapdao-integ-tests.git
cd leapdao-integ-tests
yarn
cd node_modules/leap-core
yarn
cd -
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
This will launch a ganache network, deploy the contracts, start the configured number of nodes and run all the tests in the tests directory. The tests will write logs to a folder ./out/{current time}, where you can look for information about the test run (deployment log, ganache network log and a log for each of the nodes).
