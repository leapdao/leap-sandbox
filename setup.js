const { Node, formatHostname, unspentForAddress } = require('./client');
const fs = require('fs');
const Web3 = require('web3');
const bridgeAbi = require('./build/node/src/abis/bridgeAbi');
const exitHandlerAbi = require('./build/node/src/abis/exitHandler');
const operatorAbi = require('./build/node/src/abis/operator');
const erc20abi = require('./erc20abi');

const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
const wallet = require('ethereumjs-wallet');

const { helpers, Tx, Outpoint, Output } = require('leap-core');

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
  fs.readFileSync('config', {encoding: 'utf8'}).toString().split('\n').forEach(line => {
    [key, value] = line.split('=');
    value = value.replace(/['"]+/g, '');
    config[key] = value;
  });
  return config;
}

async function setup(contracts, nodes, accounts, web3) {
  const alice = accounts[0].addr;
  console.log(alice);
  web3.eth.getBalance(alice).then(console.log);
  await contracts.token.methods.approve(contracts.exitHandler.options.address, 500000000000).send({from: alice});
  await contracts.token.methods.approve(contracts.operator.options.address, 500000000000).send({from: alice});

  let slotId = 0;
  for (let i = 0; i < nodes.length; i++) { 
    let node = nodes[i];
    const info = await node.web3.getValidatorInfo();
    await contracts.operator.methods.bet(slotId, 1, info.ethAddress, '0x' + info.tendermintAddress).send({
      from: alice,
      gas: 2000000
    });
    slotId++;
    await web3.eth.sendTransaction({
      from: alice,
      to: info.ethAddress, 
      value: web3.utils.toWei('1', "ether")
    });
  }

  await contracts.exitHandler.methods.deposit(alice, 200000000000, 0).send({
    from: alice,
    gas: 2000000
  });
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

  const tokenAddress = await bridgeContract.methods.nativeToken().call(); 
  const tokenContract = new web3.eth.Contract(erc20abi, tokenAddress);

  const contracts = {
    exitHandler: exitHandlerContract,
    operator: operatorContract,
    bridge: bridgeContract,
    token: tokenContract
  }

  const accounts = getAccounts(config.mnemonic, 5);

  await setup(contracts, nodes, accounts, web3);

  var testPath = require("path").join(__dirname, "tests");
  fs.readdirSync(testPath).forEach(async function(test) {
    console.log("Running: ", test);
    await require("./tests/" + test)(contracts, nodes, accounts, web3);
  });
}
run();