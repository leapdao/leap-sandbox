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
The processes will write logs to a folder ./out/{current date}, where you can look for informations about the test run (such as yarn outputs, deployment log, ganache network log and a log for each of the nodes).
