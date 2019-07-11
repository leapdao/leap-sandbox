const fs = require('fs');
const spawn = require('child_process').spawn;
const ethers = require('ethers');
const ganache = require('ganache-cli');

let bridgeAbi;
let exitHandlerAbi;
let operatorAbi;
let adminableProxyAbi;
let minGovAbi;
const erc20abi = require('./src/erc20abi');

const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');

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
      console.log('Starting ganache..');
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
      console.log('Deploying contracts..');
      const env = {
        ...process.env,
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
        let tmp = truffleConfig.replace(/port: [0-9]+/g, `port: ${ganachePort.toString()}`);

        if (tmp === truffleConfig) {
          break;
        }
        truffleConfig = tmp;
      }
      fs.writeFileSync('./truffle-config.js', truffleConfig);
      
      let proc = spawn('yarn', ['deploy', '--reset'], { env });
      const logOutput = fs.createWriteStream(`${cwd}/out/contracts.log`);
      proc.stdout.pipe(logOutput);
      proc.stderr.pipe(logOutput);
      proc.on('exit', (exitCode) => {
        process.chdir(cwd);

        if (exitCode !== 0) {
          return reject();
        }
        
        adminableProxyAbi = require('./build/contracts/build/contracts/AdminableProxy').abi;
        minGovAbi = require('./build/contracts/build/contracts/MinGov').abi;
        bridgeAbi = require('./build/contracts/build/contracts/Bridge').abi;
        exitHandlerAbi = require('./build/contracts/build/contracts/ExitHandler').abi;
        operatorAbi = require('./build/contracts/build/contracts/PoaOperator').abi;
        
        resolve();
      });
    }
  );
}

async function spawnNode(rpcPort, args, env, logOutput) {
  return new Promise(
    async (resolve, reject) => {
      const proc = spawn('node', args, { env });

      proc.stdout.pipe(logOutput);
      proc.stderr.pipe(logOutput);
      proc.on('exit', (exitCode) => console.log('leap-node exit', exitCode));

      while (true) {
        let res;
        try {
          // if we construct the rpc provider before the node is up,
          // we will get a uncaught promise rejection because ethers.js
          // invokes a request to it we can not catch :/
          res = await ethers.utils.fetchJson(
            formatHostname('localhost', rpcPort),
            '{"jsonrpc":"2.0","id":42,"method":"plasma_status","params":[]}'
          );
        } catch (e) {}
        // ready
        if (res && res.result === 'ok') {
          const node = new Node('localhost', rpcPort);
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
  const wallet = new ethers.providers.JsonRpcProvider(formatHostname('localhost', ganachePort)).getSigner(0);

  const generatedConfigPath = `${process.cwd()}/build/contracts/build/nodeFiles/generatedConfig.json`;

  let basePort = parseInt(process.env['base_port']) || 7000;
  let deprecatedPort = 49000;
  const firstNodeURL = `http://localhost:${basePort}`;

  for (let i = 0; i < numNodes; i++) {
    const rpcPort = basePort;
    const env = { 
      ...process.env,
      DEBUG: 'tendermint,leap-node*',
      TX_PORT: deprecatedPort++,
    };
    const configURL = i === 0 ? generatedConfigPath : firstNodeURL;
    const args = [
      'build/node/index.js',
      '--config', configURL,
      '--rpcaddr', '127.0.0.1',
      '--rpcport', (basePort++).toString(),
      '--wsaddr', '127.0.0.1',
      '--wsport', (basePort++).toString(),
      '--abciPort', (basePort++).toString(),
      '--p2pPort', (basePort++).toString(),
      '--tendermintAddr', '127.0.0.1',
      '--tendermintPort', (basePort++).toString(),
      '--devMode', 'true',
    ];

    const logOutput = fs.createWriteStream(`./out/node-${i + 1}.log`);

    console.log(`Starting node ${i + 1} of ${numNodes} logfile=./out/node-${i + 1}.log`);
    nodes.push(await spawnNode(rpcPort, args, env, logOutput));
  }

  // fix for admin()
  adminableProxyAbi.forEach((obj) => {
    if (obj.name === 'admin') {
      obj.constant = true;
      obj.stateMutability = 'view';
    }
  });

  const nodeConfig = await nodes[0].getConfig();

  const exitHandlerContract = new ethers.Contract(nodeConfig.exitHandlerAddr, exitHandlerAbi, wallet);
  const operatorContract = new ethers.Contract(nodeConfig.operatorAddr, operatorAbi, wallet);
  const bridgeContract = new ethers.Contract(nodeConfig.bridgeAddr, bridgeAbi, wallet);
  const proxyContract = new ethers.Contract(nodeConfig.operatorAddr, adminableProxyAbi, wallet);
  const governanceAddr = await proxyContract.admin();
  const governanceContract = new ethers.Contract(governanceAddr, minGovAbi, wallet);

  const tokenAddress = await exitHandlerContract.getTokenAddr(0);
  const tokenContract = new ethers.Contract(tokenAddress, erc20abi, wallet);

  const contracts = {
    exitHandler: exitHandlerContract,
    operator: operatorContract,
    bridge: bridgeContract,
    token: tokenContract,
    governance: governanceContract,
    proxy: proxyContract,
  }

  const accounts = getAccounts(mnemonic, 10);

  await setup(contracts, nodes, accounts, wallet);
  // Wait for setup to propagate to all the nodes
  await sleep(2000);

  var testPath = require("path").join(__dirname, "tests");
  const tests = fs.readdirSync(testPath).filter((fileName => {
    return fileName.endsWith('.js') && fs.lstatSync("./tests/" + fileName).isFile();
  }));
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log("Running: ", test);
    await require("./tests/" + test)(contracts, nodes, accounts, wallet);
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
