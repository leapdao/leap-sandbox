# leapdao-integ-tests

## Setup
```
git clone https://github.com/leapdao/leapdao-integ-tests.git
cd leapdao-integ-tests
yarn
cd node_modules/leap-core
yarn
cd -
yarn run build
yarn run test
```
The tests will write logs to a folder ./out/{current time}, where you can look for information about the test run (deployment log, ganache network log and a log for each of the nodes). Build logs are located in build/logs.
