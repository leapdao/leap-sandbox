const fs = require('fs');
const Web3 = require('web3');

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

function parseConfig() {
  const config = {};
  fs.readFileSync('configs/run', {encoding: 'utf8'}).toString().split('\n').forEach(line => {
    [key, value] = line.split('=');
    value = value.replace(/['"]+/g, '');
    config[key] = value;
  });
  return config;
}

async function run() {
  const config = parseConfig();
  const web3 = new Web3(formatHostname('localhost', config.ganache_port));

  let base_port = parseInt(config.base_port);
  const nodes = [];
  for (let i = 0; i < config.num_nodes; i++) { 
    nodes.push(new Node('localhost', base_port, base_port+1));
    base_port+=5;
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

  const accounts = getAccounts(config.mnemonic, 10);

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
}
run();