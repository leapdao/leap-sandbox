const fs = require('fs');
const spawn = require('child_process').spawn;
const Web3 = require('web3');
const ganache = require('ganache-cli');

const bridgeAbi = require('./build/node/src/abis/bridgeAbi');
const exitHandlerAbi = require('./build/node/src/abis/exitHandler');
const operatorAbi = require('./build/node/src/abis/operator');
const adminableProxyAbi = require('./build/contracts/build/contracts/AdminableProxy').abi;
const minGovAbi = require('./build/contracts/build/contracts/MinGov').abi;
const erc20abi = require('./src/erc20abi');

const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
const wallet = require('ethereumjs-wallet');

const Node = require('./src/nodeClient');
const setup = require('./src/setup');
const { formatHostname } = require('./src/helpers');

const sleep = ms => new Promise(res => setTimeout(res, ms));

function getAccounts(mnemonic, num) {
  const accounts = [];
  for (let i=0; i<num; i++) {
    accounts.push(getAccount(mnemonic, i));
  }
  return accounts;
}

function getAccount(mnemonic, id) {
  const seed = bip39.mnemonicToSeed(mnemonic); // mnemonic is the string containing the words
  const hdk = hdkey.fromMasterSeed(seed);
  const addr_node = hdk.derivePath("m/44'/60'/0'/0/" + id); //m/44'/60'/0'/0/0 is derivation path for the first account. m/44'/60'/0'/0/1 is the derivation path for the second account and so on
  const addr = addr_node.getWallet().getAddressString(); //check that this is the same with the address that ganache list for the first account to make sure the derivation is correct
  const private_key = '0x' + addr_node.getWallet().getPrivateKey().toString('hex');

  return {
    addr: addr,
    privKey: private_key
  }
}

async function setupGanache(port, mnemonic) {
  return new Promise(
    (resolve, reject) => {
      const srv = ganache.server({ locked: false, mnemonic });
      srv.listen(port, (err) => {
        if (err) {
          return reject();
        }
        resolve();
      });
    }
  );
}

async function deployContracts(ganachePort) {
  return new Promise(
    (resolve, reject) => {
      const env = {
        PROPOSAL_TIME: '0',
        PARENT_BLOCK_INTERVAL: '0',
        ADVANCE_BLOCK: '0',
        EVENTS_DELAY: '1'
      };
      const cwd = process.cwd();

      process.chdir(`${cwd}/build/contracts`);
      let truffleConfig = fs.readFileSync('./truffle-config.js').toString();
      // replace the rpc port(s)
      while (true) {
        let tmp = truffleConfig.replace('8545', ganachePort.toString());

        if (tmp === truffleConfig) {
          break;
        }
        truffleConfig = tmp;
      }
      fs.writeFileSync('./truffle-config.js', truffleConfig);

      let proc = spawn('yarn', ['deploy', '--reset'], { env });
      proc.stdout.pipe(process.stdout);
      proc.stderr.pipe(process.stderr);
      proc.on('exit', (exitCode) => {
        process.chdir(cwd);

        if (exitCode !== 0) {
          return reject();
        }

        resolve();
      });
    }
  );
}

async function spawnNode(rpcPort, args, env, logOutput) {
  const node = new Node('localhost', rpcPort);

  return new Promise(
    async (resolve, reject) => {
      let proc = spawn('node', args, { env });

      proc.stdout.pipe(logOutput);
      proc.stderr.pipe(logOutput);
      proc.on('exit', (exitCode) => console.log('leap-node exit', exitCode));

      let node = new Node('localhost', rpcPort);
      while (true) {
        let res;
        try {
          res = await node.web3.status();
        } catch (e) {
        }

        // ready
        if (res === 'ok') {
          return resolve(node);
        }

        await new Promise((resolve) => setTimeout(() => resolve(), 100));
      }
    }
  );
}

async function run() {
  const ganachePort = parseInt(process.env['ganache_port']) || 8545;
  // seems like only one connection from the same source addr can connect to the same tendermint instance
  const numNodes = parseInt(process.env['num_nodes']) || 2;
  const mnemonic = process.env['mnemonic'] ||
    'base embrace minute bone orphan spread teach finger eagle weekend outside reduce';

  await setupGanache(ganachePort, mnemonic);
  await deployContracts(ganachePort);

  const nodes = [];
  const web3 = new Web3(formatHostname('localhost', ganachePort));
  const generatedConfigPath = `${process.cwd()}/build/contracts/build/nodeFiles/generatedConfig.json`;

  let basePort = parseInt(process.env['base_port']) || 7000;
  const firstNodeURL = `http://localhost:${basePort}`;

  for (let i = 0; i < numNodes; i++) {
    const rpcPort = basePort;
    const env = { DEBUG: 'tendermint,leap-node*' };
    const configURL = i === 0 ? generatedConfigPath : firstNodeURL;
    const args = [
      'build/node/index.js',
      '--config', configURL,
      '--rpcport', (basePort++).toString(),
      '--wsport', (basePort++).toString(),
      '--abciPort', (basePort++).toString(),
      '--p2pPort', (basePort++).toString(),
      '--tendermintPort', (basePort++).toString(),
      '--devMode', 'true',
    ];

    const logOutput = fs.createWriteStream(`./node-${i + 1}.log`);

    console.log(`Starting node ${i + 1} of ${numNodes} logfile=./node-${i + 1}.log`);
    nodes.push(await spawnNode(rpcPort, args, env, logOutput));
  }

  const nodeConfig = await nodes[0].web3.getConfig();

  const exitHandlerContract = new web3.eth.Contract(exitHandlerAbi, nodeConfig.exitHandlerAddr);
  const operatorContract = new web3.eth.Contract(operatorAbi, nodeConfig.operatorAddr);
  const bridgeContract = new web3.eth.Contract(bridgeAbi, nodeConfig.bridgeAddr);
  const proxyContract = new web3.eth.Contract(adminableProxyAbi, nodeConfig.operatorAddr);
  const governanceAddr = await proxyContract.methods.admin().call();
  const governanceContract = new web3.eth.Contract(minGovAbi, governanceAddr);

  const tokenAddress = await exitHandlerContract.methods.getTokenAddr(0).call();
  const tokenContract = new web3.eth.Contract(erc20abi, tokenAddress);

  const contracts = {
    exitHandler: exitHandlerContract,
    operator: operatorContract,
    bridge: bridgeContract,
    token: tokenContract,
    governance: governanceContract,
    proxy: proxyContract,
  }

  const accounts = getAccounts(mnemonic, 10);

  await setup(contracts, nodes, accounts, web3);
  // Wait for setup to propagate to all the nodes
  await sleep(10000);

  var testPath = require("path").join(__dirname, "tests");
  const tests = fs.readdirSync(testPath).filter((fileName => {
    return fs.lstatSync("./tests/" + fileName).isFile();
  }));
  for (let i=0; i<tests.length; i++) {
    const test = tests[i];
    console.log("Running: ", test);
    await require("./tests/" + test)(contracts, nodes, accounts, web3);
  }

  console.log('Done');
  process.exit(0);
}

function onException (e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);

run();
